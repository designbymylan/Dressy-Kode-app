import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/space';
import { createClient } from '@/lib/supabase/server';
import { Onboarding } from '@/components/Onboarding';
import { EMPTY_ANSWERS, type Answers } from '@/lib/onboarding';

/**
 * Hors du groupe (app) : pas de barre d'onglets tant que le démarrage n'est
 * pas fait. `?ajuster=1` rouvre le questionnaire depuis le compte, prérempli
 * avec les réponses déjà données.
 */
export default async function Demarrage({
  searchParams,
}: {
  searchParams: Promise<{ ajuster?: string }>;
}) {
  const { ajuster } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  if (viewer.onboardedAt && !ajuster) redirect('/accueil');

  const supabase = await createClient();
  const { data } = await supabase
    .from('style_profile')
    .select('*')
    .eq('space_id', viewer.spaceId)
    .maybeSingle();

  const initial: Answers = {
    ...EMPTY_ANSWERS,
    display_name: viewer.displayName ?? '',
    gender: data?.gender ?? null,
    goals: data?.goals ?? [],
    styles: data?.styles ?? [],
    favourite_items: data?.favourite_items ?? [],
    colours: data?.colours ?? [],
    avoid: data?.avoid ?? [],
    occasions: data?.occasions ?? [],
    morning_time: data?.morning_time ?? null,
    time_intent: data?.time_intent ?? null,
    assistance: data?.assistance ?? null,
  };

  return <Onboarding initial={initial} adjusting={Boolean(ajuster)} />;
}
