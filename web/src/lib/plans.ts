/**
 * Les offres de Dresskode (21/10) : Fashion et Sapologue.
 *
 * C’est la seule source des montants : l’écran Offres et la partie Tarifs
 * du profil les affichent, et tools/stripe-setup.mjs les crée chez Stripe.
 * Les limites affichées ici doivent rester celles de public.plan_limits()
 * (migration offres_fashion_sapologue).
 *
 * Les identifiants restent ceux d’avant, parce qu’ils vivent en base et
 * chez Stripe (clés de prix dressy_<offre>_<période>) : `capsule` porte
 * Fashion, `atelier` porte Sapologue. Couture n’est plus vendue.
 *
 * Les prix : Fashion garde 6,99 €. Sapologue passe à 14,99 € (17,99 €
 * proposés) : de 6,99 à 17,99 €, la marche (×2,6) était trop haute, presque
 * tout le monde s’arrête alors à la première offre ; 14,99 € reste sous le
 * seuil des 15 € et double à peu près Fashion. L’annuel vaut environ dix
 * mois, la même remise sur les deux offres.
 *
 * Module pur, sans alias d’import : le script Node le lit tel quel.
 */

export type PlanId = 'capsule' | 'atelier';
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
    name: 'Fashion',
    note: 'Ton dressing rangé, et enfin porté',
    cents: { mois: 699, an: 5999 },
    features: [
      { label: "Jusqu’à 120 pièces" },
      { label: '30 questions à Kodi par mois' },
      { label: 'Tenue du jour et agenda' },
      { label: 'Suivi de ta garde-robe' },
    ],
  },
  {
    id: 'atelier',
    name: 'Sapologue',
    note: 'Kodi devient ton styliste personnel',
    cents: { mois: 1499, an: 12999 },
    flagged: true,
    features: [
      { label: 'Pièces illimitées' },
      { label: 'Kodi sans limite' },
      { label: 'Tenues d’occasion et valise de voyage' },
      // Pas encore construit : on ne vend pas ce qui n’existe pas.
      { label: 'Audit de garde-robe chaque trimestre', soon: true },
    ],
  },
];

/**
 * Le tableau de comparaison du profil (référence « design price ») : une
 * ligne par promesse, cochée ou non pour chaque offre. `icon` nomme une
 * icône du jeu plein (components/icons.tsx).
 */
export const COMPARE: { icon: string; title: string; sub: string; capsule: boolean; atelier: boolean; soon?: boolean }[] = [
  { icon: 'hanger', title: 'Dressing numérique', sub: '120 pièces avec Fashion', capsule: true, atelier: true },
  { icon: 'sparkle', title: 'Kodi, ton styliste', sub: '30 questions par mois avec Fashion', capsule: true, atelier: true },
  { icon: 'cloud', title: 'Tenue du jour', sub: 'Selon la météo et ton agenda', capsule: true, atelier: true },
  { icon: 'chart', title: 'Suivi de ta garde-robe', sub: 'Pièces portées, barre de progression', capsule: true, atelier: true },
  { icon: 'infinity', title: 'Sans limite', sub: 'Pièces et questions à Kodi', capsule: false, atelier: true },
  { icon: 'party', title: 'Occasions et voyages', sub: 'Kodi prépare la tenue et la valise', capsule: false, atelier: true },
  { icon: 'layers', title: 'Audit de garde-robe', sub: 'Doublons, oublis et manques, chaque trimestre', capsule: false, atelier: true, soon: true },
];

/** Sans abonnement. Mêmes valeurs que plan_limits('decouverte'). */
export const FREE_PLAN = {
  id: 'decouverte' as const,
  name: 'Découverte',
  features: ["Jusqu’à 30 pièces", '5 questions à Kodi par mois'],
};

/** L’annuel commence par un mois offert, une seule fois par espace. */
export const TRIAL_DAYS = 30;

export const PERIOD_LABEL: Record<Period, string> = { mois: 'Mensuel', an: 'Annuel' };

/** Clé de recherche du prix chez Stripe : le code ne connaît jamais les identifiants price_…. */
export const lookupKey = (plan: PlanId, period: Period) => `dressy_${plan}_${period}`;

export const isPlan = (v: unknown): v is PlanId => PLANS.some((p) => p.id === v);
export const isPeriod = (v: unknown): v is Period => v === 'mois' || v === 'an';

/** Le nom d’une offre, y compris celle qui n’est plus vendue. */
const RETIRED: Record<string, string> = { couture: 'Couture' };
export const planName = (id: string | null | undefined) =>
  PLANS.find((p) => p.id === id)?.name ?? (id && RETIRED[id]) ?? FREE_PLAN.name;

/** 699 → « 6,99 € ». */
export function euros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

/** Ce que coûte l’annuel ramené au mois : « soit 5,00 € par mois ». */
export function perMonth(plan: Plan): string {
  return `soit ${euros(Math.round(plan.cents.an / 12))} par mois`;
}

/** La remise de l’annuel sur douze mois, arrondie vers le bas : on n’affiche jamais plus que la vérité. */
export function saving(plan: Plan): number {
  return Math.floor((1 - plan.cents.an / (plan.cents.mois * 12)) * 100);
}
