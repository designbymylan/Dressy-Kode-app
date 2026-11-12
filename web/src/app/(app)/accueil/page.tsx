import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { loadHome } from '@/lib/accueil';
import { HomeView } from '@/components/HomeView';
import { avisAMontrer } from '@/lib/avis';

// « Compléter avec Kodi » (action serveur de cette page) attend la réponse de Kodi : souvent 10 à 30 s.
export const maxDuration = 60;

export default async function Accueil() {
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion');
  const supabase = await createClient();
  const home = await loadHome(supabase, viewer);

  return <HomeView home={home} name={viewer.displayName} avis={avisAMontrer(viewer.inscritLe, viewer.avisLus)} />;
}
