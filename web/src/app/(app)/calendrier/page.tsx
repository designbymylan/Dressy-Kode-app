import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { loadAgenda } from '@/lib/agenda';
import { CalendarView } from '@/components/CalendarView';

// « Demander à Kodi » et « Préparer ces jours » (actions serveur de cette page) attendent la réponse de Kodi : souvent 10 à 30 s.
export const maxDuration = 60;

/**
 * Le calendrier : la semaine avec sa météo (aujourd'hui et les treize jours
 * suivants) ou le mois en grand, et sous chacun le jour ouvert, avec ses
 * rendez-vous et sa tenue. L'état vit dans l'adresse : ?jour=AAAA-MM-JJ,
 * ?vue=mois, ?mois=AAAA-MM.
 */
export default async function Calendrier({ searchParams }: { searchParams: Promise<{ jour?: string; vue?: string; mois?: string }> }) {
  const params = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion');
  const supabase = await createClient();
  const agenda = await loadAgenda(supabase, viewer, params);

  return <CalendarView a={agenda} />;
}
