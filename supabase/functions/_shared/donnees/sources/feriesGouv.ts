/**
 * Jours fériés, source principale : calendrier.api.gouv.fr (Etalab).
 * Sans clé, Licence Ouverte. Couvre la métropole, l'Alsace-Moselle (deux
 * jours de plus) et les départements d'outre-mer.
 * https://calendrier.api.gouv.fr/jours-feries/
 */
import type { Ferie, Source } from '../types.ts';
import { getJson, exiger } from '../http.ts';

export type ZoneFeries = 'metropole' | 'alsace-moselle' | 'guadeloupe' | 'martinique' | 'guyane' | 'la-reunion' | 'mayotte';

/** La zone de jours fériés d'un département. */
export function zoneFeries(dep: string): ZoneFeries {
  if (dep === '57' || dep === '67' || dep === '68') return 'alsace-moselle';
  const outreMer: Record<string, ZoneFeries> = { '971': 'guadeloupe', '972': 'martinique', '973': 'guyane', '974': 'la-reunion', '976': 'mayotte' };
  return outreMer[dep] ?? 'metropole';
}

export type ParamsFeries = { zone: ZoneFeries; annees: number[] };

export const URL_FERIES = (zone: ZoneFeries, annee: number) => `https://calendrier.api.gouv.fr/jours-feries/${zone}/${annee}.json`;

export function lireFeriesGouv(r: Record<string, string>): Ferie[] {
  const lignes = Object.entries(exiger(r, 'réponse')).filter(([d, n]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && typeof n === 'string');
  if (!lignes.length) throw new Error('champ manquant : aucune date');
  return lignes.map(([date, nom]) => ({ date, nom }));
}

export const feriesGouv: Source<ParamsFeries, Ferie[]> = {
  id: 'calendrier-gouv',
  nom: 'calendrier.api.gouv.fr',
  mention: 'Jours fériés : calendrier.api.gouv.fr (Etalab)',
  lire: async ({ zone, annees }) => {
    const parAn = await Promise.all(annees.map(async (a) => lireFeriesGouv(await getJson<Record<string, string>>(URL_FERIES(zone, a)))));
    return parAn.flat().sort((a, b) => a.date.localeCompare(b.date));
  },
};
