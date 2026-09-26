/**
 * L'état de l'app de démonstration, en mémoire. Chaque action de
 * l'interface passe par ici, pour qu'un bouton fasse toujours quelque
 * chose de vérifiable : porter une tenue fait monter les compteurs,
 * ajouter une pièce consomme une place, une question consomme le quota.
 */
import { createContext, useContext, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { PIECES, TODAY_OUTFITS, type Piece } from '../data/wardrobe';
import { kodeReply, type KodeMessage, type KodeOutfit } from './kode';

export type PlanId = 'decouverte' | 'capsule' | 'atelier' | 'couture';
export type Period = 'mois' | 'an';
export type Silhouette = 'A' | 'V' | 'H' | 'X' | 'O' | 'inconnue';
export type MeasureId = 'hauteur' | 'poitrine' | 'taille' | 'hanches' | 'pointure';
export type HomeModule = 'kode' | 'semaine' | 'oubliees' | 'tendance' | 'bilan';
export type Planned = { title: string; pieces: string[] };
export type Share = { id: string; pieceId: string; friend: string; mode: 'montrer' | 'preter' | 'donner' };
export type Toast = { id: number; text: string; undo?: boolean };

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
  onboarded: boolean;
  name: string;
  silhouette: Silhouette | null;
  measures: Partial<Record<MeasureId, number>>;
  styles: string[];
  colors: string[];
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
};

const initial: State = {
  onboarded: false,
  name: 'Alice',
  silhouette: 'X',
  measures: { hauteur: 166, pointure: 38 },
  styles: ['Minimal', 'Classique'],
  colors: ['Camel', 'Marine', 'Blanc'],
  pieces: PIECES,
  outfitIndex: 0,
  wornToday: null,
  planned: {
    1: { title: 'Noir sur noir, mais doux', pieces: ['r1', 'm2', 'c5', 'a2'] },
    4: { title: 'Net, sans raideur', pieces: ['m2', 'h5', 'b4', 'c2', 'a1'] },
  },
  messages: [],
  kodeUsed: 12,
  kodeTyping: false,
  plan: 'capsule',
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
};

type Action =
  | { t: 'onboard'; silhouette: Silhouette | null; measures: State['measures']; styles: string[]; colors: string[] }
  | { t: 'restart' }
  | { t: 'wear'; ids: string[]; toast: string }
  | { t: 'undo' }
  | { t: 'nextOutfit' }
  | { t: 'addPiece'; piece: Piece }
  | { t: 'removePiece'; id: string }
  | { t: 'plan'; day: number; outfit: Planned }
  | { t: 'unplan'; day: number }
  | { t: 'ask'; message: KodeMessage }
  | { t: 'answer'; message: KodeMessage }
  | { t: 'setPlan'; plan: PlanId; period: Period }
  | { t: 'buyPack'; id: string }
  | { t: 'buyPlaces' }
  | { t: 'toggleModule'; id: HomeModule }
  | { t: 'moveModule'; id: HomeModule; by: -1 | 1 }
  | { t: 'density'; value: State['density'] }
  | { t: 'share'; share: Share }
  | { t: 'silhouette'; value: Silhouette | null }
  | { t: 'measure'; id: MeasureId; value: number | undefined }
  | { t: 'toast'; text: string; undo?: boolean }
  | { t: 'hideToast' };

let toastId = 0;

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case 'onboard':
      return { ...s, onboarded: true, silhouette: a.silhouette, measures: a.measures, styles: a.styles, colors: a.colors };
    case 'restart':
      return { ...initial };
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
      return { ...s, outfitIndex: (s.outfitIndex + 1) % TODAY_OUTFITS.length, wornToday: null };
    case 'addPiece':
      return { ...s, pieces: [a.piece, ...s.pieces], toast: { id: ++toastId, text: `${a.piece.name} rejoint tes portants` } };
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
      return { ...s, messages: [...s.messages, a.message], kodeTyping: false };
    case 'setPlan':
      return { ...s, plan: a.plan, period: a.period, toast: { id: ++toastId, text: a.plan === 'decouverte' ? 'Retour à Découverte' : 'Ton offre est active' } };
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
    case 'silhouette':
      return { ...s, silhouette: a.value };
    case 'measure':
      return { ...s, measures: { ...s.measures, [a.id]: a.value } };
    case 'toast':
      return { ...s, toast: { id: ++toastId, text: a.text, undo: a.undo } };
    case 'hideToast':
      return { ...s, toast: null, undo: null };
  }
}

