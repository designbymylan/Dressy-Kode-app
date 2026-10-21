/**
 * Ce que Dressy retient d'un abonnement Stripe. Logique pure, sans réseau :
 * c'est elle qui décide qui a payé quoi, elle est donc testée à part
 * (supabase/functions/_shared/billing.test.ts).
 *
 * Les identifiants et la forme des clés suivent web/src/lib/plans.ts.
 * Depuis le 21/10, deux offres : `capsule` porte Fashion, `atelier`
 * Sapologue. Couture n'est plus vendue (aucun abonné ne l'avait).
 */

export const PLAN_IDS = ['capsule', 'atelier'] as const;
export const PERIODS = ['mois', 'an'] as const;

export type PlanId = (typeof PLAN_IDS)[number];
export type Period = (typeof PERIODS)[number];

/** Un abonnement dans ces états ouvre les droits de son offre. */
export const ENTITLED = ['active', 'trialing', 'past_due'] as const;

export const TRIAL_DAYS = 30;

export const isPlan = (v: unknown): v is PlanId => (PLAN_IDS as readonly unknown[]).includes(v);
export const isPeriod = (v: unknown): v is Period => (PERIODS as readonly unknown[]).includes(v);

export const lookupKey = (plan: PlanId, period: Period) => `dressy_${plan}_${period}`;

export function parseLookupKey(key: string | null | undefined): { plan: PlanId; period: Period } | null {
  const m = /^dressy_([a-z]+)_([a-z]+)$/.exec(key ?? '');
  if (!m || !isPlan(m[1]) || !isPeriod(m[2])) return null;
  return { plan: m[1], period: m[2] };
}

/** Le strict nécessaire d'un objet Subscription de Stripe (API 2026-08-26). */
export type SubscriptionLike = {
  id: string;
  customer: string | { id: string };
  status: string;
  metadata: Record<string, string> | null;
  cancel_at: number | null;
  cancel_at_period_end: boolean;
  trial_end: number | null;
  items: {
    data: {
      // Depuis l'API 2025-03-31, la période est portée par l'article, plus par l'abonnement.
      current_period_end: number;
      price: { id: string; lookup_key: string | null };
    }[];
  };
};

export type SubscriptionRow = {
  id: string;
  space_id: string;
  stripe_customer_id: string;
  plan: PlanId;
  period: Period;
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at: string | null;
  trial_end: string | null;
};

const iso = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000).toISOString() : null;

/**
 * La ligne à enregistrer, ou null si l'abonnement ne porte aucun prix Dressy
 * (un produit créé à la main dans Stripe, par exemple).
 */
export function subscriptionRow(sub: SubscriptionLike, spaceId: string): SubscriptionRow | null {
  const item = sub.items.data.find((i) => parseLookupKey(i.price.lookup_key));
  if (!item) return null;
  const { plan, period } = parseLookupKey(item.price.lookup_key)!;
  const periodEnd = iso(item.current_period_end);

  return {
    id: sub.id,
    space_id: spaceId,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    plan,
    period,
    status: sub.status,
    price_id: item.price.id,
    current_period_end: periodEnd,
    // Une résiliation depuis le portail peut poser l'un ou l'autre.
    cancel_at: iso(sub.cancel_at) ?? (sub.cancel_at_period_end ? periodEnd : null),
    trial_end: iso(sub.trial_end),
  };
}

/** L'espace d'un abonnement : posé à la création, sinon retrouvé par le client. */
export function spaceOf(sub: Pick<SubscriptionLike, 'metadata'>, fallback: string | null): string | null {
  const id = sub.metadata?.space_id || fallback;
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
