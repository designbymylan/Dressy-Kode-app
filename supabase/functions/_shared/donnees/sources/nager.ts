/**
 * Jours fériés, premier secours : Nager.Date. Sans clé, gratuit.
 * Jours nationaux seulement (pas les deux jours d'Alsace-Moselle ni ceux
 * d'outre-mer) : c'est un secours, pas la référence.
 * https://date.nager.at/Api
 */
import type { Ferie, Source } from '../types.ts';
import { getJson, exiger } from '../http.ts';
import type { ParamsFeries } from './feriesGouv.ts';

type Reponse = { date: string; localName: string; global: boolean }[];

export const URL_NAGER = (annee: number) => `https://date.nager.at/api/v3/PublicHolidays/${annee}/FR`;

export function lireNager(r: Reponse): Ferie[] {
  if (!Array.isArray(r) || !r.length) throw new Error('champ manquant : liste des jours');
  return r.filter((h) => h.global !== false).map((h) => ({ date: exiger(h.date, 'date'), nom: exiger(h.localName, 'localName') }));
}

export const nager: Source<ParamsFeries, Ferie[]> = {
  id: 'nager',
  nom: 'Nager.Date',
  mention: 'Jours fériés : Nager.Date',
  lire: async ({ annees }) => {
    const parAn = await Promise.all(annees.map(async (a) => lireNager(await getJson<Reponse>(URL_NAGER(a)))));
    return parAn.flat().sort((a, b) => a.date.localeCompare(b.date));
  },
};