function useActions(dispatch: (a: Action) => void, getState: () => State) {
  return useMemo(
    () => ({
      completeOnboarding: (d: Omit<Extract<Action, { t: 'onboard' }>, 't'>) => dispatch({ t: 'onboard', ...d }),
      restart: () => dispatch({ t: 'restart' }),
      wear: (ids: string[], toast = 'Notée dans ton journal') => dispatch({ t: 'wear', ids, toast }),
      undo: () => dispatch({ t: 'undo' }),
      nextOutfit: () => dispatch({ t: 'nextOutfit' }),
      addPiece: (piece: Piece) => dispatch({ t: 'addPiece', piece }),
      removePiece: (id: string) => dispatch({ t: 'removePiece', id }),
      plan: (day: number, outfit: Planned) => dispatch({ t: 'plan', day, outfit }),
      unplan: (day: number) => dispatch({ t: 'unplan', day }),
      askKode: (text: string) => {
        const s = getState();
        const quota = LIMITS[s.plan].questions;
        if (quota !== null && s.kodeUsed >= quota) return false;
        dispatch({ t: 'ask', message: { id: `m${Date.now()}`, from: 'me', text } });
        const reply = kodeReply(text, s.pieces);
        // Le temps de « réfléchir » : assez pour lire l'état, jamais assez pour agacer.
        setTimeout(() => dispatch({ t: 'answer', message: { id: `k${Date.now()}`, from: 'kode', ...reply } }), 1100);
        return true;
      },
      setPlan: (plan: PlanId, period: Period) => dispatch({ t: 'setPlan', plan, period }),
      buyPack: (id: string) => dispatch({ t: 'buyPack', id }),
      buyPlaces: () => dispatch({ t: 'buyPlaces' }),
      toggleModule: (id: HomeModule) => dispatch({ t: 'toggleModule', id }),
      moveModule: (id: HomeModule, by: -1 | 1) => dispatch({ t: 'moveModule', id, by }),
      setDensity: (value: State['density']) => dispatch({ t: 'density', value }),
      share: (share: Share) => dispatch({ t: 'share', share }),
      setSilhouette: (value: Silhouette | null) => dispatch({ t: 'silhouette', value }),
      setMeasure: (id: MeasureId, value: number | undefined) => dispatch({ t: 'measure', id, value }),
      toast: (text: string) => dispatch({ t: 'toast', text }),
      hideToast: () => dispatch({ t: 'hideToast' }),
    }),
    [dispatch, getState],
  );
}

type Actions = ReturnType<typeof useActions>;
const StoreContext = createContext<{ s: State; a: Actions } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, dispatch] = useReducer(reducer, initial);
  const ref = useRef(s);
  ref.current = s;
  const a = useActions(dispatch, useMemo(() => () => ref.current, []));
  const value = useMemo(() => ({ s, a }), [s, a]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore hors de StoreProvider');
  return v;
}

/* ——— Valeurs dérivées : un seul endroit pour les calculer ——— */

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

export const sleeping = (pieces: Piece[]) =>
  pieces.filter((p) => p.lastWorn === null || p.lastWorn > 60).sort((a, b) => (b.lastWorn ?? 9999) - (a.lastWorn ?? 9999));

/** Précision de Kode : ce que la silhouette et les mesures lui apprennent. */
export function precision(s: Pick<State, 'silhouette' | 'measures' | 'styles' | 'colors'>) {
  let score = 20;
  if (s.silhouette && s.silhouette !== 'inconnue') score += 20;
  const m = s.measures;
  score += (m.hauteur ? 10 : 0) + (m.poitrine ? 12 : 0) + (m.taille ? 12 : 0) + (m.hanches ? 12 : 0) + (m.pointure ? 4 : 0);
  score += s.styles.length ? 5 : 0;
  score += s.colors.length ? 5 : 0;
  return Math.min(100, score);
}

export type { State, KodeOutfit };
