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
import { EVENTS, PIECES, type Piece } from '../data/wardrobe';
import { supabase } from '../lib/supabase';
import { kodeReply, type KodeMessage, type KodeOutfit } from './kode';
import { todayOutfits } from './outfits';
import { DEMO_PROFILE, EMPTY_PROFILE, type Profile } from './profile';
import * as remote from './remote';
import type { Account, PlanId, Period, Planned, Session } from './remote';

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
  | { t: 'onboard'; profile: Profile; pieces: Piece[] }
  | { t: 'demo' }
  | { t: 'profile'; patch: Partial<Profile> }
  | { t: 'restart' }
  | { t: 'wear'; ids: string[]; toast: string }
  | { t: 'undo' }
  | { t: 'nextOutfit' }
  | { t: 'addPiece'; piece: Piece }
  | { t: 'swapId'; from: string; to: string }
  | { t: 'removePiece'; id: string }
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
  | { t: 'hideToast' };

let toastId = 0;

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
      };
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
      return { ...s, outfitIndex: (s.outfitIndex + 1) % Math.max(1, todayOutfits(s.pieces).length), wornToday: null };
    case 'addPiece':
      return { ...s, pieces: [a.piece, ...s.pieces], toast: { id: ++toastId, text: `${a.piece.name} rejoint tes portants` } };
    case 'swapId': {
      // La base a donné son identifiant à une pièce ajoutée : on le reporte partout où elle apparaît.
      const swap = (id: string) => (id === a.from ? a.to : id);
      const planned = Object.fromEntries(Object.entries(s.planned).map(([d, o]) => [d, { ...o, pieces: o.pieces.map(swap) }]));
      return { ...s, pieces: s.pieces.map((p) => (p.id === a.from ? { ...p, id: a.to } : p)), planned, undo: s.undo?.map((p) => (p.id === a.from ? { ...p, id: a.to } : p)) ?? null };
    }
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
  }
}

/* ——— Ce qui est gardé sur le téléphone ——— */

const SAVED = 'dresskode:etat:v1';
const KEPT = ['onboarded', 'account', 'session', 'pendingEmail', 'profile', 'pieces', 'planned', 'messages', 'kodeUsed', 'plan', 'period', 'extraPlaces', 'packs', 'modules', 'density', 'shares'] as const;

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

/* ——— Actions ——— */

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

    return {
      completeOnboarding: (profile: Profile, pieces: Piece[]) => {
        const { session } = getState();
        dispatch({ t: 'onboard', profile: { ...profile, email: session?.email ?? profile.email }, pieces });
        if (session) sync(push(session, profile, pieces, {}));
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
            dispatch({ t: 'session', session: acc?.session ?? null, pendingEmail: null });
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
            return { ok: true, next: 'app' };
          }
          dispatch({ t: 'account', acc });
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
      toast: (text: string) => dispatch({ t: 'toast', text }),
      hideToast: () => dispatch({ t: 'hideToast' }),
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
  const value = useMemo(() => ({ s, a }), [s, a]);

  // Au lancement : le compte en ligne s'il y a une session, sinon l'espace gardé sur le téléphone.
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await readSaved();
      if (supabase) {
        try {
          const acc = await remote.loadAccount();
          if (!alive) return;
          if (acc) return dispatch({ t: 'account', acc });
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

/** Les pièces qui dorment : jamais portées ou pas depuis deux mois — mais pas celles qu'on vient d'ajouter. */
export const sleeping = (pieces: Piece[]) =>
  pieces.filter((p) => p.addedDaysAgo >= 30 && (p.lastWorn === null || p.lastWorn > 60)).sort((a, b) => (b.lastWorn ?? 9999) - (a.lastWorn ?? 9999));

/** Les événements visibles : seulement si l'agenda est relié. */
export const eventsOf = (profile: Profile) => (profile.agenda ? EVENTS : []);

/** Les tenues du jour de ce dressing (écrites à la main pour la démo, composées sinon). */
export const useTodayOutfits = () => {
  const { s } = useStore();
  return useMemo(() => todayOutfits(s.pieces), [s.pieces]);
};

export { precision } from './profile';

export type { State, KodeOutfit };
