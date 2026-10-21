/** L'offre en cours d'un espace, telle que le webhook Stripe l'a enregistrée. */
import type { createClient } from '@/lib/supabase/server';
import type { Period, PlanId } from '@/lib/plans';

type Db = Awaited<ReturnType<typeof createClient>>;

export type Subscription = {
  plan: PlanId;
  period: Period;
  status: string;
  current_period_end: string | null;
  cancel_at: string | null;
  trial_end: string | null;
};

// Même règle que public.space_plan() : past_due garde les droits pendant les relances.
const ENTITLED = ['active', 'trialing', 'past_due'];
const RANK: Record<PlanId, number> = { capsule: 1, atelier: 2 };

/** L'abonnement qui ouvre les droits, ou null : l'espace est alors en Découverte. */
export async function loadSubscription(supabase: Db, spaceId: string): Promise<Subscription | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, period, status, current_period_end, cancel_at, trial_end')
    .eq('space_id', spaceId);
  const live = ((data ?? []) as Subscription[]).filter((s) => ENTITLED.includes(s.status));
  return live.sort((a, b) => RANK[b.plan] - RANK[a.plan])[0] ?? null;
}

const day = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(iso));

/** Une phrase sur l'état de l'abonnement : « Mois offert jusqu'au 26 octobre 2026. » */
export function subscriptionLine(s: Subscription): string {
  if (s.status === 'past_due') return 'Le dernier paiement n’est pas passé : mets ta carte à jour pour garder ton offre.';
  if (s.cancel_at) return `Résilié : ton offre reste active jusqu'au ${day(s.cancel_at)}.`;
  if (s.status === 'trialing' && s.trial_end) return `Mois offert jusqu'au ${day(s.trial_end)}, puis facturé une fois par an.`;
  if (s.current_period_end) return `Renouvellement le ${day(s.current_period_end)}.`;
  return 'Abonnement actif.';
}
