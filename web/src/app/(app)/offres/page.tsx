import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { loadSubscription } from '@/lib/billing';
import { OffersPicker } from '@/components/OffersPicker';

export default async function Offres() {
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  const supabase = await createClient();

  const [subscription, { count }] = await Promise.all([
    loadSubscription(supabase, viewer.spaceId),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('space_id', viewer.spaceId),
  ]);

  // Le mois offert ne vaut qu'une fois : l'Edge Function billing applique la
  // même règle, cet affichage ne fait que l'annoncer.
  return <OffersPicker current={subscription?.plan ?? null} trial={!count} />;
}
