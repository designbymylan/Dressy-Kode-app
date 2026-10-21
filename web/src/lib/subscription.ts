import type { createClient } from '@/lib/supabase/server';
import { planFrom, type PlanId } from '@/lib/plans';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** L'offre en cours de l'espace et sa date de renouvellement (JJ/MM/AAAA). */
export async function getPlan(supabase: Supabase, spaceId: string): Promise<{ plan: PlanId; renews: string | null }> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end')
    .eq('space_id', spaceId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan = planFrom(data);
  const renews =
    plan !== 'decouverte' && data?.current_period_end
      ? new Intl.DateTimeFormat('fr-FR').format(new Date(data.current_period_end))
      : null;
  return { plan, renews };
}
