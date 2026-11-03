import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { loadPieces } from '@/lib/garments';
import { OutfitBuilder } from '@/components/OutfitBuilder';
import { parisDay } from '@/lib/dates';
import { ISO, relativeDay } from '@/lib/planning';
import { Screen, Title } from '@/components/ui';

export default async function NouvelleTenue({ searchParams }: { searchParams: Promise<{ avec?: string; jour?: string }> }) {
  const { avec, jour } = await searchParams;
  // Venue du calendrier : le jour à habiller (aujourd'hui ou plus tard).
  const today = parisDay(0);
  const day = jour && ISO.test(jour) && jour >= today ? jour : undefined;
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion');
  const supabase = await createClient();
  const pieces = await loadPieces(supabase);

  return (
    <Screen>
      <Title sub={day ? `Pour ${relativeDay(day, today)}. Fais défiler, garde ce qui te plaît, mélange le reste.` : 'Fais défiler, garde ce qui te plaît, mélange le reste.'}>
        Compose ta <em className="accent">tenue</em>
      </Title>
      <OutfitBuilder pieces={pieces} start={avec} day={day} dayLabel={day ? relativeDay(day, today) : undefined} />
    </Screen>
  );
}
