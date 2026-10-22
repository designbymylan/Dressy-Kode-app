/**
 * « Pas pour moi » (09/10) : une tenue écartée, avec sa raison. La
 * combinaison n'est plus jamais proposée ; une pièce écartée seule passe en
 * dernier pendant deux semaines ; tout le reste (couleurs, météo, journée,
 * style, confort) part chez Kodi, qui en tient compte dans ses tenues.
 */
import { offsetOf, type Iso } from './planning';

export type Raison = 'style' | 'couleurs' | 'meteo' | 'journee' | 'confort' | 'piece' | 'sans';

/** Les raisons proposées, dans l'ordre où on les pense : du goût au concret. */
export const RAISONS: { id: Exclude<Raison, 'sans'>; label: string }[] = [
  { id: 'style', label: 'Pas mon style' },
  { id: 'couleurs', label: 'Les couleurs' },
  { id: 'confort', label: 'Pas à l’aise dedans' },
  { id: 'meteo', label: 'Pas pour la météo' },
  { id: 'journee', label: 'Pas pour ma journée' },
  { id: 'piece', label: 'Une pièce en particulier' },
];

export type Ecart = {
  id: string;
  date: Iso;
  /** Les pièces de la tenue écartée, telle qu'elle était montrée. */
  pieces: string[];
  raison: Raison;
  /** Pour « Une pièce en particulier » : la ou les pièces visées. */
  cibles: string[];
  /** La tenue proposée au départ, quand des pièces y avaient été changées : elle est écartée aussi. */
  proposee?: string[];
};

/** Combien de temps une pièce écartée seule passe en dernier. */
const RETRAIT_JOURS = 14;

/** Une tenue se reconnaît à ses pièces, dans n'importe quel ordre. */
export const cleTenue = (ids: string[]) => [...ids].sort().join(',');

/** Ce que les tenues proposées doivent éviter : des combinaisons, et des pièces mises en retrait. */
export type Evite = { tenues: Set<string>; retrait: Set<string> };

export function evite(ecarts: Ecart[]): Evite {
  return {
    tenues: new Set(ecarts.flatMap((e) => [cleTenue(e.pieces), ...(e.proposee ? [cleTenue(e.proposee)] : [])])),
    retrait: new Set(ecarts.filter((e) => e.raison === 'piece' && -offsetOf(e.date) <= RETRAIT_JOURS).flatMap((e) => e.cibles)),
  };
}

export const RIEN: Evite = { tenues: new Set(), retrait: new Set() };

/** Les écarts gardés : les plus récents d'abord, cent au plus (les mêmes que la base garde six mois). */
export const garder = (ecarts: Ecart[]) => ecarts.slice(0, 100);
