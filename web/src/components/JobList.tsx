'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { jobLabel, type JobRow } from '@/lib/jobs';
import { JobActions } from '@/components/JobActions';

export type JobView = JobRow & { photo: string | null };

const POLL_MS = 3000;

/**
 * Les pièces que l'agent prépare. On ne relit que leur état (quelques
 * octets) toutes les 3 s ; la page entière n'est rechargée que lorsqu'une
 * pièce arrive, pour ne pas re-télécharger toutes les vignettes du dressing
 * à chaque tour.
 */
export function JobList({ initial }: { initial: JobView[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initial);
  const working = jobs.some((j) => j.status !== 'failed');

  useEffect(() => {
    if (!working) return;
    const supabase = createClient();
    const ids = jobs.map((j) => j.id);

    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const { data } = await supabase
        .from('ai_jobs')
        .select('id, status, attempts, error, retries')
        .in('id', ids);
      if (!data) return;

      const byId = new Map(data.map((d) => [d.id, d]));
      const finished = ids.some((id) => !byId.has(id) || byId.get(id)!.status === 'done');
      if (finished) {
        router.refresh();
        return;
      }
      setJobs((prev) => prev.map((j) => ({ ...j, ...byId.get(j.id) })));
    }, POLL_MS);

    return () => clearInterval(timer);
    // Les ids ne changent qu'au rechargement de la page, qui remonte ce
    // composant avec une nouvelle clé : `working` suffit comme dépendance.
  }, [working]);

  if (!jobs.length) return null;

  return (
    <ul aria-live="polite" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {jobs.map((j) => {
        const failed = j.status === 'failed';
        return (
          <li key={j.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                flex: 'none', width: 52, height: 52, borderRadius: 14, overflow: 'hidden',
                background: 'var(--tile)',
              }}
            >
              {j.photo ? (
                <img src={j.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}>
                <span
                  aria-hidden="true"
                  {...(failed ? {} : { 'data-pulse': true })}
                  style={{
                    flex: 'none', width: 8, height: 8, borderRadius: 999,
                    background: failed ? 'var(--danger)' : 'var(--accent-strong)',
                  }}
                />
                {jobLabel(j)}
              </span>
              {j.user_input ? (
                <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>« {j.user_input} »</span>
              ) : null}
              {failed ? (
                <>
                  {j.error ? (
                    <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--muted)' }}>{j.error}</span>
                  ) : null}
                  <JobActions jobId={j.id} canRetry={j.retries < 2} />
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
