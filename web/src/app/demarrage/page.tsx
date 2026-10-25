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
  if (!viewer) redirect('/connexion');
  if (viewer.onboardedAt && !ajuster) redirect('/accueil');

  const supabase = await createClient();
  const { data } = await supabase
    .from('style_profile')
    .select('*')
    .eq('space_id', viewer.spaceId)
    .maybeSingle();

  // À l'inscription par e-mail, le profil reçoit la partie avant « @ » en
  // guise de nom : ce n'est pas un prénom, le champ reste vide.
  const localPart = viewer.email?.split('@')[0] ?? null;
  const known = viewer.displayName && viewer.displayName !== localPart ? viewer.displayName : null;

  const initial: Answers = {
    ...EMPTY_ANSWERS,
    display_name: known ?? viewer.givenName ?? '',
    gender: data?.gender ?? null,
    goals: data?.goals ?? [],
    styles: data?.styles ?? [],
    favourite_items: data?.favourite_items ?? [],
    jewelry: data?.jewelry ?? [],
    jewelry_wish: data?.jewelry_wish ?? [],
    metals: data?.metals ?? [],
    accessories: data?.accessories ?? [],
    accessories_wish: data?.accessories_wish ?? [],
    colours: data?.colours ?? [],
    avoid: data?.avoid ?? [],
    occasions: data?.occasions ?? [],
    morning_time: data?.morning_time ?? null,
    time_intent: data?.time_intent ?? null,
    assistance: data?.assistance ?? null,
  };

  return <Onboarding initial={initial} adjusting={Boolean(ajuster)} />;
}
