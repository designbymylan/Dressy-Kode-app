/**
 * L'état de l'app. Deux modes :
 * - sans compte (ou compte de démonstration), tout vit sur le téléphone ;
 *   le profil sans compte est gardé entre deux lancements ;
 * - connecté (`account: 'connecte'`), chaque action est aussi enregistrée
 *   dans Supabase (state/remote.ts), et l'état est relu de la base au lancement.
 * L'interface change l'état tout de suite ; si l'enregistrement échoue, un
 * message le dit, sans bloquer.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { AppState, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EVENTS, PIECES, WEATHER, type Piece, type Weather } from '../data/wardrobe';
import { supabase } from '../lib/supabase';
import { kodeReply, type KodeMessage, type KodeOutfit } from './kode';
import { todayOutfits } from './outfits';
import { DEMO_PROFILE, EMPTY_PROFILE, type Profile } from './profile';
import * as remote from './remote';
import type { Account, NotifChoice, PlanId, Period, Photo, Planned, Session } from './remote';
import { isoOf, newId, type Iso, type RdvEvent, type Trip } from './planning';
import { isActive, type JobRow } from './jobs';
import { RELIRE_APRES, jourIso, maintenant, semaine, type Contexte } from './contexte';
import { cleTenue, evite, garder, type Ecart, type Raison } from './ecarts';

export type { PlanId, Period, Planned, Session, NotifChoice };
export type { Silhouette, MeasureId, Profile } from './profile';
export type HomeModule = 'tenue' | 'raccourcis' | 'rdv' | 'semaine' | 'rayons' | 'kode' | 'chiffres' | 'oubliees' | 'tendance' | 'porte' | 'nouveautes' | 'prets' | 'bilan';
export type Share = { id: string; pieceId: string; friend: string; mode: 'montrer' | 'preter' | 'donner' };
export type Toast = { id: number; text: string; undo?: boolean; warn?: boolean };

/**
 * Mêmes valeurs que public.plan_limits() côté base (migration
 * offres_fashion_sapologue, 21/10). null : sans limite. `capsule` porte
 * Fashion, `atelier` Sapologue ; Couture n'est plus vendue.
 */
export const LIMITS: Record<PlanId, { pieces: number | null; questions: number | null }> = {
  decouverte: { pieces: 30, questions: 5 },
  capsule: { pieces: 120, questions: 30 },
  atelier: { pieces: null, questions: null },
  couture: { pieces: null, questions: null },
};

export const MODULE_LABELS: Record<HomeModule, { title: string; note: string }> = {
  tenue: { title: 'Tenue du jour', note: 'Ta tenue, de la tête aux pieds' },
  raccourcis: { title: 'Raccourcis', note: 'Ajouter, composer, planifier, voyager' },
  rdv: { title: 'Rendez-vous', note: 'Sa date, sa météo, sa tenue' },
  semaine: { title: 'Ta semaine', note: 'Tes tenues prévues, jour par jour, avec la météo' },
  rayons: { title: 'Ton dressing', note: 'Tes rayons, d’un coup d’œil' },
  kode: { title: 'Demande à Kodi', note: 'Des questions prêtes, selon ta journée' },
  chiffres: { title: 'Tes chiffres', note: 'Pièces sorties, coût par port' },
  oubliees: { title: 'À redécouvrir', note: 'Les pièces qui dorment' },
  tendance: { title: 'Tendance', note: 'Ce qui se porte, déjà dans ton dressing' },
  porte: { title: 'Le plus porté', note: 'Tes pièces fétiches' },
  nouveautes: { title: 'Nouveautés', note: 'Tes dernières pièces' },
  prets: { title: 'Prêts en cours', note: 'Ce que tes amies ont' },
  bilan: { title: 'Ton mois', note: 'Ce que tu portes vraiment' },
};

type ModuleState = { id: HomeModule; on: boolean };

/** L'ordre et l'état des sections d'un nouvel espace : la tenue du jour en tête, puis les raccourcis et la semaine. */
export const DEFAULT_MODULES: ModuleState[] = [
  { id: 'tenue', on: true },
  { id: 'raccourcis', on: true },
  { id: 'rdv', on: true },
  { id: 'semaine', on: true },
  { id: 'rayons', on: true },
  { id: 'kode', on: true },
  { id: 'chiffres', on: true },
  { id: 'porte', on: true },
  { id: 'oubliees', on: true },
  { id: 'tendance', on: false },
  { id: 'nouveautes', on: false },
  { id: 'prets', on: false },
  { id: 'bilan', on: false },
];

/** Les sections affichées d'abord, dans leur ordre, puis les masquées : chaque flèche change l'accueil. */
const shownFirst = (list: ModuleState[]) => [...list.filter((m) => m.on), ...list.filter((m) => !m.on)];

/**
 * L'ordre enregistré, remis d'aplomb : la tenue du jour (devenue une section
 * le 06/10) reprend la tête si elle manque, « Tes tenues prévues » se fond
 * dans « Ta semaine », les sections nées depuis arrivent masquées, celles
 * qui n'existent plus partent.
 */
export function normalizeModules(list: { id: string; on: boolean }[] | undefined): ModuleState[] {
  if (!list) return DEFAULT_MODULES;
  // L'accueil refait le 23/10 : un ordre gardé avant lui (sans « Raccourcis ») repart de l'ordre d'origine, pour que les nouvelles sections se voient.
  if (!list.some((m) => m.id === 'raccourcis')) return DEFAULT_MODULES;
  const known = new Set<string>(DEFAULT_MODULES.map((m) => m.id));
  const prevues = list.find((m) => m.id === 'prevues')?.on;
  let kept = list
    .filter((m, i, all) => known.has(m.id) && all.findIndex((x) => x.id === m.id) === i)
    .map((m) => ({ id: m.id as HomeModule, on: m.id === 'semaine' && prevues ? true : m.on }));
  if (!kept.some((m) => m.id === 'tenue')) kept = [{ id: 'tenue', on: true }, ...kept];
  const have = new Set(kept.map((m) => m.id));
  return shownFirst([...kept, ...DEFAULT_MODULES.filter((m) => !have.has(m.id)).map((m) => ({ ...m, on: false }))]);
}

