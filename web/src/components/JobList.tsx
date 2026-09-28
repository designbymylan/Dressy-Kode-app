'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ACTIVE_STATUSES, JOB_SELECT, jobNote, jobPhrases, jobTitle, type JobRow } from '@/lib/jobs';
import { JobActions } from '@/components/JobActions';
import { KodeThinking } from '@/components/KodeThinking';

export type JobView = JobRow & { photo: string | null };

const POLL_MS = 2000;

/**
 * Les pièces que l'agent prépare. On relit leur état (quelques octets)
 * toutes les 2 s : les pièces que Kode repère sur une photo apparaissent
 * d'elles-mêmes, chacune avec sa ligne. La page n'est rechargée que quand
 * une pièce arrive dans le dressing, pour ne pas re-télécharger toutes les
 * vignettes à chaque tour.
 */
export function JobList({ initial }: { initial: JobView[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initial);
  const latest = useRef(jobs);
  latest.current = jobs;
  const working = jobs.some((j) => j.status !== 'failed');

  // Les pièces repérées sur une photo reprennent la vignette de cette photo.
  const photos = useMemo(
    () => new Map(initial.filter((j) => j.photo).map((j) => [j.source_paths[0], j.photo])),
    [initial],
  );

  useEffect(() => {
    if (!working) return;
    const supabase = createClient();

    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const { data } = await supabase
        .from('ai_jobs')
        .select(JOB_SELECT)
        .in('status', [...ACTIVE_STATUSES, 'failed'])
        .order('created_at');
      if (!data) return;

      const rows = data as JobRow[];
      const alive = new Set(rows.map((r) => r.id));
      const prev = latest.current;
      setJobs(rows.map((r) => ({ ...r, photo: photos.get(r.source_paths[0]) ?? prev.find((p) => p.id === r.id)?.photo ?? null })));
      // Une pièce qui disparaît de la liste vient d'arriver dans le dressing.
      if (prev.some((j) => !alive.has(j.id))) router.refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [working, photos, router]);

  if (!jobs.length) return null;

  return (
    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {jobs.map((j) => {
        const failed = j.status === 'failed';
        const note = jobNote(j);
        return (
          <li key={j.id} className="pop" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                position: 'relative', flex: 'none', width: 56, height: 56, borderRadius: 16, overflow: 'hidden',
                background: 'var(--tile)', border: '1px solid var(--glass-edge)',
              }}
            >
              {j.photo ? (
                <img src={j.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: failed ? 0.5 : 1 }} />
              ) : null}
              {/* Le reflet qui balaie la photo : Kode est en train de la regarder. */}
              {failed ? null : <span className="shimmer" aria-hidden="true" style={{ position: 'absolute', inset: 0 }} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{jobTitle(j)}</span>
              {failed ? (
                <>
                  <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--muted)' }}>
                    {j.error ?? 'Kode n’a pas pu finir cette pièce.'}
                  </span>
                  <JobActions jobId={j.id} canRetry={j.retries < 2} />
                </>
              ) : (
                <KodeThinking key={j.status} phrases={jobPhrases(j)} size={18} every={2600} style={{ minHeight: 24, gap: 8 }} />
              )}
              {note ? <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--muted)' }}>{note}</span> : null}
              {j.user_input && !j.parent_id ? (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>« {j.user_input} »</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
