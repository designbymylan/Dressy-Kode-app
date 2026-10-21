import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { labelsFor } from '@/lib/onboarding';
import { loadWardrobe } from '@/lib/wardrobe';
import { KodiScreen } from '@/components/screens/KodiScreen';

/** Questions qu'un lien peut poser d'emblée (?q=…), depuis l'accueil ou le calendrier. */
const ASK: Record<string, string> = {
  oubliees: 'Mes pièces oubliées',
  tenue: 'Une tenue pour demain',
  bilan: 'Le bilan de mon dressing',
};

export default async function KodiPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  const supabase = await createClient();

  const [{ usage }, { data: sp }] = await Promise.all([
    loadWardrobe(supabase),
    supabase.from('style_profile').select('styles').eq('space_id', viewer.spaceId).maybeSingle(),
  ]);

  return (
    <KodiScreen
      data={{
        name: viewer.displayName,
        total: usage.total,
        pct: usage.pct,
        styles: labelsFor('styles', sp?.styles ?? []),
        ask: q ? ASK[q] ?? null : null,
      }}
    />
  );
}
