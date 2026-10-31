import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { isFree, loadGeneration } from '@/lib/generations';
import { QuotaEnd } from '@/components/QuotaEnd';
import { Screen, Title } from '@/components/ui';

/** Fin des générations offertes : un seul écran, pour qui n'a pas d'abonnement. */
export default async function Generations() {
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion');
  const supabase = await createClient();

  const generation = await loadGeneration(supabase, viewer.spaceId);
  // Un abonné n'a rien à voir ici : son offre a déjà ses générations.
  if (generation && !isFree(generation)) redirect('/offres');

  return (
    <Screen>
      <Title>Tu as utilisé tes générations offertes.</Title>
      <QuotaEnd />
    </Screen>
  );
}
