/**
 * Vacances scolaires, source principale : le calendrier scolaire officiel
 * de l'Éducation nationale (data.education.gouv.fr). Sans clé, Licence
 * Ouverte. Quota affiché par l'API : 50 000 appels par jour.
 * https://data.education.gouv.fr/explore/dataset/fr-en-calendrier-scolaire/
 */
import type { Source, Vacances } from '../types.ts';
import { getJson, exiger } from '../http.ts';
import { jourParis, plusJours } from '../temps.ts';

export type ParamsVacances = { academie: string; nomDepartement: string | null; depuis: string };

type Reponse = { results: { description: string; population: string; start_date: string; end_date: string; location: string }[] };

/** L'année scolaire d'un jour (« 2026-2027 » à partir d'août 2026). */
export function anneeScolaire(jour: string, decalage = 0): string {
  const [a, m] = jour.split('-').map(Number);
  const debut = (m >= 8 ? a : a - 1) + decalage;
  return `${debut}-${debut + 1}`;
}

export function urlEducation(p: ParamsVacances): string {
  const where =
    `(annee_scolaire="${anneeScolaire(p.depuis)}" or annee_scolaire="${anneeScolaire(p.depuis, 1)}")` +
    ` and location="${p.academie}" and end_date >= date'${p.depuis}'`;
  const q = new URLSearchParams({ where, order_by: 'start_date', limit: '40' });
  return `https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?${q}`;
}

/**
 * start_date : premier jour de vacances (minuit à Paris, écrit en UTC) ;
 * end_date : jour de la reprise. On garde les lignes des élèves (« - » ou
 * « Élèves… »), pas celles des enseignants.
 */
export function lireEducation(r: Reponse): Vacances[] {
  const lignes = exiger(r?.results, 'results');
  const vues = new Set<string>();
  const out: Vacances[] = [];
  for (const l of lignes) {
    const pop = exiger(l.population, 'results[].population');
    if (pop !== '-' && !pop.startsWith('Élèves')) continue;
    const debut = jourParis(exiger(l.start_date, 'results[].start_date'));
    const reprise = jourParis(exiger(l.end_date, 'results[].end_date'));
    const fin = plusJours(reprise, -1) < debut ? debut : plusJours(reprise, -1);
    const nom = exiger(l.description, 'results[].description');
    if (vues.has(nom + debut)) continue;
    vues.add(nom + debut);
    out.push({ nom, debut, fin });
  }
  return out;
}

export const education: Source<ParamsVacances, Vacances[]> = {
  id: 'education',
  nom: 'Éducation nationale',
  mention: 'Vacances scolaires : ministère de l’Éducation nationale (data.education.gouv.fr)',
  lire: async (p) => lireEducation(await getJson<Reponse>(urlEducation(p))),
};
