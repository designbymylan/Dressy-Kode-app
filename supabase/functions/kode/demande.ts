/**
 * Ce que Kodi reçoit, construit à partir d'un dossier déjà lu (dressing,
 * profil, agenda, historique…). Logique pure, sans réseau ni base : la
 * fonction `kode` y passe ce qu'elle lit en base, le banc d'essai
 * (`banc-ia`) ses scénarios. Les deux envoient donc exactement la même
 * consigne.
 *
 * L'ordre protège le cache du fournisseur : d'abord les règles (fixes), puis
 * le contexte (dressing et profil, marqué `cache_control`), et en dernier ce
 * qui change à chaque question (date, météo, pièces écartées, souvenirs,
 * question).
 */
import {
  RULES, ANSWER_RULES, PLAN_RULES, profileText, agendaText, eventText, planDaysText, voyageText, ecartsText,
  aimeesText, faitsText, interditesText,
  type AgendaLine, type Corps, type EcartRow, type EventRow, type Profile, type Voyage,
} from './prompt.ts';
import { withRefs, wardrobeText, normaliseHistory, type Garment, type Turn } from './wardrobe.ts';
import { interdites, meteoTexte, type Conditions } from './meteo.ts';
import { dayLabel, fullLabel } from './dates.ts';

/** Les cœurs : des pièces, et des tenues avec leurs pièces. */
export type Coeurs = { pieces: string[]; tenues: { titre: string; garmentIds: string[] }[] };

/** Tout ce que Kodi peut savoir de la personne, déjà lu. */
export type Dossier = {
  /** AAAA-MM-JJ, à Paris. */
  today: string;
  style: Profile | null;
  corps: Corps | null;
  coeurs: Coeurs | null;
  labels: Map<string, string>;
  wardrobe: Garment[];
  agenda: AgendaLine[];
  events: EventRow[];
  /** Jour → noms des pièces de la tenue prévue. */
  plannedNames: Map<string, string>;
  turns: Turn[];
  ecarts: EcartRow[];
};

/** L'identifiant d'une pièce vers sa référence courte (p1, p2…). */
export const refOf = (refs: Map<string, Garment>) => new Map<string, string>([...refs].map(([ref, g]): [string, string] => [g.id, ref]));

/** Les cœurs, en texte pour Kodi : seulement les pièces encore dans le dressing. */
export function coeursTexte(coeurs: Coeurs | null, refsById: Map<string, string>): string {
  if (!coeurs) return '';
  const ref = (id: string) => refsById.get(id);
  const pieces = coeurs.pieces.map(ref).filter((r): r is string => !!r);
  const tenues = coeurs.tenues.map((t) => ({ titre: t.titre, refs: t.garmentIds.map(ref).filter((r): r is string => !!r) }));
  return aimeesText(pieces, tenues);
}

const dressingTexte = (refs: Map<string, Garment>, d: Dossier) =>
  `Dressing : ${refs.size} pièce${refs.size > 1 ? 's' : ''} disponible${refs.size > 1 ? 's' : ''} :\n${wardrobeText(refs, d.labels, d.today)}`;

/** Ce qui arrive avec la question : le monde du jour, déjà mis en texte, et sa météo en règles. */
export type Jour = { texte: string; meteo: Conditions | null };