type State = {
  /** Le temps, au lancement, de relire la session et l'état gardé. */
  booting: boolean;
  onboarded: boolean;
  /**
   * « nouveau » : sans compte, tout reste sur ce téléphone ; « demo » : le
   * compte d'Alice ; « connecte » : un compte Supabase, tout y est enregistré.
   */
  account: 'nouveau' | 'demo' | 'connecte';
  /** La session ouverte, y compris quand le questionnaire reste à remplir. */
  session: Session | null;
  /** Compte créé, e-mail pas encore confirmé : l'espace partira à la première connexion. */
  pendingEmail: string | null;
  profile: Profile;
  pieces: Piece[];
  outfitIndex: number;
  wornToday: string[] | null;
  /** Les tenues prévues, par date (AAAA-MM-JJ), sur le mois passé et les mois à venir. */
  planned: Record<Iso, Planned>;
  /** Les rendez-vous décrits par la personne (heure, type, importance, tenue voulue…). */
  events: RdvEvent[];
  trips: Trip[];
  /** Ce qu'elle accepte de recevoir ; null : pas encore demandé. */
  notifs: NotifChoice | null;
  /** Les tenues écartées par « Pas pour moi », les plus récentes d'abord. */
  ecarts: Ecart[];
  /** Ce qui a été porté, jour par jour (« Je la porte ») : le bilan du dimanche s'en sert. */
  journal: Record<Iso, string[]>;
  messages: KodeMessage[];
  kodeUsed: number;
  kodeTyping: boolean;
  plan: PlanId;
  period: Period;
  extraPlaces: number;
  packs: string[];
  modules: ModuleState[];
  density: 'aeree' | 'dense';
  shares: Share[];
  toast: Toast | null;
  undo: Piece[] | null;
  /** Les photos confiées à Kodi pendant cette session, et leurs pièces. */
  jobs: JobRow[];
  /**
   * Photos choisies pendant le questionnaire, avant que le compte existe :
   * elles partent chez Kodi dès que la session s'ouvre (création du compte,
   * ou première connexion si l'e-mail était à confirmer).
   */
  pendingPhotos: Photo[];
  /** Pièces arrivées depuis l'ouverture de l'app : elles tombent sur la tringle à leur première apparition. */
  fresh: string[];
  /** Les données du jour (météo, fériés, vacances, tendances) reçues du serveur ; gardées pour le hors-ligne. */
  contexte: Contexte | null;
  /** Quand elles ont été reçues (ms) : relues au retour dans l'app après une heure. */
  contexteLu: number;
};

/** Au premier lancement : aucun profil, aucune pièce, l'offre gratuite. */
const initial: State = {
  booting: true,
  onboarded: false,
  account: 'nouveau',
  session: null,
  pendingEmail: null,
  profile: EMPTY_PROFILE,
  pieces: [],
  outfitIndex: 0,
  wornToday: null,
  planned: {},
  events: [],
  trips: [],
  notifs: null,
  ecarts: [],
  journal: {},
  messages: [],
  kodeUsed: 0,
  kodeTyping: false,
  plan: 'decouverte',
  period: 'mois',
  extraPlaces: 0,
  packs: [],
  modules: DEFAULT_MODULES,
  density: 'aeree',
  shares: [],
  toast: null,
  undo: null,
  jobs: [],
  pendingPhotos: [],
  fresh: [],
  contexte: null,
  contexteLu: 0,
};

const fresh: State = { ...initial, booting: false };

/** Le compte d'Alice : 37 pièces, deux tenues prévues, l'offre Fashion entamée. */
const demo: State = {
  ...fresh,
  onboarded: true,
  account: 'demo',
  profile: DEMO_PROFILE,
  pieces: PIECES,
  planned: {
    [isoOf(1)]: { title: 'Noir sur noir, mais doux', pieces: ['r1', 'm2', 'c5', 'a2'] },
    [isoOf(4)]: { title: 'Net, sans raideur', pieces: ['m2', 'h5', 'b4', 'c2', 'a1'] },
  },
  events: demoEvents(),
  kodeUsed: 12,
  plan: 'capsule',
};

type Action =
  | { t: 'hydrate'; patch: Partial<State> }
  | { t: 'account'; acc: Account }
  | { t: 'session'; session: Session | null; pendingEmail: string | null }
  | { t: 'onboard'; profile: Profile; pieces: Piece[]; photos: Photo[] }
  | { t: 'pendingPhotos'; photos: Photo[] }
  | { t: 'demo' }
  | { t: 'profile'; patch: Partial<Profile> }
  | { t: 'restart' }
  | { t: 'wear'; ids: string[]; toast: string }
  | { t: 'undo' }
  | { t: 'nextOutfit' }
  | { t: 'addPiece'; piece: Piece }
  | { t: 'swapId'; from: string; to: string }
  | { t: 'removePiece'; id: string }
  | { t: 'updatePiece'; piece: Piece }
  | { t: 'plan'; date: Iso; outfit: Planned }
  | { t: 'unplan'; date: Iso }
  | { t: 'saveEvent'; event: RdvEvent }
  | { t: 'removeEvent'; id: string }
  | { t: 'saveTrip'; trip: Trip; days: Record<Iso, Planned> }
  | { t: 'removeTrip'; id: string }
  | { t: 'notifs'; choice: NotifChoice }
  | { t: 'ecart'; ecart: Ecart }
  | { t: 'ask'; message: KodeMessage }
  | { t: 'answer'; message: KodeMessage; refund?: boolean }
  | { t: 'setPlan'; plan: PlanId; period: Period }
  | { t: 'planSync'; plan: PlanId; period: Period; kodeUsed: number }
  | { t: 'buyPack'; id: string }
  | { t: 'buyPlaces' }
  | { t: 'toggleModule'; id: HomeModule }
  | { t: 'moveModule'; id: HomeModule; by: -1 | 1 }
  | { t: 'resetModules' }
  | { t: 'density'; value: State['density'] }
  | { t: 'share'; share: Share }
  | { t: 'toast'; text: string; undo?: boolean; warn?: boolean }
  | { t: 'hideToast' }
  | { t: 'jobs'; jobs: JobRow[] }
  | { t: 'pieces'; pieces: Piece[] }
  | { t: 'landed'; id: string }
  | { t: 'dropJob'; id: string }
  | { t: 'contexte'; contexte: Contexte; at: number };

