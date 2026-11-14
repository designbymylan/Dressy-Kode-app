/**
 * Une réponse de Kodi, de la demande à la tenue gardée, sans base : la
 * fonction `kode` y passe ce qu'elle a lu, le banc d'essai (`banc-ia`) ses
 * scénarios. Ce qui change dans la façon de répondre (consigne, schéma,
 * contrôle, relance) change ici, et le banc le mesure tel quel.
 *
 * Kodi v2 (13/11) : après chaque réponse, la tenue passe le contrôle du code
 * (controle.ts). Si elle échoue : une seule relance avec l'erreur en clair ;
 * si elle échoue encore, le code retire ce qui dépasse (deux bas, deux paires,
 * une couleur évitée…) ; s'il ne reste pas une tenue complète, pas de tenue,
 * et une phrase honnête. La variante passe le même contrôle, ou disparaît.
 */
import { ANSWER_SCHEMA, PLAN_SCHEMA, INTENTIONS, DIRECTIONS, type Answer } from './prompt.ts';
import { pickPieces, pickPlan, type Garment, type Picked, type PlannedDay } from './wardrobe.ts';
import { askClaude, readJson, type Appel, type Reponse } from './claude.ts';
import { demandeReponse, demandePlan, type Dossier, type Jour, type MeteoJours, type Trip } from './demande.ts';
import { controler, variantePropre, reparer, aRetenir, type PieceControle, type ProfilControle } from './controle.ts';

const texte = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const refs = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
const parmi = <T extends string>(liste: readonly T[], v: unknown, defaut: T): T => (liste.includes(String(v) as T) ? String(v) as T : defaut);

/** La réponse v2, relue et bornée. Une réponse v1 (sans les champs nouveaux) reste lisible. */
export function readAnswer(res: Reponse): Answer {
  const raw = readJson<Answer>(res) as Record<string, unknown> & Partial<Answer>;
  const v = (raw.variante ?? {}) as Partial<Answer['variante']>;
  return {
    intention: parmi(INTENTIONS, raw.intention, 'tenue'),
    reponse: String(raw.reponse ?? '').trim(),
    tenue: {
      titre: texte(raw.tenue?.titre, 80),
      pourquoi: texte(raw.tenue?.pourquoi, 400),
      pieces: refs(raw.tenue?.pieces),
    },
    variante: { direction: parmi(DIRECTIONS, v.direction, ''), titre: texte(v.titre, 80), pieces: refs(v.pieces) },
    question: texte(raw.question, 160),
    manque: texte(raw.manque, 100),
    a_retenir: refs(raw.a_retenir),
  };
}

/** Le profil vu par le contrôle. */
export function profilControle(d: Dossier): ProfilControle {
  return { avoidColours: d.style?.avoid_colours ?? [], metals: d.style?.metals ?? [], sizes: d.corps?.usual_sizes ?? null };
}

const versControle = (ps: Picked[], refOf: Map<string, string>): PieceControle[] =>
  ps.map((p) => ({ id: p.garment.id, ref: refOf.get(p.garment.id) ?? p.garment.id, name: p.garment.name, category_id: p.garment.category_id, kind: p.garment.kind, colors: p.garment.colors, size: p.garment.size ?? null }));

/** Le dressing a-t-il des chaussures que la météo n'écarte pas ? */
const chaussuresDispo = (wardrobe: Garment[], interdit: Map<string, string>) =>
  wardrobe.some((g) => g.category_id === 'chaussures' && !interdit.has(g.id));

export type Controles = { essais: string[][]; repare: boolean; abandon: boolean; variante: string[] | null };

export type Reponse1 = {
  answer: Answer;
  pieces: Picked[];
  /** La variante gardée (vide si elle manquait ou ne tenait pas). */
  variante: Picked[];
  demande: ReturnType<typeof demandeReponse>;
  /** Les appels au modèle, dans l'ordre (deux avec une relance). */
  appels: Reponse[];
  controles: Controles;
};

const HONNETE = 'Je n’arrive pas à composer une tenue qui tienne avec ce que tu as pour cette demande. Tu pourrais me dire ce qui compte le plus pour toi ce jour-là ?';