/** La demande d'une réponse à une question. */
export function demandeReponse(d: Dossier, question: string, jour: Jour, souvenirs: { texte: string }[]) {
  const refs = withRefs(d.wardrobe);
  const refsById = refOf(refs);
  // La météo écarte d'avance les pièces trop chaudes, trop légères ou mal adaptées.
  const interdit = jour.meteo ? interdites(d.wardrobe, jour.meteo) : new Map<string, string>();

  const context = [
    profileText(d.style, d.corps),
    coeursTexte(d.coeurs, refsById),
    `Agenda Dresskode des deux prochaines semaines :\n${agendaText(d.agenda)}`,
    dressingTexte(refs, d),
    ecartsText(d.ecarts, refsById),
  ].filter(Boolean).join('\n\n');

  // La date, la météo du jour, les souvenirs et la question n'entrent que
  // dans la dernière bulle : placés dans le contexte, ils invalideraient le
  // cache à chaque question.
  const turns = normaliseHistory([
    ...d.turns,
    {
      role: 'user',
      content: [
        `Nous sommes le ${fullLabel(d.today)}.`,
        jour.texte,
        jour.meteo ? meteoTexte(jour.meteo, 'd’aujourd’hui') : '',
        interdit.size ? interditesText(interdit, refsById) : '',
        faitsText(souvenirs),
        question,
      ].filter(Boolean).join('\n\n'),
    },
  ]);

  return { system: `${RULES}\n\n${ANSWER_RULES}`, context, turns, refs, refsById, interdit };
}

/** La météo de plusieurs jours : une ligne par jour, ses conditions, et le reste du contexte. */
export type MeteoJours = { byDay: Map<string, string>; extra: string; conditions: Map<string, Conditions> };

export type Trip = Voyage & { lat: number | null; lon: number | null };

/** La demande d'une planification de plusieurs jours. */
export function demandePlan(
  d: Dossier,
  days: string[],
  opts: { trip: Trip | null; consigne: string | null; meteo: MeteoJours | null; souvenirs: { texte: string }[] },
) {
  const { trip, consigne, meteo: w, souvenirs } = opts;
  const from = days[0];
  const to = days.at(-1)!;
  const refs = withRefs(d.wardrobe);
  const refsById = refOf(refs);
  const context = [
    profileText(d.style, d.corps),
    coeursTexte(d.coeurs, refsById),
    dressingTexte(refs, d),
    ecartsText(d.ecarts, refsById),
  ].filter(Boolean).join('\n\n');

  // Jour par jour, ce que la météo écarte : Kodi le lit, et la planification le retire.
  const interditsParJour = new Map<string, Map<string, string>>();
  for (const day of days) {
    const c = w?.conditions.get(day);
    if (c) interditsParJour.set(day, interdites(d.wardrobe, c));
  }
  const interditsTexte = days.flatMap((day) => [...(interditsParJour.get(day) ?? [])]
    .filter(([id]) => refsById.has(id))
    .map(([id, raison]) => `- ${day}, ${refsById.get(id)} : ${raison}`));

  const wanted = new Set(days);
  const neighbours = [...d.plannedNames]
    .filter(([day]) => !wanted.has(day))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, names]) => `- ${day} (${dayLabel(day)}) : ${names}`);

  const message = [
    `Nous sommes le ${fullLabel(d.today)}.`,
    w?.extra || null,
    trip ? voyageText(trip, dayLabel(from), dayLabel(to)) : null,
    `Jours à prévoir (${days.length}) :\n${planDaysText(days.map((day) => ({
      date: day,
      label: dayLabel(day),
      meteo: w?.byDay.get(day) ?? null,
      events: d.events.filter((e) => e.day === day),
      before: d.plannedNames.get(day) ?? null,
    })))}`,
    interditsTexte.length ? `Pièces à ne pas proposer ces jours-là, à cause de la météo :\n${interditsTexte.join('\n')}` : null,
    neighbours.length ? `Tenues déjà prévues les jours voisins :\n${neighbours.join('\n')}` : null,
    faitsText(souvenirs) || null,
    consigne ? `Ce que la personne demande en plus : « ${consigne} »` : null,
  ].filter(Boolean).join('\n\n');

  return { system: `${RULES}\n\n${PLAN_RULES}`, context, turns: [{ role: 'user' as const, content: message }], refs, refsById, interditsParJour };
}

/** La ligne d'agenda d'un rendez-vous. */
export const agendaEvent = (e: EventRow, jourSemaine: string): AgendaLine => ({ day: `${e.day} (${jourSemaine})`, text: `rendez-vous ${eventText(e)}` });
