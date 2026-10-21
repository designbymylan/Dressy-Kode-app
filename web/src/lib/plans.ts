import type { IconName } from '@/components/icons';

/**
 * Les offres Dressy (octobre 2026).
 *
 * Proposition de départ : Fashion 6,99 €/mois, Sapologue 17,99 €/mois.
 * Fashion est gardé tel quel. Sapologue passe à 14,99 € :
 *  - l'écart 6,99 → 17,99 (×2,6, +11 €/mois) est trop grand pour une montée
 *    en gamme ; au-delà de ×2 environ, presque tout le monde s'arrête au
 *    premier palier et l'offre haute ne sert plus que d'ancre ;
 *  - 14,99 € reste sous le seuil des 15 € et garde un rapport ×2,1 ;
 *  - l'annuel affiche la même remise sur les deux offres (−28 %), plus
 *    simple à comprendre et à comparer.
 * Le coût variable (photos traitées par trois modèles d'IA, messages à
 * Kodi) est couvert par les plafonds de Fashion ; Sapologue les lève.
 */

export type PlanId = 'decouverte' | 'fashion' | 'sapologue';
export type Period = 'month' | 'year';

export type Plan = {
  id: Exclude<PlanId, 'decouverte'>;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
};

export const PLANS: Record<Plan['id'], Plan> = {
  fashion: {
    id: 'fashion',
    name: 'Fashion',
    tagline: 'Ton dressing rangé, et enfin porté',
    monthly: 6.99,
    yearly: 59.99,
  },
  sapologue: {
    id: 'sapologue',
    name: 'Sapologue',
    tagline: 'Kodi devient ton styliste personnel',
    monthly: 14.99,
    yearly: 129.99,
  },
};

/** Ce que comprend chaque offre — le tableau de comparaison du profil. */
export const FEATURES: { icon: IconName; title: string; sub: string; fashion: boolean; sapologue: boolean }[] = [
  { icon: 'hanger', title: 'Dressing numérique', sub: 'Jusqu’à 150 pièces avec Fashion', fashion: true, sapologue: true },
  { icon: 'sparkle', title: 'Kodi, ton styliste', sub: '100 messages par mois avec Fashion', fashion: true, sapologue: true },
  { icon: 'cloud', title: 'Tenue du jour', sub: 'Selon la météo et ton agenda', fashion: true, sapologue: true },
  { icon: 'chart', title: 'Suivi de ta garde-robe', sub: 'Pièces portées, coût par port', fashion: true, sapologue: true },
  { icon: 'infinity', title: 'Sans limite', sub: 'Pièces et messages à Kodi illimités', fashion: false, sapologue: true },
  { icon: 'layers', title: 'Audit de garde-robe', sub: 'Chaque trimestre : doublons, oublis, manques', fashion: false, sapologue: true },
  { icon: 'palette', title: 'Analyse couleurs', sub: 'Ta palette, appliquée à tes tenues', fashion: false, sapologue: true },
  { icon: 'suitcase', title: 'Occasions et valise', sub: 'Mariage, entretien, voyage : prêt en une minute', fashion: false, sapologue: true },
  { icon: 'headset', title: 'Support prioritaire', sub: 'Réponse en 24 h, même le week-end', fashion: false, sapologue: true },
];

/** Ce que garde l'offre gratuite, pour l'écrire honnêtement. */
export const FREE_LIMITS = '30 pièces et 10 messages à Kodi par mois';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const eur = (n: number) => euro.format(n);

export const perMonth = (p: Plan) => Math.floor((p.yearly / 12) * 100) / 100;
export const saving = (p: Plan) => Math.round((1 - p.yearly / (p.monthly * 12)) * 100);

/** Les anciens identifiants (Capsule, Atelier, Couture) retombent sur les nouvelles offres. */
export function planFrom(row: { plan: string | null; status: string | null } | null): PlanId {
  if (!row || !row.status || !['active', 'trialing', 'past_due'].includes(row.status)) return 'decouverte';
  const p = (row.plan ?? '').toLowerCase();
  if (p === 'sapologue' || p === 'atelier' || p === 'couture') return 'sapologue';
  if (p === 'fashion' || p === 'capsule') return 'fashion';
  return 'decouverte';
}

export const PLAN_LABEL: Record<PlanId, string> = {
  decouverte: 'Découverte',
  fashion: 'Fashion',
  sapologue: 'Sapologue',
};