/** Kodi répond à une question. */
export async function repondre(d: Dossier, question: string, jour: Jour, souvenirs: { texte: string }[], opts: Appel = {}): Promise<Reponse1> {
  const demande = demandeReponse(d, question, jour, souvenirs);
  const refOf = new Map([...demande.refs].map(([r, g]): [string, string] => [g.id, r]));
  const profil = profilControle(d);
  const dispo = chaussuresDispo(d.wardrobe, demande.interdit);
  const verifier = (ps: Picked[]) => (ps.length ? controler(versControle(ps, refOf), profil, dispo) : { ok: true, erreurs: [] });

  const appels: Reponse[] = [];
  let res = await askClaude(demande.system, demande.context, demande.turns, ANSWER_SCHEMA, opts);
  appels.push(res);
  let answer = readAnswer(res);
  let pieces = pickPieces(answer.tenue.pieces, demande.refs, demande.interdit);
  let ctl = verifier(pieces);
  const controles: Controles = { essais: [ctl.erreurs], repare: false, abandon: false, variante: null };

  if (!ctl.ok) {
    // Une seule relance, avec l'erreur précise : la consigne ne suffit pas toujours.
    const texteRendu = res.content.map((b) => (b.type === 'text' ? b.text ?? '' : '')).join('');
    res = await askClaude(demande.system, demande.context, [
      ...demande.turns,
      { role: 'assistant', content: texteRendu },
      { role: 'user', content: `Ta tenue ne tient pas : ${ctl.erreurs.join(' ; ')}. Corrige-la avec les pièces du dressing, en gardant le sens de ta réponse, et rends tout le JSON.` },
    ], ANSWER_SCHEMA, opts);
    appels.push(res);
    answer = readAnswer(res);
    pieces = pickPieces(answer.tenue.pieces, demande.refs, demande.interdit);
    ctl = verifier(pieces);
    controles.essais.push(ctl.erreurs);
    if (!ctl.ok) {
      const repare = reparer(pieces, profil);
      if (repare.length && verifier(repare).ok) {
        pieces = repare;
        controles.repare = true;
      } else {
        pieces = [];
        controles.abandon = true;
        answer = { ...answer, reponse: HONNETE, tenue: { titre: '', pourquoi: '', pieces: [] }, variante: { direction: '', titre: '', pieces: [] } };
      }
    }
  }

  // Pas de tenue pour une clarification ni un hors sujet.
  if (answer.intention === 'clarification' || answer.intention === 'hors_sujet') pieces = [];

  // La variante : même contrôle, et assez différente de la principale ; sinon elle disparaît.
  let variante = pieces.length && answer.variante.direction ? pickPieces(answer.variante.pieces, demande.refs, demande.interdit) : [];
  if (variante.length) {
    const c = verifier(variante);
    const diff = variantePropre(versControle(pieces, refOf), versControle(variante, refOf));
    controles.variante = [...c.erreurs, ...diff.erreurs];
    if (!c.ok || !diff.ok) variante = [];
  }

  answer = {
    ...answer,
    question: d.questionPosee ? '' : answer.question,
    a_retenir: aRetenir(answer.a_retenir, Boolean(d.retenir)),
    variante: variante.length ? answer.variante : { direction: '', titre: '', pieces: [] },
  };
  return { answer, pieces, variante, demande, appels, controles };
}

export type Plan = {
  message: string;
  jours: PlannedDay[];
  demande: ReturnType<typeof demandePlan>;
  appels: Reponse[];
  /** Jour par jour, les erreurs du contrôle avant réparation. */
  controles: Record<string, string[]>;
};

/**
 * Kodi prévoit plusieurs jours d'un coup. Chaque jour passe le contrôle ; un
 * jour qui échoue est réparé par le code, ou laissé vide (pas de relance :
 * elle referait tous les jours).
 */
export async function planifier(
  d: Dossier,
  days: string[],
  opts: { trip: Trip | null; consigne: string | null; meteo: MeteoJours | null; souvenirs: { texte: string }[] },
  appel: Appel = {},
): Promise<Plan> {
  const demande = demandePlan(d, days, opts);
  const res = await askClaude(demande.system, demande.context, demande.turns, PLAN_SCHEMA, appel);
  const raw = readJson<{ message: string; jours: unknown }>(res);
  const refOf = new Map([...demande.refs].map(([r, g]): [string, string] => [g.id, r]));
  const profil = profilControle(d);
  const controles: Record<string, string[]> = {};
  const jours = pickPlan(raw.jours, demande.refs, days, demande.interditsParJour).map((j) => {
    if (!j.pieces.length) return j;
    const dispo = chaussuresDispo(d.wardrobe, demande.interditsParJour.get(j.date) ?? new Map());
    const c = controler(versControle(j.pieces, refOf), profil, dispo);
    if (c.ok) return j;
    controles[j.date] = c.erreurs;
    const repare = reparer(j.pieces, profil);
    return repare.length && controler(versControle(repare, refOf), profil, dispo).ok ? { ...j, pieces: repare } : { ...j, pieces: [] };
  });
  return { message: String(raw.message ?? '').trim(), jours, demande, appels: [res], controles };
}
