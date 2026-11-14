/**
 * Les offres de Dresskode (brief v6, 31/10) : Fashion et Sapologue, au mois,
 * et à l'année avec 30 % de remise (retour de l'annuel, demandé le 08/11).
 *
 * C'est la seule source des montants : l'écran Offres et la partie Tarifs
 * du profil les affichent, et tools/stripe-setup.mjs les crée chez Stripe.
 * Les limites affichées ici doivent rester celles de public.plan_limits() et
 * public.plan_generations() (migration quotas_generation).
 *
 * Les identifiants restent ceux d'avant, parce qu'ils vivent en base et
 * chez Stripe (clés de prix dressy_<offre>_mois) : `capsule` porte Fashion,
 * `atelier` porte Sapologue (clés de prix dressy_<offre>_mois et
 * dressy_<offre>_an). Couture n'est plus vendue.
 *
 *   Découverte : 15 pièces, 4 générations offertes à vie
 *   Fashion    :  8,99 € par mois ou 75 € par an, 50 pièces, 50 générations par mois
 *   Sapologue  : 18,99 € par mois ou 159 € par an, 100 pièces, 100 générations par mois
 *
 * L'annuel est un prix rond, au moins 30 % sous douze mois (Fashion 30,4 %,
 * Sapologue 30,2 %) : la remise s'affiche arrondie vers le bas (`annualOff`),
 * jamais au-dessus de la vérité. Les générations et les questions restent
 * remises à zéro chaque mois, même pour un abonné à l'année.
 *
 * Module pur, sans alias d'import : le script Node le lit tel quel.
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
    cents: { mois: 899, an: 7500 },
    features: [
      { label: "Jusqu'à 50 pièces" },
      { label: '50 générations par mois' },
      { label: '30 questions à Kodi par mois' },
      { label: 'Tenue du jour et agenda' },
    ],
  },
  {
    id: 'atelier',
    name: 'Sapologue',
    note: 'Kodi devient ton styliste personnel',
    cents: { mois: 1899, an: 15900 },
    flagged: true,
    features: [
      { label: "Jusqu'à 100 pièces" },
      { label: '100 générations par mois' },
      { label: 'Kodi sans limite' },
      { label: 'Tenues d’occasion et valise de voyage' },
      // Pas encore construit : on ne vend pas ce qui n'existe pas.
      { label: 'Audit de garde-robe chaque trimestre', soon: true },
    ],
  },
];

/** Les packs de places de la boutique (Stripe : dressy_places_<pack>). Des places, jamais des générations. */
export const PLACE_PACKS = [
  { id: 'petit', places: 10, cents: 199, name: '+10 places' },
  { id: 'moyen', places: 30, cents: 499, name: '+30 places' },
] as const;
export type PlacePackId = (typeof PLACE_PACKS)[number]['id'];
export const isPlacePack = (v: unknown): v is PlacePackId => PLACE_PACKS.some((p) => p.id === v);
export const placesLookupKey = (pack: PlacePackId) => `dressy_places_${pack}`;

/**
 * Le tableau de comparaison du profil (référence « design price ») : une
 * ligne par promesse, cochée ou non pour chaque offre. `icon` nomme une
 * icône du jeu plein (components/icons.tsx).
 */
export const COMPARE: { icon: string; title: string; sub: string; capsule: boolean; atelier: boolean; soon?: boolean }[] = [
  { icon: 'hanger', title: 'Dressing numérique', sub: '50 pièces avec Fashion, 100 avec Sapologue', capsule: true, atelier: true },
  { icon: 'sparkle', title: 'Kodi, ton styliste', sub: '30 questions par mois avec Fashion', capsule: true, atelier: true },
  { icon: 'sparkle', title: 'Générations d’images', sub: '50 par mois avec Fashion, 100 avec Sapologue', capsule: true, atelier: true },
  { icon: 'cloud', title: 'Tenue du jour', sub: 'Selon la météo et ton agenda', capsule: true, atelier: true },
  { icon: 'chart', title: 'Suivi de ta garde-robe', sub: 'Pièces portées, barre de progression', capsule: true, atelier: true },
  { icon: 'infinity', title: 'Kodi sans limite', sub: 'Usage raisonnable : 300 questions par mois', capsule: false, atelier: true },
  { icon: 'party', title: 'Occasions et voyages', sub: 'Kodi prépare la tenue et la valise', capsule: false, atelier: true },
  { icon: 'layers', title: 'Audit de garde-robe', sub: 'Doublons, oublis et manques, chaque trimestre', capsule: false, atelier: true, soon: true },
];

/** Sans abonnement. Mêmes valeurs que plan_limits('decouverte'). */
export const FREE_PLAN = {
  id: 'decouverte' as const,
  name: 'Découverte',
  features: ["Jusqu'à 15 pièces", '4 générations offertes', '5 questions à Kodi par mois'],
};

/** Clé de recherche du prix chez Stripe : le code ne connaît jamais les identifiants price_…. */
export const lookupKey = (plan: PlanId, period: Period) => `dressy_${plan}_${period}`;

export const isPlan = (v: unknown): v is PlanId => PLANS.some((p) => p.id === v);
export const isPeriod = (v: unknown): v is Period => v === 'mois' || v === 'an';

/** La remise de l'année sur douze mois, en pour cent entier arrondi vers le bas : 899 / 7500 → 30. */
export const annualOff = (p: { cents: Record<Period, number> }) => Math.floor((1 - p.cents.an / (p.cents.mois * 12)) * 100);

/** Le prix de l'année ramené au mois, arrondi au centime supérieur : 7500 → 625. */
export const perMonth = (cents: number) => Math.ceil(cents / 12);

/** Le nom d'une offre, y compris celle qui n'est plus vendue. */
const RETIRED: Record<string, string> = { couture: 'Couture' };
export const planName = (id: string | null | undefined) =>
  PLANS.find((p) => p.id === id)?.name ?? (id && RETIRED[id]) ?? FREE_PLAN.name;

/** 699 → « 6,99 € ». */
export function euros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}
