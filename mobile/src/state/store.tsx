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
import type { Account, PlanId, Period, Photo, Planned, Session } from './remote';
import { isActive, type JobRow } from './jobs';
import { RELIRE_APRES, jourIso, maintenant, semaine, type Contexte } from './contexte';

export type { PlanId, Period, Planned, Session };
export type { Silhouette, MeasureId, Profile } from './profile';
export type HomeModule = 'kode' | 'semaine' | 'oubliees' | 'tendance' | 'bilan';
export type Share = { id: string; pieceId: string; friend: string; mode: 'montrer' | 'preter' | 'donner' };
export type Toast = { id: number; text: string; undo?: boolean; warn?: boolean };

/** Mêmes valeurs que public.plan_limits() côté base. null : sans limite. */
export const LIMITS: Record<PlanId, { pieces: number | null; questions: number | null }> = {
  decouverte: { pieces: 30, questions: 5 },
  capsule: { pieces: 60, questions: 20 },
  atelier: { pieces: 200, questions: null },
  couture: { pieces: null, questions: null },
};

export const MODULE_LABELS: Record<HomeModule, { title: string; note: string }> = {
  kode: { title: 'Demander à Kode', note: 'Des questions prêtes, selon ta journée' },
  semaine: { title: 'Ta semaine', note: 'Météo et événements, jour par jour' },
  oubliees: { title: 'À redécouvrir', note: 'Les pièces qui dorment' },
  tendance: { title: 'Tendance, déjà chez toi', note: 'Ce qui se porte, dans ton dressing' },
  bilan: { title: 'Ton mois', note: 'Ce que tu portes vraiment' },
};

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
  planned: Record<number, Planned>;
  messages: KodeMessage[];
  kodeUsed: number;
  kodeTyping: boolean;
  plan: PlanId;
  period: Period;
  extraPlaces: number;
  packs: string[];
  modules: { id: HomeModule; on: boolean }[];
  density: 'aeree' | 'dense';
  shares: Share[];
  toast: Toast | null;
  undo: Piece[] | null;
  /** Les photos confiées à Kode pendant cette session, et leurs pièces. */
  jobs: JobRow[];
  /**
   * Photos choisies pendant le questionnaire, avant que le compte existe :
   * elles partent chez Kode dès que la session s'ouvre (création du compte,
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
  messages: [],
  kodeUsed: 0,
  kodeTyping: false,
  plan: 'decouverte',
  period: 'mois',
  extraPlaces: 0,
  packs: [],
  modules: [
    { id: 'kode', on: true },
    { id: 'semaine', on: true },
    { id: 'oubliees', on: true },
    { id: 'tendance', on: true },
    { id: 'bilan', on: false },
  ],
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

/** Le compte d'Alice : 37 pièces, deux tenues prévues, l'offre Capsule entamée. */
const demo: State = {
  ...fresh,
  onboarded: true,
  account: 'demo',
  profile: DEMO_PROFILE,
  pieces: PIECES,
  planned: {
    1: { title: 'Noir sur noir, mais doux', pieces: ['r1', 'm2', 'c5', 'a2'] },
    4: { title: 'Net, sans raideur', pieces: ['m2', 'h5', 'b4', 'c2', 'a1'] },
  },
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
  | { t: 'plan'; day: number; outfit: Planned }
  | { t: 'unplan'; day: number }
  | { t: 'ask'; message: KodeMessage }
  | { t: 'answer'; message: KodeMessage; refund?: boolean }
  | { t: 'setPlan'; plan: PlanId; period: Period }
  | { t: 'planSync'; plan: PlanId; period: Period; kodeUsed: number }
  | { t: 'buyPack'; id: string }
  | { t: 'buyPlaces' }
  | { t: 'toggleModule'; id: HomeModule }
  | { t: 'moveModule'; id: HomeModule; by: -1 | 1 }
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
/** Dernière lecture des tâches de Kode : l'écran d'ajout lit toutes les 2 s, le suivi de fond n'a pas à doubler. */
let lastJobsRead = 0;

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case 'hydrate':
      return { ...s, ...a.patch, booting: false };
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
        pieces: s.pieces.map((p) => (ids.has(p.id) ? { ...p, wears: p.wears + 1, lastWorn: 0 } : p)),
        toast: { id: ++toastId, text: a.toast, undo: true },
      };
    }
    case 'undo':
      return s.undo ? { ...s, pieces: s.undo, undo: null, wornToday: null, toast: null } : s;
    case 'nextOutfit':
      return { ...s, outfitIndex: (s.outfitIndex + 1) % Math.max(1, todayOutfits(s.pieces, meteoDe(s).jours[0]).length), wornToday: null };
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
      return { ...s, planned: { ...s.planned, [a.day]: a.outfit } };
    case 'unplan': {
      const planned = { ...s.planned };
      delete planned[a.day];
      return { ...s, planned };
    }
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
    case 'toggleModule':
      return { ...s, modules: s.modules.map((m) => (m.id === a.id ? { ...m, on: !m.on } : m)) };
    case 'moveModule': {
      const i = s.modules.findIndex((m) => m.id === a.id);
      const j = i + a.by;
      if (i < 0 || j < 0 || j >= s.modules.length) return s;
      const modules = [...s.modules];
      [modules[i], modules[j]] = [modules[j], modules[i]];
      return { ...s, modules };
    }
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
const KEPT = ['onboarded', 'account', 'session', 'pendingEmail', 'profile', 'pieces', 'pendingPhotos', 'planned', 'messages', 'kodeUsed', 'plan', 'period', 'extraPlaces', 'packs', 'modules', 'density', 'shares', 'contexte', 'contexteLu'] as const;

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
    const push = async (session: Session, profile: Profile, pieces: Piece[], planned: Record<number, Planned>) => {
      const ids = await remote.addPieces(session, pieces);
      const idOf = new Map(pieces.map((p, i) => [p.id, ids[i]]));
      const saved = pieces.map((p, i) => ({ ...p, id: ids[i] }));
      for (const [day, o] of Object.entries(planned)) {
        if (Number(day) < 0) continue;
        await remote.plan(session, Number(day), { ...o, pieces: o.pieces.map((id) => idOf.get(id) ?? id) }, saved);
      }
      // En dernier : le compte n'est marqué « rempli » qu'une fois tout arrivé.
      await remote.saveProfile(session, profile, true);
      const acc = await remote.loadAccount();
      if (acc) dispatch({ t: 'account', acc });
    };

    /**
     * Les photos du questionnaire partent chez Kode, une fois le compte prêt :
     * l'agent repère et dessine leurs pièces, qui arrivent sur les portants
     * (suivies en tâche de fond, voir plus bas).
     */
    const sendPending = async (session: Session, photos: Photo[]) => {
      if (!photos.length) return;
      const r = await remote.sendPhotos(session, photos, '').catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : String(e) }));
      dispatch({ t: 'pendingPhotos', photos: [] });
      if (!r.ok) {
        console.warn('[supabase] photos du questionnaire :', r.message);
        return dispatch({ t: 'toast', text: 'Tes photos n’ont pas pu partir chez Kode. Tu peux les ajouter depuis ton dressing.', warn: true });
      }
      dispatch({ t: 'jobs', jobs: r.jobs });
      dispatch({ t: 'toast', text: photos.length > 1 ? `Kode dessine les pièces de tes ${photos.length} photos` : 'Kode dessine les pièces de ta photo' });
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
              await push(acc.session, s.profile, s.pieces, s.planned);
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
            await push(acc.session, s.profile, s.pieces, s.planned);
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
      restart: () => {
        forget();
        dispatch({ t: 'restart' });
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
      plan: (day: number, outfit: Planned) => {
        dispatch({ t: 'plan', day, outfit });
        const session = live();
        if (session) sync(remote.plan(session, day, outfit, getState().pieces));
      },
      unplan: (day: number) => {
        dispatch({ t: 'unplan', day });
        const session = live();
        if (session) sync(remote.unplan(session, day));
      },
      askKode: (text: string) => {
        const s = getState();
        const quota = LIMITS[s.plan].questions;
        if (quota !== null && s.kodeUsed >= quota) return false;
        dispatch({ t: 'ask', message: { id: `m${Date.now()}`, from: 'me', text } });
        if (live()) {
          // Kode répond depuis la fonction `kode` ; sans réponse, la question ne compte pas.
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
      setDensity: (value: State['density']) => dispatch({ t: 'density', value }),
      share: (share: Share) => dispatch({ t: 'share', share }),
      toast: (text: string, warn?: boolean) => dispatch({ t: 'toast', text, warn }),
      hideToast: () => dispatch({ t: 'hideToast' }),

      /** Sans compte : les photos attendent sur le téléphone (10 au plus) et partent à sa création. */
      queuePhotos: (photos: Photo[]) => dispatch({ t: 'pendingPhotos', photos: [...getState().pendingPhotos, ...photos].slice(0, 10) }),
      /** Confie des photos à Kode ; rend les chemins des photos à suivre. */
      sendPhotos: async (photos: Photo[], hint: string): Promise<remote.Result<{ paths: string[] }>> => {
        const session = live();
        if (!session) return { ok: false, message: 'Connecte-toi pour confier tes photos à Kode.' };
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
      /** Relit les pièces : celles que Kode vient de ranger apparaissent, avec leur vignette. */
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

  // Retour dans l'app (après un paiement, par exemple) : l'offre et le compteur de Kode sont relus.
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

  // Tant que Kode travaille sur une photo, on suit ses pièces même hors de l'écran
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
export const eventsOf = (profile: Profile) => (profile.agenda ? EVENTS : []);

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
  return useMemo(() => todayOutfits(s.pieces, today), [s.pieces, today]);
};

export { precision } from './profile';

export type { State, KodeOutfit };