let toastId = 0;
/** Dernière lecture des tâches de Kodi : l'écran d'ajout lit toutes les 2 s, le suivi de fond n'a pas à doubler. */
let lastJobsRead = 0;

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case 'hydrate':
      return {
        ...s,
        ...a.patch,
        ...(a.patch.account === 'demo' && a.patch.pieces ? { pieces: refreshDemo(a.patch.pieces) } : {}),
        // Un profil sauvegardé avant le 07/10 n'a ni nom, ni pseudo, ni photo.
        ...(a.patch.profile ? { profile: { ...EMPTY_PROFILE, ...(a.patch.account === 'demo' ? { lastName: DEMO_PROFILE.lastName, username: DEMO_PROFILE.username } : {}), ...a.patch.profile } } : {}),
        ...(a.patch.modules ? { modules: normalizeModules(a.patch.modules) } : {}),
        ...(a.patch.planned ? { planned: normalizePlanned(a.patch.planned) } : {}),
        booting: false,
      };
    case 'account': {
      const { acc } = a;
      // Questionnaire pas encore rempli : on garde la session et on repart de l'onboarding.
      return {
        ...fresh,
        modules: s.modules,
        density: s.density,
        session: acc.session,
        onboarded: acc.onboarded,
        account: acc.onboarded ? 'connecte' : 'nouveau',
        profile: acc.onboarded ? acc.profile : { ...EMPTY_PROFILE, name: acc.profile.name, email: acc.session.email },
        pieces: acc.pieces,
        planned: acc.planned,
        events: acc.events,
        trips: acc.trips,
        notifs: acc.notifs ?? s.notifs,
        ecarts: acc.ecarts,
        journal: acc.journal,
        messages: acc.messages,
        kodeUsed: acc.kodeUsed,
        plan: acc.plan,
        period: acc.period,
      };
    }
    case 'session':
      return { ...s, session: a.session, pendingEmail: a.pendingEmail };
    case 'onboard':
      return {
        ...fresh,
        modules: s.modules,
        density: s.density,
        session: s.session,
        pendingEmail: s.pendingEmail,
        account: s.session ? 'connecte' : 'nouveau',
        onboarded: true,
        profile: a.profile,
        pieces: a.pieces,
        pendingPhotos: a.photos,
        // Répondu pendant le questionnaire (étape des rappels).
        notifs: s.notifs,
      };
    case 'pendingPhotos':
      return { ...s, pendingPhotos: a.photos };
    case 'demo':
      return { ...demo };
    case 'profile':
      return { ...s, profile: { ...s.profile, ...a.patch } };
    case 'restart':
      return { ...fresh };
    case 'wear': {
      const ids = new Set(a.ids);
      return {
        ...s,
        undo: s.pieces,
        wornToday: a.ids,
        journal: { ...s.journal, [isoOf(0)]: a.ids },
        pieces: s.pieces.map((p) => (ids.has(p.id) ? { ...p, wears: p.wears + 1, lastWorn: 0 } : p)),
        toast: { id: ++toastId, text: a.toast, undo: true },
      };
    }
    case 'undo': {
      if (!s.undo) return s;
      // Un port annulé quitte aussi le journal du jour.
      const journal = { ...s.journal };
      if (s.wornToday) delete journal[isoOf(0)];
      return { ...s, pieces: s.undo, undo: null, wornToday: null, journal, toast: null };
    }
    case 'nextOutfit':
      return { ...s, outfitIndex: (s.outfitIndex + 1) % Math.max(1, todayOutfits(s.pieces, meteoDe(s).jours[0], evite(s.ecarts)).length), wornToday: null };
    case 'ecart':
      // La tenue écartée sort de la liste : le même rang montre déjà la suivante.
      return { ...s, ecarts: garder([a.ecart, ...s.ecarts]), wornToday: null };
    case 'addPiece':
      return { ...s, pieces: [a.piece, ...s.pieces], fresh: [...s.fresh, a.piece.id], toast: { id: ++toastId, text: `${a.piece.name} rejoint tes portants` } };
    case 'swapId': {
      // La base a donné son identifiant à une pièce ajoutée : on le reporte partout où elle apparaît.
      const swap = (id: string) => (id === a.from ? a.to : id);
      const planned = Object.fromEntries(Object.entries(s.planned).map(([d, o]) => [d, { ...o, pieces: o.pieces.map(swap) }]));
      return { ...s, pieces: s.pieces.map((p) => (p.id === a.from ? { ...p, id: a.to } : p)), planned, fresh: s.fresh.map(swap), undo: s.undo?.map((p) => (p.id === a.from ? { ...p, id: a.to } : p)) ?? null };
    }
    case 'updatePiece':
      return { ...s, pieces: s.pieces.map((p) => (p.id === a.piece.id ? a.piece : p)), toast: { id: ++toastId, text: 'Étiquette enregistrée' } };
    case 'removePiece':
      return { ...s, undo: s.pieces, pieces: s.pieces.filter((p) => p.id !== a.id), toast: { id: ++toastId, text: 'Pièce retirée du dressing', undo: true } };
    case 'plan':
      return { ...s, planned: { ...s.planned, [a.date]: a.outfit } };
    case 'unplan': {
      const planned = { ...s.planned };
      delete planned[a.date];
      return { ...s, planned };
    }
    case 'saveEvent':
      return { ...s, events: [...s.events.filter((e) => e.id !== a.event.id), a.event].sort((x, z) => (x.date + (x.time ?? '')).localeCompare(z.date + (z.time ?? ''))) };
    case 'removeEvent':
      return { ...s, events: s.events.filter((e) => e.id !== a.id) };
    case 'saveTrip':
      return { ...s, trips: [...s.trips.filter((t) => t.id !== a.trip.id), a.trip].sort((x, z) => x.start.localeCompare(z.start)), planned: { ...s.planned, ...a.days } };
    case 'removeTrip':
      return {
        ...s,
        trips: s.trips.filter((t) => t.id !== a.id),
        planned: Object.fromEntries(Object.entries(s.planned).filter(([, o]) => o.tripId !== a.id)),
      };
    case 'notifs':
      return { ...s, notifs: a.choice };
    case 'ask':
      return { ...s, messages: [...s.messages, a.message], kodeUsed: s.kodeUsed + 1, kodeTyping: true };
    case 'answer':
      return { ...s, messages: [...s.messages, a.message], kodeTyping: false, kodeUsed: a.refund ? Math.max(0, s.kodeUsed - 1) : s.kodeUsed };
    case 'setPlan':
      return { ...s, plan: a.plan, period: a.period, toast: { id: ++toastId, text: a.plan === 'decouverte' ? 'Retour à Découverte' : 'Ton offre est active' } };
    case 'planSync': {
      const changed = a.plan !== s.plan;
      return { ...s, plan: a.plan, period: a.period, kodeUsed: a.kodeUsed, toast: changed ? { id: ++toastId, text: a.plan === 'decouverte' ? 'Retour à Découverte' : 'Ton offre est active' } : s.toast };
    }
    case 'buyPack':
      return s.packs.includes(a.id) ? s : { ...s, packs: [...s.packs, a.id], toast: { id: ++toastId, text: 'Achat confirmé, c’est débloqué' } };
    case 'buyPlaces':
      return { ...s, extraPlaces: s.extraPlaces + 1, toast: { id: ++toastId, text: '+30 places ajoutées à ton dressing' } };
    case 'toggleModule': {
      // Affichée ou masquée, la section se range à la frontière des deux groupes.
      const m = s.modules.find((x) => x.id === a.id);
      if (!m) return s;
      const rest = s.modules.filter((x) => x.id !== a.id);
      return { ...s, modules: [...rest.filter((x) => x.on), { ...m, on: !m.on }, ...rest.filter((x) => !x.on)] };
    }
    case 'moveModule': {
      // On ne passe que par-dessus une section du même groupe : le déplacement se voit toujours à l'accueil.
      const i = s.modules.findIndex((m) => m.id === a.id);
      const j = i + a.by;
      if (i < 0 || j < 0 || j >= s.modules.length || s.modules[j].on !== s.modules[i].on) return s;
      const modules = [...s.modules];
      [modules[i], modules[j]] = [modules[j], modules[i]];
      return { ...s, modules };
    }
    case 'resetModules':
      return { ...s, modules: DEFAULT_MODULES };
    case 'density':
      return { ...s, density: a.value };
    case 'share':
      return { ...s, shares: [a.share, ...s.shares] };
    case 'toast':
      return { ...s, toast: { id: ++toastId, text: a.text, undo: a.undo, warn: a.warn } };
    case 'hideToast':
      return { ...s, toast: null, undo: null };
    case 'jobs': {
      // Les lignes relues remplacent celles de mêmes photos ; les autres photos restent suivies.
      const photos = new Set(a.jobs.map((j) => j.source_paths[0]));
      return { ...s, jobs: [...s.jobs.filter((j) => !photos.has(j.source_paths[0])), ...a.jobs] };
    }
    case 'pieces': {
      const known = new Set(s.pieces.map((p) => p.id));
      const arrived = a.pieces.filter((p) => !known.has(p.id));
      return {
        ...s,
        pieces: a.pieces,
        fresh: [...s.fresh, ...arrived.map((p) => p.id)],
        toast: arrived.length ? { id: ++toastId, text: arrived.length > 1 ? `${arrived.length} pièces rejoignent tes portants` : `${arrived[0].name} rejoint tes portants` } : s.toast,
      };
    }
    case 'landed':
      return { ...s, fresh: s.fresh.filter((id) => id !== a.id) };
    case 'dropJob':
      return { ...s, jobs: s.jobs.filter((j) => j.id !== a.id) };
    case 'contexte':
      return { ...s, contexte: a.contexte, contexteLu: a.at };
  }
}

