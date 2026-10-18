import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { loadPieces } from '@/lib/garments';
import { OutfitBuilder } from '@/components/OutfitBuilder';
import { Screen, Title } from '@/components/ui';

export default async function NouvelleTenue({ searchParams }: { searchParams: Promise<{ avec?: string }> }) {
  const { avec } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  const supabase = await createClient();
  const pieces = await loadPieces(supabase);

  return (
    <Screen>
      <Title sub="Fais défiler, garde ce qui te plaît, mélange le reste.">
        Compose ta <em className="accent">tenue</em>
      </Title>
      <OutfitBuilder pieces={pieces} start={avec} />
    </Screen>
  );
}
