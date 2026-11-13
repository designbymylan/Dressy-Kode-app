/**
 * Une réponse de Kodi, de la demande à la tenue gardée, sans base : la
 * fonction `kode` y passe ce qu'elle a lu, le banc d'essai (`banc-ia`) ses
 * scénarios. Ce qui change dans la façon de répondre (consigne, schéma,
 * contrôle, relance) change ici, et le banc le mesure tel quel.
 */
import { ANSWER_SCHEMA, PLAN_SCHEMA, type Answer } from './prompt.ts';
import { pickPieces, pickPlan, type Picked, type PlannedDay } from './wardrobe.ts';
import { askClaude, readJson, type Appel, type Reponse } from './claude.ts';
import { demandeReponse, demandePlan, type Dossier, type Jour, type MeteoJours, type Trip } from './demande.ts';

export function readAnswer(res: Reponse): Answer {
  const raw = readJson<Answer>(res);
  return {
    reponse: String(raw.reponse ?? '').trim(),
    tenue: {
      titre: String(raw.tenue?.titre ?? '').trim().slice(0, 80),
      pourquoi: String(raw.tenue?.pourquoi ?? '').trim().slice(0, 400),
      pieces: Array.isArray(raw.tenue?.pieces) ? raw.tenue!.pieces.map(String) : [],
    },
  };
}

export type Reponse1 = {
  answer: Answer;
  pieces: Picked[];
  demande: ReturnType<typeof demandeReponse>;
  /** Les appels au modèle, dans l'ordre (un seul sans relance). */
  appels: Reponse[];
};

/** Kodi répond à une question. */
export async function repondre(d: Dossier, question: string, jour: Jour, souvenirs: { texte: string }[], opts: Appel = {}): Promise<Reponse1> {
  const demande = demandeReponse(d, question, jour, souvenirs);
  const res = await askClaude(demande.system, demande.context, demande.turns, ANSWER_SCHEMA, opts);
  const answer = readAnswer(res);
  return { answer, pieces: pickPieces(answer.tenue.pieces, demande.refs, demande.interdit), demande, appels: [res] };
}

export type Plan = {
  message: string;
  jours: PlannedDay[];
  demande: ReturnType<typeof demandePlan>;
  appels: Reponse[];
};

/** Kodi prévoit plusieurs jours d'un coup. */
export async function planifier(
  d: Dossier,
  days: string[],
  opts: { trip: Trip | null; consigne: string | null; meteo: MeteoJours | null; souvenirs: { texte: string }[] },
  appel: Appel = {},
): Promise<Plan> {
  const demande = demandePlan(d, days, opts);
  const res = await askClaude(demande.system, demande.context, demande.turns, PLAN_SCHEMA, appel);
  const raw = readJson<{ message: string; jours: unknown }>(res);
  return { message: String(raw.message ?? '').trim(), jours: pickPlan(raw.jours, demande.refs, days, demande.interditsParJour), demande, appels: [res] };
}
