/**
 * Les offres de Dressy, reprises de design/_projet/Offres.dc.html.
 *
 * C'est la seule source des montants : l'écran Offres les affiche, et
 * tools/stripe-setup.mjs les crée chez Stripe. Les limites affichées ici
 * doivent rester celles de public.plan_limits() (migration abonnements).
 *
 * Module pur, sans alias d'import : le script Node le lit tel quel.
 */

export type PlanId = 'capsule' | 'atelier' | 'couture';
export type Period = 'mois' | 'an';

export type Feature = { label: string; soon?: boolean };

export type Plan = {
  id: PlanId;
  name: string;
  note: string;
  cents: Record<Period, number>; // TTC
  features: Feature[];
  flagged?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: 'capsule',
    name: 'Capsule',
    note: 'Pour commencer sans se presser',
    cents: { mois: 699, an: 5999 },
    features: [
      { label: "Jusqu'à 60 pièces" },
      { label: '20 questions à Kode par mois' },
      { label: 'Tenue du jour et agenda' },
    ],
  },
  {
    id: 'atelier',
    name: 'Atelier',
    note: 'Le dressing complet, Kode sans limite',
    cents: { mois: 1299, an: 10999 },
    flagged: true,
    features: [
      { label: "Jusqu'à 200 pièces" },
      { label: 'Kode sans limite' },
      // Les packs ne sont pas encore construits : on ne vend pas ce qui n'existe pas.
      { label: 'Les cinq packs inclus', soon: true },
    ],
  },
  {
    id: 'couture',
    name: 'Couture',
    note: 'Pour les garde-robes sans fin',
    cents: { mois: 2499, an: 21999 },
    features: [
      { label: 'Pièces illimitées' },
      { label: 'Kode sans limite' },
      { label: 'Audit de garde-robe chaque trimestre', soon: true },
      { label: 'Prêts entre amies illimités', soon: true },
    ],
  },
];

/** Sans abonnement. Mêmes valeurs que plan_limits('decouverte'). */
export const FREE_PLAN = {
  id: 'decouverte' as const,
  name: 'Découverte',
  features: ["Jusqu'à 30 pièces", '5 questions à Kode par mois'],
};

/** L'annuel commence par un mois offert, une seule fois par espace. */
export const TRIAL_DAYS = 30;

export const PERIOD_LABEL: Record<Period, string> = { mois: 'Mensuel', an: 'Annuel' };

/** Clé de recherche du prix chez Stripe : le code ne connaît jamais les identifiants price_…. */
export const lookupKey = (plan: PlanId, period: Period) => `dressy_${plan}_${period}`;

export const isPlan = (v: unknown): v is PlanId => PLANS.some((p) => p.id === v);
export const isPeriod = (v: unknown): v is Period => v === 'mois' || v === 'an';

export const planName = (id: string | null | undefined) =>
  PLANS.find((p) => p.id === id)?.name ?? FREE_PLAN.name;

/** 699 → « 6,99 € ». */
export function euros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

/** Ce que coûte l'annuel ramené au mois : « soit 9,17 € par mois ». */
export function perMonth(plan: Plan): string {
  return `soit ${euros(Math.round(plan.cents.an / 12))} par mois`;
}