/* ---- Ce qui est gardé sur le téléphone ---- */

const SAVED = 'dresskode:etat:v1';
/**
 * Une démo sauvegardée sur le téléphone avant le 07/10 reprend les photos et
 * les noms des pièces de démonstration ; ses ports et ses dates restent.
 */
function refreshDemo(pieces: Piece[]): Piece[] {
  const ref = new Map(PIECES.map((p) => [p.id, p]));
  const known = new Set(pieces.map((p) => p.id));
  const updated = pieces.map((p) => {
    const r = ref.get(p.id);
    return r?.image ? { ...p, name: r.name, color: r.color, swatch: r.swatch, material: r.material, tint: r.tint, image: r.image } : p;
  });
  return [...updated, ...PIECES.filter((p) => p.image && !known.has(p.id))];
}

const KEPT = ['onboarded', 'account', 'session', 'pendingEmail', 'profile', 'pieces', 'pendingPhotos', 'planned', 'events', 'trips', 'notifs', 'ecarts', 'journal', 'messages', 'kodeUsed', 'plan', 'period', 'extraPlaces', 'packs', 'modules', 'density', 'shares', 'contexte', 'contexteLu'] as const;

async function readSaved(): Promise<Partial<State> | null> {
  try {
    const raw = await AsyncStorage.getItem(SAVED);
    const v = raw ? (JSON.parse(raw) as Partial<State>) : null;
    return v && Array.isArray(v.pieces) && v.profile ? v : null;
  } catch {
    return null;
  }
}

const forget = () => AsyncStorage.removeItem(SAVED).catch(() => undefined);

