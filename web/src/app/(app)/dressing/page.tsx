import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { ACTIVE_STATUSES, type JobRow } from '@/lib/jobs';
import { loadWardrobe, signAll, toPieces } from '@/lib/wardrobe';
import { DressingScreen } from '@/components/screens/DressingScreen';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default async function Dressing({
  searchParams,
}: {
  searchParams: Promise<{ demande?: string; q?: string; cat?: string }>;
}) {
  const { demande, q = '', cat } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  const supabase = await createClient();

  const [{ items, categories, usage }, { data: jobRows }] = await Promise.all([
    loadWardrobe(supabase),
    supabase
      .from('ai_jobs')
      .select('id, status, attempts, error, retries, user_input, source_paths')
      .in('status', [...ACTIVE_STATUSES, 'failed'])
      .order('created_at'),
  ]);

  const jobs = (jobRows ?? []) as JobRow[];
  const sources = await signAll(supabase, 'uploads', jobs.map((j) => j.source_paths[0]).filter(Boolean));

  const query = norm(q.trim());
  const category = categories.some((c) => c.id === cat) ? cat! : null;
  const shown = items.filter(
    (g) => (!category || g.category_id === category) && (!query || norm(g.name).includes(query)),
  );

  return (
    <DressingScreen
      data={{
        spaceName: viewer.spaceName,
        q: q.trim(),
        cat: category,
        categories: categories
          .map((c) => ({ ...c, count: items.filter((g) => g.category_id === c.id).length }))
          .filter((c) => c.count > 0),
        pieces: await toPieces(supabase, shown, usage, categories),
        totalPieces: items.length,
        usage: {
          total: usage.total,
          worn: usage.worn,
          pct: usage.pct,
          windowDays: usage.windowDays,
          categories: usage.categories,
        },
        jobs: jobs.map((j) => ({ ...j, photo: sources.get(j.source_paths[0]) ?? null })),
        sent: Number(demande) || 0,
      }}
    />
  );
}
