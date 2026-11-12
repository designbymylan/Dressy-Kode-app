import { AVIS, type Avis } from '@/lib/politique';

/**
 * L'avis de changement à montrer en tête de l'accueil (12/11), le même calcul
 * que l'app (`avisAMontrer`, mobile/src/data/legal.ts) : le plus récent,
 * publié après l'inscription et pas encore lu. Les avis eux-mêmes viennent de
 * legal.ts, copiés par tools/politique.mjs.
 */
export function avisAMontrer(inscritLe: string | null, lus: readonly string[]): Avis | null {
  if (!inscritLe) return null;
  const jour = inscritLe.slice(0, 10);
  return AVIS.find((a) => jour < a.publie && !lus.includes(a.id)) ?? null;
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « À partir du 15 décembre » tant que le changement attend, « Depuis le 12 novembre » ensuite. `aujourdhui` : AAAA-MM-JJ. */
export function avisQuand(a: Avis, aujourdhui: string): string {
  const [, m, j] = a.effet.split('-').map(Number);
  const date = `${j === 1 ? '1er' : j} ${MOIS[m - 1]}`;
  return aujourdhui < a.effet ? `À partir du ${date}` : `Depuis le ${date}`;
}

/** Les avis lus, tels que le compte les garde (`avis_lus` : identifiant → date de lecture). */
export function avisLus(meta: Record<string, unknown> | null | undefined): string[] {
  const lus = meta?.avis_lus;
  return lus && typeof lus === 'object' ? Object.keys(lus) : [];
}

export type { Avis };