/** Au lancement, le réseau a quelques secondes : au-delà, l'app s'ouvre sur le dernier état connu. */
const LANCEMENT_MS = 8000;
const aTemps = <T,>(p: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`pas de réponse en ${ms / 1000} s`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

/* ---- Actions ---- */

const OFFLINE = 'Ce changement n’a pas pu être enregistré. Vérifie ta connexion.';
const NETWORK = 'Pas de connexion. Réessaie quand tu as du réseau.';

type Undo = { kind: 'wear'; ids: string[] } | { kind: 'remove'; id: string } | null;

function useActions(dispatch: (a: Action) => void, getState: () => State) {
  const lastUndo = useRef<Undo>(null);
  const profileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useMemo(() => {
    /** La session, si l'état actuel est bien celui d'un compte connecté. */
    const live = () => {
      const s = getState();
      return s.account === 'connecte' ? s.session : null;
    };
    /** Enregistre sans bloquer ; en cas d'échec, un message le dit. */
    const sync = (job: Promise<unknown>) =>
      job.catch((e: unknown) => {
        console.warn('[supabase]', e instanceof Error ? e.message : e);
        dispatch({ t: 'toast', text: OFFLINE, warn: true });
      });

    /** Envoie un espace rempli sur ce téléphone vers le compte, puis relit tout. */
    const push = async (session: Session, profile: Profile, pieces: Piece[], planned: Record<Iso, Planned>, events: RdvEvent[] = [], trips: Trip[] = []) => {
      const ids = await remote.addPieces(session, pieces);
      const idOf = new Map(pieces.map((p, i) => [p.id, ids[i]]));
      const saved = pieces.map((p, i) => ({ ...p, id: ids[i] }));
      // Les voyages d'abord : leurs tenues y renvoient.
      for (const t of trips) await remote.saveTrip(session, t);
      for (const e of events) await remote.saveEvent(session, e);
      for (const [date, o] of Object.entries(planned)) {
        if (date < isoOf(0)) continue;
        await remote.plan(session, date, { ...o, pieces: o.pieces.map((id) => idOf.get(id) ?? id) }, saved);
      }
      // En dernier : le compte n'est marqué « rempli » qu'une fois tout arrivé.
      await remote.saveProfile(session, profile, true);
      const acc = await remote.loadAccount();
      if (acc) dispatch({ t: 'account', acc });
    };

    /**
     * Les photos du questionnaire partent chez Kodi, une fois le compte prêt :
     * l'agent repère et dessine leurs pièces, qui arrivent sur les portants
     * (suivies en tâche de fond, voir plus bas).
     */
    const sendPending = async (session: Session, photos: Photo[]) => {
      if (!photos.length) return;
      const r = await remote.sendPhotos(session, photos, '').catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : String(e) }));
      dispatch({ t: 'pendingPhotos', photos: [] });
      if (!r.ok) {
        console.warn('[supabase] photos du questionnaire :', r.message);
        return dispatch({ t: 'toast', text: 'Tes photos n’ont pas pu partir chez Kodi. Tu peux les ajouter depuis ton dressing.', warn: true });
      }
      dispatch({ t: 'jobs', jobs: r.jobs });
      dispatch({ t: 'toast', text: photos.length > 1 ? `Kodi dessine les pièces de tes ${photos.length} photos` : 'Kodi dessine les pièces de ta photo' });
    };

    return {
      completeOnboarding: (profile: Profile, pieces: Piece[], photos: Photo[] = []) => {
        const { session } = getState();
        dispatch({ t: 'onboard', profile: { ...profile, email: session?.email ?? profile.email }, pieces, photos });
        if (session) sync(push(session, profile, pieces, {}).then(() => sendPending(session, photos)));
      },

      /** Crée le compte. Sans confirmation d'e-mail demandée, la session s'ouvre tout de suite. */
      signUp: async (email: string, password: string, name: string): Promise<remote.Result<{ confirm: boolean }>> => {
        try {
          const r = await remote.signUp(email, password, name);
          if (!r.ok) return r;
          if (r.confirm) {
            dispatch({ t: 'session', session: null, pendingEmail: email.trim().toLowerCase() });
          } else {
            const acc = await remote.loadAccount();
            const s = getState();
            if (acc && !acc.onboarded && s.onboarded && s.account === 'nouveau') {
              // Compte créé après coup (depuis Moi ou l'ajout d'une pièce) : l'espace
              // rempli sur ce téléphone part sur le compte, puis les photos en attente.
              dispatch({ t: 'session', session: acc.session, pendingEmail: null });
              await push(acc.session, s.profile, s.pieces, s.planned, s.events, s.trips);
              await sendPending(acc.session, s.pendingPhotos);
            } else {
              dispatch({ t: 'session', session: acc?.session ?? null, pendingEmail: null });
            }
          }
          return r;
        } catch {
          return { ok: false, message: NETWORK };
        }
      },

      /**
       * Se connecte et relit le compte. Si ce téléphone a un espace rempli sans
       * compte et que le compte, lui, est vierge, l'espace part sur le compte.
       */
      signIn: async (email: string, password: string): Promise<remote.Result<{ next: 'app' | 'onboarding' }>> => {
        try {
          const r = await remote.signIn(email, password);
          if (!r.ok) return r;
          const acc = await remote.loadAccount();
          if (!acc) return { ok: false, message: 'Connexion ouverte, mais ton compte n’a pas pu être lu. Réessaie.' };
          const s = getState();
          if (!acc.onboarded && s.onboarded && s.account === 'nouveau') {
            dispatch({ t: 'session', session: acc.session, pendingEmail: null });
            await push(acc.session, s.profile, s.pieces, s.planned, s.events, s.trips);
            dispatch({ t: 'toast', text: 'Ton espace est enregistré sur ton compte' });
            // Les photos du questionnaire attendaient le compte : elles partent maintenant.
            await sendPending(acc.session, s.pendingPhotos);
            return { ok: true, next: 'app' };
          }
          dispatch({ t: 'account', acc });
          // Compte déjà rempli : l'espace du téléphone cède la place au compte,
          // mais les photos confiées au questionnaire partent quand même.
          if (acc.onboarded) await sendPending(acc.session, s.pendingPhotos);
          return { ok: true, next: acc.onboarded ? 'app' : 'onboarding' };
        } catch {
          return { ok: false, message: NETWORK };
        }
      },

      logout: async () => {
        if (getState().session) await remote.signOut();
        await forget();
        dispatch({ t: 'restart' });
      },
      loginDemo: () => dispatch({ t: 'demo' }),
      setProfile: (patch: Partial<Profile>) => {
        dispatch({ t: 'profile', patch });
        if (!live()) return;
        // Les règles et curseurs envoient beaucoup de petits changements : on enregistre une fois posés.
        if (profileTimer.current) clearTimeout(profileTimer.current);
        profileTimer.current = setTimeout(() => {
          const session = live();
          if (session) sync(remote.saveProfile(session, getState().profile));
        }, 700);
      },
      /** Prénom, nom, pseudonyme, ce qui s'affiche : enregistré avant d'être montré, pour qu'un pseudo pris ne se perde pas. */
      saveIdentity: async (patch: Pick<Profile, 'name' | 'lastName' | 'username' | 'nameDisplay'>): Promise<remote.Result> => {
        const session = live();
        if (session) {
          const r = await remote.saveIdentity(session, { ...getState().profile, ...patch });
          if (!r.ok) return r;
        }
        dispatch({ t: 'profile', patch });
        return { ok: true };
      },
      /** La photo de profil : sur le téléphone sans compte, dans l'espace avec un compte ; `null` la retire. */
      setAvatar: async (photo: Photo | null): Promise<remote.Result> => {
        const session = live();
        if (!photo) {
          if (session) sync(remote.removeAvatar(session));
          dispatch({ t: 'profile', patch: { avatar: null, avatarPath: null } });
          return { ok: true };
        }
        if (!session) {
          dispatch({ t: 'profile', patch: { avatar: photo.uri, avatarPath: null } });
          return { ok: true };
        }
        const r = await remote.uploadAvatar(session, photo);
        if (r.ok) dispatch({ t: 'profile', patch: { avatar: r.url, avatarPath: r.path } });
        return r;
      },
      restart: () => {
        forget();
        dispatch({ t: 'restart' });
      },

      /* ---- Tes données (RGPD, 09/10) ---- */

      /**
       * L'accord pour la taille, la silhouette et les mesures. Retiré, tout
       * cela est effacé, sur le téléphone comme dans le compte (la base le
       * fait aussi d'elle-même à la réception du retrait).
       */
      setBodyConsent: async (granted: boolean) => {
        const session = live();
        const patch: Partial<Profile> = granted
          ? { bodyConsent: new Date().toISOString() }
          : { bodyConsent: null, height: null, weight: null, silhouette: null, silhouetteSource: null, measures: {} };
        if (session) {
          try {
            await remote.saveConsent(session, 'silhouette', granted);
          } catch (e) {
            console.warn('[supabase] accord :', e instanceof Error ? e.message : e);
            dispatch({ t: 'toast', text: OFFLINE, warn: true });
            return false;
          }
        }
        dispatch({ t: 'profile', patch });
        if (session && !granted) sync(remote.saveProfile(session, { ...getState().profile, ...patch }));
        dispatch({ t: 'toast', text: granted ? 'Merci. Tu peux retirer ton accord à tout moment.' : 'Accord retiré : ta silhouette et tes mesures sont effacées' });
        return true;
      },
      /** Toutes tes données dans un fichier : le lien s'ouvre dans le navigateur. */
      exportData: async (): Promise<remote.Result> => {
        if (!live()) return { ok: false, message: 'Sans compte, tout reste sur ce téléphone : rien n’est gardé chez nous.' };
        const r = await remote.exportData().catch(() => ({ ok: false as const, message: NETWORK }));
        if (r.ok) await Linking.openURL(r.url);
        return r;
      },
      /** Supprime le compte pour de bon, puis repart de la bienvenue. */
      deleteAccount: async (): Promise<remote.Result> => {
        if (!live()) {
          await forget();
          dispatch({ t: 'restart' });
          dispatch({ t: 'toast', text: 'Ce téléphone est effacé' });
          return { ok: true };
        }
        const r = await remote.deleteAccount().catch(() => ({ ok: false as const, message: NETWORK }));
        if (!r.ok) return r;
        await remote.signOut().catch(() => undefined);
        await forget();
        dispatch({ t: 'restart' });
        dispatch({ t: 'toast', text: 'Ton compte et tes données sont effacés' });
        return { ok: true };
      },
      wear: (ids: string[], toast = 'Notée dans ton journal') => {
        dispatch({ t: 'wear', ids, toast });
        lastUndo.current = { kind: 'wear', ids };
        if (live()) sync(remote.wear(ids));
      },
      undo: () => {
        dispatch({ t: 'undo' });
        const u = lastUndo.current;
        lastUndo.current = null;
        if (!u || !live()) return;
        sync(u.kind === 'wear' ? remote.unwear(u.ids) : remote.setPieceStatus(u.id, 'active'));
      },
      nextOutfit: () => dispatch({ t: 'nextOutfit' }),
      /**
       * « Pas pour moi » : la tenue montrée est écartée, avec sa raison. Elle
       * ne revient plus ; la raison part chez Kodi avec le compte. Rend vrai
       * s'il reste d'autres tenues à proposer aujourd'hui.
       */
      ecarter: (pieces: string[], raison: Raison, cibles: string[] = [], proposee?: string[]) => {
        const ecart: Ecart = { id: newId(), date: isoOf(0), pieces, raison, cibles, ...(proposee && cleTenue(proposee) !== cleTenue(pieces) ? { proposee } : {}) };
        const before = getState();
        dispatch({ t: 'ecart', ecart });
        const session = live();
        if (session) sync(remote.saveEcart(session, ecart));
        // L'état n'est relu qu'au prochain rendu : la liste d'après se calcule ici.
        const left = todayOutfits(before.pieces, meteoDe(before).jours[0], evite(garder([ecart, ...before.ecarts])));
        const gone = new Set([cleTenue(pieces), ...(proposee ? [cleTenue(proposee)] : [])]);
        const more = left.some((o) => !gone.has(cleTenue(o.pieces)));
        dispatch({ t: 'toast', text: more ? 'Noté. Kodi ne te la proposera plus.' : 'Noté. Ajoute une pièce ou deux : Kodi aura plus de choix.' });
        return more;
      },
      addPiece: (piece: Piece) => {
        dispatch({ t: 'addPiece', piece });
        const session = live();
        if (session) sync(remote.addPieces(session, [piece]).then(([id]) => id && dispatch({ t: 'swapId', from: piece.id, to: id })));
      },
      /** L'étiquette corrigée à la main : enregistrée aussitôt, sur le compte s'il y en a un. */
      updatePiece: (piece: Piece) => {
        const before = getState().pieces.find((p) => p.id === piece.id);
        if (!before) return;
        dispatch({ t: 'updatePiece', piece });
        if (live()) sync(remote.updatePiece(piece.id, piece, before.category !== piece.category));
      },
      removePiece: (id: string) => {
        dispatch({ t: 'removePiece', id });
        lastUndo.current = { kind: 'remove', id };
        if (live()) sync(remote.setPieceStatus(id, 'archived'));
      },
      plan: (date: Iso, outfit: Planned, source: 'user' | 'kode' = 'user') => {
        dispatch({ t: 'plan', date, outfit });
        const session = live();
        if (session) sync(remote.plan(session, date, outfit, getState().pieces, source));
      },
      unplan: (date: Iso) => {
        dispatch({ t: 'unplan', date });
        const session = live();
        if (session) sync(remote.unplan(session, date));
      },
      /** Un rendez-vous créé ou corrigé ; il garde son identifiant, le même en base. */
      saveEvent: (event: RdvEvent) => {
        dispatch({ t: 'saveEvent', event });
        const session = live();
        if (session) sync(remote.saveEvent(session, event));
      },
      removeEvent: (id: string) => {
        dispatch({ t: 'removeEvent', id });
        if (live()) sync(remote.removeEvent(id));
      },
      /** Un voyage et ses tenues, un jour après l'autre. */
      saveTrip: (trip: Trip, days: Record<Iso, Planned> = {}) => {
        const tagged = Object.fromEntries(Object.entries(days).map(([d, o]) => [d, { ...o, tripId: trip.id }]));
        dispatch({ t: 'saveTrip', trip, days: tagged });
        const session = live();
        if (session)
          sync(
            (async () => {
              await remote.saveTrip(session, trip);
              for (const [d, o] of Object.entries(tagged)) await remote.plan(session, d, o, getState().pieces);
            })(),
          );
      },
      removeTrip: (id: string) => {
        dispatch({ t: 'removeTrip', id });
        if (live()) sync(remote.removeTrip(id));
      },
      setNotifs: (choice: NotifChoice) => {
        dispatch({ t: 'notifs', choice });
        const session = live();
        if (session) sync(remote.saveNotifs(session, choice));
      },
      askKode: (text: string) => {
        const s = getState();
        const quota = LIMITS[s.plan].questions;
        if (quota !== null && s.kodeUsed >= quota) return false;
        dispatch({ t: 'ask', message: { id: `m${Date.now()}`, from: 'me', text } });
        if (live()) {
          // Kodi répond depuis la fonction `kode` ; sans réponse, la question ne compte pas.
          remote
            .askKode(text)
            .then(({ reply: { id, ...reply }, counted }) => dispatch({ t: 'answer', message: { id: id ?? `k${Date.now()}`, from: 'kode', ...reply }, refund: !counted }))
            .catch(() => dispatch({ t: 'answer', message: { id: `k${Date.now()}`, from: 'kode', text: NETWORK }, refund: true }));
          return true;
        }
        const reply = kodeReply(text, s.pieces, s.profile);
        // Le temps de « réfléchir » : assez pour lire l'état, jamais assez pour agacer.
        setTimeout(() => dispatch({ t: 'answer', message: { id: `k${Date.now()}`, from: 'kode', ...reply } }), 1100);
        return true;
      },
      setPlan: (plan: PlanId, period: Period) => {
        if (!live()) return dispatch({ t: 'setPlan', plan, period });
        // Rien n'est accordé ici : l'offre change quand Stripe confirme (webhook), relue au retour dans l'app.
        remote
          .billing(plan, period)
          .then((r) => {
            if (!r.ok) return dispatch({ t: 'toast', text: r.message, warn: true });
            dispatch({ t: 'toast', text: 'Le paiement sécurisé s’ouvre dans ton navigateur' });
            return Linking.openURL(r.url);
          })
          .catch(() => dispatch({ t: 'toast', text: NETWORK, warn: true }));
      },
      buyPack: (id: string) => (live() ? dispatch({ t: 'toast', text: 'Les achats à l’unité arrivent bientôt' }) : dispatch({ t: 'buyPack', id })),
      buyPlaces: () => (live() ? dispatch({ t: 'toast', text: 'Les achats à l’unité arrivent bientôt' }) : dispatch({ t: 'buyPlaces' })),
      toggleModule: (id: HomeModule) => dispatch({ t: 'toggleModule', id }),
      moveModule: (id: HomeModule, by: -1 | 1) => dispatch({ t: 'moveModule', id, by }),
      resetModules: () => dispatch({ t: 'resetModules' }),
      setDensity: (value: State['density']) => dispatch({ t: 'density', value }),
      share: (share: Share) => dispatch({ t: 'share', share }),
      toast: (text: string, warn?: boolean) => dispatch({ t: 'toast', text, warn }),
      hideToast: () => dispatch({ t: 'hideToast' }),

      /** Sans compte : les photos attendent sur le téléphone (10 au plus) et partent à sa création. */
      queuePhotos: (photos: Photo[]) => dispatch({ t: 'pendingPhotos', photos: [...getState().pendingPhotos, ...photos].slice(0, 10) }),
      /** Confie des photos à Kodi ; rend les chemins des photos à suivre. */
      sendPhotos: async (photos: Photo[], hint: string): Promise<remote.Result<{ paths: string[] }>> => {
        const session = live();
        if (!session) return { ok: false, message: 'Connecte-toi pour confier tes photos à Kodi.' };
        const r = await remote.sendPhotos(session, photos, hint);
        if (!r.ok) return r;
        dispatch({ t: 'jobs', jobs: r.jobs });
        return { ok: true, paths: r.paths };
      },
      /** Relit l'état des photos suivies (l'écran d'ajout le fait toutes les deux secondes). */
      readJobs: async (paths: string[]) => {
        lastJobsRead = Date.now();
        const jobs = await remote.readJobs(paths);
        dispatch({ t: 'jobs', jobs });
        return jobs;
      },
      retryJob: async (id: string) => {
        const r = await remote.retryJob(id).catch(() => ({ ok: false as const, message: NETWORK }));
        if (!r.ok) dispatch({ t: 'toast', text: r.message, warn: true });
      },
      dismissJob: async (id: string) => {
        const r = await remote.dismissJob(id).catch(() => ({ ok: false as const, message: NETWORK }));
        if (!r.ok) return dispatch({ t: 'toast', text: r.message, warn: true });
        dispatch({ t: 'dropJob', id });
      },
      /** Relit les pièces : celles que Kodi vient de ranger apparaissent, avec leur vignette. */
      refreshPieces: async () => {
        const session = live();
        if (!session) return;
        try {
          dispatch({ t: 'pieces', pieces: await remote.loadPieces(session.spaceId) });
        } catch (e) {
          console.warn('[supabase] pièces :', e instanceof Error ? e.message : e);
        }
      },
      /** Une pièce nouvelle a fait son entrée sur la tringle : elle ne la refera pas. */
      landed: (id: string) => dispatch({ t: 'landed', id }),
      /** Relit les données du jour pour la ville du profil (compte connecté seulement). Sans réponse, le dernier paquet reste. */
      refreshContexte: async () => {
        if (!live()) return;
        const c = await remote.loadContexte(getState().profile.city).catch(() => null);
        if (c && live()) dispatch({ t: 'contexte', contexte: c, at: Date.now() });
      },
    };
  }, [dispatch, getState]);
}

