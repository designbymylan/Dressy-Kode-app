/**
 * Le contrôle qualité unique (spec) : il décide, à partir du masque et de la
 * fiche, si la photo donne une pièce ou s'il faut la reprendre. Jamais de
 * réparation : une mauvaise photo se refait.
 */
import { typeDePiece, type Etiquettes } from '../_shared/taxonomy.ts';
import type { Analyse } from './masque.ts';
import { SEUILS } from './reglages.ts';

export type RaisonReprise = 'mask_too_small' | 'mask_too_large' | 'multiple_items';

export type Decision = { statut: 'ready' } | { statut: 'needs_retake'; raison: RaisonReprise };

/** Les messages précis montrés à la personne (spec, section Erreurs). */
export const MESSAGES: Record<RaisonReprise | 'provider_error' | 'unexpected' | 'trop_petite', string> = {
  trop_petite: 'Photo trop petite',
  mask_too_small: 'Rapproche-toi de la pièce',
  mask_too_large: 'Éloigne-toi, la pièce doit être entière',
  multiple_items: 'Une seule pièce par photo',
  provider_error: 'Le traitement n’a pas abouti. Réessaie dans un instant.',
  unexpected: 'Le traitement n’a pas abouti. Réessaie dans un instant.',
};

export function decider(a: Analyse, etiquettes: Etiquettes | null, seuils: typeof SEUILS = SEUILS): Decision {
  if (!a.boite || a.couverture < seuils.couvertureMin) return { statut: 'needs_retake', raison: 'mask_too_small' };
  if (a.couverture > seuils.couvertureMax) return { statut: 'needs_retake', raison: 'mask_too_large' };
  if (etiquettes && !etiquettes.piece_unique) return { statut: 'needs_retake', raison: 'multiple_items' };
  // Une paire (chaussures, boucles, gants) est faite de deux morceaux : on les compte ensemble.
  const paire = Boolean(etiquettes && typeDePiece(etiquettes.type)?.pluriel);
  const part = paire ? a.deuxPlusGros : a.plusGros;
  if (part < seuils.plusGrosMin) return { statut: 'needs_retake', raison: 'multiple_items' };
  return { statut: 'ready' };
}
