/**
 * Tendances, dernier recours : la sélection de saison écrite par nous.
 * Pas d'appel réseau, ne tombe jamais. Servie seulement quand Wikipédia
 * ne répond pas ET qu'aucune valeur précédente n'est en cache.
 */
import type { Source, Tendance } from '../types.ts';
import { libelleDe } from '../pieces.ts';

const SAISONS: { mois: number[]; kinds: string[] }[] = [
  { mois: [12, 1, 2], kinds: ['pull', 'veste', 'bottines', 'foulard', 'pantalon', 'cardigan'] },
  { mois: [3, 4, 5], kinds: ['trench', 'chemise', 'blazer', 'baskets', 'mariniere', 'jupe'] },
  { mois: [6, 7, 8], kinds: ['tshirt', 'short', 'robe', 'debardeur', 'baskets', 'sac'] },
  { mois: [9, 10, 11], kinds: ['trench', 'pull', 'cardigan', 'bottines', 'jean', 'foulard'] },
];

export function selectionDeSaison(jour: string): Tendance[] {
  const mois = Number(jour.slice(5, 7));
  const s = SAISONS.find((x) => x.mois.includes(mois)) ?? SAISONS[0];
  return s.kinds.map((kind) => ({ kind, libelle: libelleDe(kind), variation: null }));
}

export const saison: Source<{ jour: string }, Tendance[]> = {
  id: 'saison',
  nom: 'Dresskode',
  mention: 'Sélection de saison Dresskode',
  lire: async ({ jour }) => selectionDeSaison(jour),
};