type Actions = ReturnType<typeof useActions>;
const StoreContext = createContext<{ s: State; a: Actions } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, dispatch] = useReducer(reducer, initial);
  const ref = useRef(s);
  ref.current = s;
  const a = useActions(dispatch, useMemo(() => () => ref.current, []));
  const aRef = useRef(a);
  aRef.current = a;
  const value = useMemo(() => ({ s, a }), [s, a]);

  // Compte connecté : les données du jour à l'ouverture, et de nouveau quand la ville change
  // (après une courte pause, le temps de finir de la taper).
  const city = s.profile.city;
  const spaceId = s.account === 'connecte' ? s.session?.spaceId : undefined;
  useEffect(() => {
    if (!spaceId) return;
    const t = setTimeout(() => a.refreshContexte(), 800);
    return () => clearTimeout(t);
  }, [spaceId, city, a]);

  // Au lancement : le compte en ligne s'il y a une session, sinon l'espace gardé sur le téléphone.
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await readSaved();
      if (supabase) {
        try {
          const acc = await aTemps(remote.loadAccount(), LANCEMENT_MS);
          if (!alive) return;
          if (acc) {
            dispatch({ t: 'account', acc });
            // Le dernier paquet du même espace s'affiche tout de suite, le neuf arrive ensuite.
            if (saved?.contexte && saved.session?.spaceId === acc.session.spaceId) dispatch({ t: 'contexte', contexte: saved.contexte, at: saved.contexteLu ?? 0 });
            return;
          }
          // Plus de session : ce qui avait été relu d'un compte n'a plus à rester ici.
          if (saved?.account === 'connecte') {
            forget();
            return dispatch({ t: 'hydrate', patch: {} });
          }
        } catch (e) {
          console.warn('[supabase] lancement :', e instanceof Error ? e.message : e);
          // Hors ligne : on reprend le dernier état connu, les changements échoueront avec un message.
          if (alive && saved?.account === 'connecte') {
            dispatch({ t: 'hydrate', patch: saved });
            return dispatch({ t: 'toast', text: 'Hors connexion : voici ton dressing tel que tu l’as laissé', warn: true });
          }
        }
      }
      if (alive) dispatch({ t: 'hydrate', patch: saved?.account === 'connecte' ? {} : (saved ?? {}) });
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Garde l'état sur le téléphone (jamais le compte de démonstration).
  useEffect(() => {
    if (s.booting || s.account === 'demo') return;
    const t = setTimeout(() => {
      const kept = Object.fromEntries(KEPT.map((k) => [k, s[k]]));
      AsyncStorage.setItem(SAVED, JSON.stringify(kept)).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [s]);

  // Retour dans l'app (après un paiement, par exemple) : l'offre et le compteur de Kodi sont relus.
  useEffect(() => {
    if (!supabase) return;
    const sub = AppState.addEventListener('change', (state) => {
      const cur = ref.current;
      if (state !== 'active' || cur.account !== 'connecte' || !cur.session) return;
      remote.loadPlan(cur.session.spaceId).then((p) => dispatch({ t: 'planSync', ...p })).catch(() => undefined);
      // Fraîcheur « économe » : la météo est relue au plus une fois par heure, ou dès qu'un nouveau jour commence.
      if (Date.now() - cur.contexteLu > RELIRE_APRES || cur.contexte?.jour !== jourIso(0)) aRef.current?.refreshContexte();
    });
    // Session révoquée ailleurs (mot de passe changé, compte supprimé) : retour à l'accueil.
    const auth = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && ref.current.session) {
        forget();
        dispatch({ t: 'restart' });
      }
    });
    return () => {
      sub.remove();
      auth.data.subscription.unsubscribe();
    };
  }, []);

  // Tant que Kodi travaille sur une photo, on suit ses pièces même hors de l'écran
  // d'ajout ; quand tout est rangé, le dressing est relu une fois.
  const working = s.jobs.some(isActive);
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active' || Date.now() - lastJobsRead < 3000) return;
      const paths = [...new Set(ref.current.jobs.filter(isActive).map((j) => j.source_paths[0]))];
      remote.readJobs(paths).then((jobs) => dispatch({ t: 'jobs', jobs })).catch(() => undefined);
    }, 4000);
    return () => {
      clearInterval(timer);
      a.refreshPieces();
    };
  }, [working, a]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore hors de StoreProvider');
  return v;
}

