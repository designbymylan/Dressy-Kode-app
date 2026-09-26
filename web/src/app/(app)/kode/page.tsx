import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { parisDay } from '@/lib/dates';
import { loadMessages, loadUsage } from '@/lib/kode';
import { KodeChat } from '@/components/KodeChat';

// La réponse de Kode prend souvent 10 à 30 s : la valeur par défaut de
// certains hébergeurs (10 s) couperait l'action serveur avant la fin.
export const maxDuration = 60;

export default async function Kode() {
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  const supabase = await createClient();

  const [messages, usage, { count }, { data: tomorrow }] = await Promise.all([
    loadMessages(supabase, viewer.spaceId),
    loadUsage(supabase, viewer.spaceId),
    supabase.from('garments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('planned_days').select('outfit_id').eq('space_id', viewer.spaceId).eq('day', parisDay(1)).maybeSingle(),
  ]);

  return (
    <KodeChat
      name={viewer.displayName}
      initial={messages}
      usage={usage}
      plannedTomorrow={tomorrow?.outfit_id ?? null}
      pieces={count ?? 0}
    />
  );
}
