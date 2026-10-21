import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { getPlan } from '@/lib/subscription';
import { asleepCount, loadWardrobe, toPieces } from '@/lib/wardrobe';
import { HomeScreen } from '@/components/screens/HomeScreen';

export default async function Accueil() {
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  const supabase = await createClient();

  const [{ items, categories, usage }, { plan }] = await Promise.all([
    loadWardrobe(supabase),
    getPlan(supabase, viewer.spaceId),
  ]);
  const recent = await toPieces(supabase, items.slice(0, 8), usage, categories);
  const hour = Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hour12: false, timeZone: 'Europe/Paris' }).format(new Date()));

  return (
    <HomeScreen
      data={{
        name: viewer.displayName,
        avatarUrl: viewer.avatarUrl,
        hour,
        total: usage.total,
        worn: usage.worn,
        pct: usage.pct,
        asleep: asleepCount(items, usage),
        recent,
        plan,
      }}
    />
  );
}