/* ---- Valeurs dérivées : un seul endroit pour les calculer ---- */

export const pieceLimit = (s: State) => {
  const base = LIMITS[s.plan].pieces;
  return base === null ? null : base + s.extraPlaces * 30;
};

export const questionsLeft = (s: State) => {
  const q = LIMITS[s.plan].questions;
  return q === null ? null : Math.max(0, q - s.kodeUsed);
};

/** Part des pièces portées ces 90 derniers jours : l'indicateur « porte mieux ». */
export const usageRate = (pieces: Piece[]) =>
  pieces.length ? Math.round((pieces.filter((p) => p.lastWorn !== null && p.lastWorn <= 90).length / pieces.length) * 100) : 0;

/** Les pièces qui dorment : jamais portées ou pas depuis deux mois, mais pas celles qu'on vient d'ajouter. */
export const sleeping = (pieces: Piece[]) =>
  pieces.filter((p) => p.addedDaysAgo >= 30 && (p.lastWorn === null || p.lastWorn > 60)).sort((a, b) => (b.lastWorn ?? 9999) - (a.lastWorn ?? 9999));

/** Les événements visibles : seulement si l'agenda est relié. */
/** Les rendez-vous d'un jour, par heure. */
export const eventsOn = (events: RdvEvent[], date: Iso) => events.filter((e) => e.date === date).sort((x, z) => (x.time ?? '99').localeCompare(z.time ?? '99'));

/**
 * L'ancien état gardé comptait les jours depuis aujourd'hui (« 1 » : demain) ;
 * il devient une date, au mieux : relue au lancement, elle vaut pour ce jour-là.
 */
function normalizePlanned(planned: Record<string, Planned>): Record<Iso, Planned> {
  return Object.fromEntries(Object.entries(planned).map(([k, o]) => [/^-?\d+$/.test(k) ? isoOf(Number(k)) : k, o]));
}

/** Le compte de démonstration : les rendez-vous d'Alice, datés à partir d'aujourd'hui. */
function demoEvents(): RdvEvent[] {
  const time = (t: string) => {
    const m = t.match(/(\d+) h(?: (\d+))?/);
    return m ? `${m[1].padStart(2, '0')}:${(m[2] ?? '00').padStart(2, '0')}` : null;
  };
  const extra: Record<string, Partial<RdvEvent>> = {
    e1: { kind: 'Rendez-vous client', stake: 'Important', dressCode: 'Business' },
    e2: { kind: 'Rendez-vous entre amis', stake: 'Tranquille', dressCode: 'Casual chic', setting: 'Intérieur' },
    e3: { kind: 'Sport', stake: 'Tranquille', dressCode: 'Sportswear' },
    e4: { kind: 'Présentation', stake: 'Décisif', dressCode: 'Business', impressions: ['Confiance', 'Sérieux'] },
    e5: { kind: 'Mariage (invité)', stake: 'Important', dressCode: 'Chic', setting: 'Les deux', constraints: ['Danser', 'Debout longtemps'] },
    e6: { kind: 'Repas de famille', stake: 'Tranquille', dressCode: 'Décontracté' },
  };
  return EVENTS.map((e) => ({
    id: e.id,
    date: isoOf(e.day),
    time: time(e.time),
    title: e.title,
    kind: null,
    dressCode: e.occasion?.dressCode ?? null,
    stake: null,
    impressions: [],
    place: e.place ?? null,
    setting: null,
    constraints: [],
    note: e.occasion?.details ?? null,
    ...extra[e.id],
  }));
}

export { newId };

/**
 * La météo à afficher : la vraie (fonction `donnees`) pour un compte
 * connecté, la simulée en démonstration et sans compte. `jours[i]` est le
 * jour à `i` jours d'aujourd'hui, null quand il n'y a pas de prévision.
 */
export function meteoDe(s: Pick<State, 'account' | 'contexte'>): { jours: (Weather | null)[]; now: { t: number; kind: Weather['kind']; mot?: string } | null; reelle: boolean } {
  if (s.account !== 'connecte') return { jours: WEATHER, now: { t: WEATHER[0].t, kind: WEATHER[0].kind }, reelle: false };
  return { jours: semaine(s.contexte), now: maintenant(s.contexte), reelle: true };
}

export const useMeteo = () => {
  const { s } = useStore();
  return useMemo(() => meteoDe(s), [s.account, s.contexte]);
};

/** Les tenues du jour de ce dressing (écrites à la main pour la démo, composées sinon), selon la météo du jour. */
export const useTodayOutfits = () => {
  const { s } = useStore();
  const today = useMeteo().jours[0];
  return useMemo(() => todayOutfits(s.pieces, today, evite(s.ecarts)), [s.pieces, today, s.ecarts]);
};

export { precision } from './profile';

export type { State, KodeOutfit };
