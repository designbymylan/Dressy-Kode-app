'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  ACTIVE_STATUSES, JOB_SELECT, groupByPhoto, jobNote, jobPhrases, jobStep, jobTitle, jobsFilter,
  type JobRow, type ScanPiece,
} from '@/lib/jobs';
import { iconFor } from '@/lib/wardrobe';
import { JobActions } from '@/components/JobActions';
import { KodeThinking } from '@/components/KodeThinking';
import { GlossIcon } from '@/components/Gloss';
import { PhotoScan } from '@/components/PhotoScan';
import { RevealCutout, type Reveal } from '@/components/RevealCutout';
import { ICON, Icon } from '@/components/ui';

/** `photo` : la photo confiée ; `cutout` : la pièce détourée, une fois rangée. */
export type JobView = JobRow & { photo: string | null; cutout: string | null };

const POLL_MS = 2000;
const ACTIVE = new Set<string>(ACTIVE_STATUSES);

/**
 * Les photos confiées à Kodi et leurs pièces.
 *
 * Chaque photo s'affiche en grand (scan de repérage) avec, dessous, une
 * ligne par pièce. On relit l'état des tâches toutes les 2 s (quelques
 * octets). Quand une pièce passe à « rangée » sous nos yeux, sa ligne joue
 * le détourage révélé ; la page n'est rechargée qu'une fois tous les effets
 * joués, pour que le dressing en dessous montre les nouvelles pièces.
 */
export function JobList({ initial }: { initial: JobView[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initial);
  const [reveals, setReveals] = useState<Record<string, Reveal>>({});
  const latest = useRef(jobs);
  latest.current = jobs;
  const playing = useRef(reveals);
  playing.current = reveals;
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const working = jobs.some((j) => ACTIVE.has(j.status));

  const photos = useMemo(
    () => new Map(initial.filter((j) => j.photo).map((j) => [j.source_paths[0], j.photo])),
    [initial],
  );

  // Recharge la page quand plus aucun effet ne joue.
  const refreshSoon = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      if (!Object.keys(playing.current).length) router.refresh();
    }, 500);
  }, [router]);

  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);

  /** Prépare le détourage révélé des pièces qui viennent d'être rangées. */
  const prepare = useCallback(async (arrived: JobRow[]) => {
    const supabase = createClient();
    const ready = arrived.filter((j) => j.analysis?.reveal && j.garment_id);
    if (!ready.length) return refreshSoon();

    const { data: garments } = await supabase
      .from('garments')
      .select('id, image_path')
      .in('id', ready.map((j) => j.garment_id!));
    const imageOf = new Map((garments ?? []).map((g) => [g.id as string, g.image_path as string | null]));

    const [raws, cuts] = await Promise.all([
      supabase.storage.from('ai-generated').createSignedUrls(ready.map((j) => j.analysis!.reveal!.raw), 900),
      supabase.storage.from('garments').createSignedUrls(ready.map((j) => imageOf.get(j.garment_id!) ?? ''), 900),
    ]);

    const next: Record<string, Reveal> = {};
    ready.forEach((j, i) => {
      const raw = raws.data?.[i]?.signedUrl;
      const cut = cuts.data?.[i]?.signedUrl;
      const r = j.analysis!.reveal!;
      if (raw && cut) next[j.id] = { raw, cut, size: r.size, box: r.box };
    });
    if (!Object.keys(next).length) return refreshSoon();
    setReveals((prev) => ({ ...prev, ...next }));
  }, [refreshSoon]);

  useEffect(() => {
    if (!working) return;
    const supabase = createClient();

    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const { data } = await supabase
        .from('ai_jobs')
        .select(JOB_SELECT)
        .or(jobsFilter())
        .order('created_at');
      if (!data) return;

      const rows = data as unknown as JobRow[];
      const prev = latest.current;
      const before = new Map(prev.map((p) => [p.id, p]));
      // Rangées sous nos yeux : elles étaient là, pas encore finies.
      const arrived = rows.filter((r) => r.status === 'done' && before.has(r.id) && before.get(r.id)!.status !== 'done');

      setJobs(rows.map((r) => ({
        ...r,
        photo: photos.get(r.source_paths[0]) ?? before.get(r.id)?.photo ?? prev.find((p) => p.source_paths[0] === r.source_paths[0])?.photo ?? null,
        cutout: before.get(r.id)?.cutout ?? null,
      })));
      if (arrived.length) void prepare(arrived);
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [working, photos, prepare]);

  const revealed = (id: string) => {
    const cut = playing.current[id]?.cut ?? null;
    setJobs((list) => list.map((j) => (j.id === id ? { ...j, cutout: cut } : j)));
    setReveals((prev) => {
      const rest = { ...prev };
      delete rest[id];
      return rest;
    });
    playing.current = { ...playing.current };
    delete playing.current[id];
    refreshSoon();
  };

  if (!jobs.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      {groupByPhoto(jobs).map((g) => {
        const parent = g.jobs.find((j) => !j.parent_id) ?? null;
        const pieceJobs = g.jobs.filter((j) => j.target || j.analysis?.name);
        const scanning = Boolean(parent && !parent.target && !parent.analysis?.inventory && ACTIVE.has(parent.status));
        const failedPhoto = g.jobs.filter((j) => !j.target && !j.analysis?.name && j.status === 'failed');

        const pieces: ScanPiece[] = pieceJobs.map((j) => ({
          key: j.id,
          name: jobTitle(j),
          box: j.target?.box ?? null,
          state: reveals[j.id] ? 'working' : j.status === 'done' ? 'done' : j.status === 'failed' ? 'failed' : 'working',
        }));
        // Pièces de la photo déjà rangées avant l'ouverture de l'écran.
        parent?.analysis?.inventory?.pieces.forEach((p, i) => {
          if (!pieces.some((q) => q.name === p.name)) pieces.push({ key: `inv${i}`, name: p.name, box: p.box ?? null, state: 'done' });
        });

        const note = parent ? jobNote(parent) : null;
        const hint = g.jobs[0].user_input;

        return (
          <section key={g.key} className="pop" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <PhotoScan photo={g.jobs[0].photo} pieces={pieces} scanning={scanning} dim={failedPhoto.length === g.jobs.length} />

            {scanning && parent ? (
              <KodeThinking phrases={jobPhrases(parent)} step={jobStep(parent)} center every={2400} />
            ) : null}
            {note ? <p className="small muted center">{note}</p> : null}
            {hint ? <p className="small muted center">« {hint} »</p> : null}

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {failedPhoto.map((j) => (
                <li key={j.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--muted)' }}>{j.error ?? 'Kodi n’a pas pu lire cette photo.'}</span>
                  <JobActions jobId={j.id} canRetry={j.retries < 2} />
                </li>
              ))}
              {pieceJobs.map((j, i) => {
                const reveal = reveals[j.id];
                const done = j.status === 'done' && !reveal;
                const failed = j.status === 'failed';
                return (
                  <li key={j.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="job-visual" data-big={reveal ? true : undefined}>
                      {reveal ? (
                        <RevealCutout reveal={reveal} size={136} name={jobTitle(j)} onDone={() => revealed(j.id)} />
                      ) : done && j.cutout ? (
                        <img className="job-cut pop" src={j.cutout} alt="" />
                      ) : (
                        <>
                          <GlossIcon d={iconFor(j.target?.category ?? '', j.target?.kind)} tone={i} size={50} />
                          {ACTIVE.has(j.status) ? <span className="shimmer" aria-hidden="true" style={{ position: 'absolute', inset: 0 }} /> : null}
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{jobTitle(j)}</span>
                      {failed ? (
                        <>
                          <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--muted)' }}>
                            {j.error ?? 'Kodi n’a pas pu finir cette pièce.'}
                          </span>
                          <JobActions jobId={j.id} canRetry={j.retries < 2} />
                        </>
                      ) : done ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: 'var(--ok)', fontWeight: 500 }}>
                          <Icon d={ICON.check} size={15} width={2.4} />
                          Rangée sur ton portant, sans fond
                        </span>
                      ) : reveal ? (
                        <KodeThinking phrases={['Kodi enlève le fond', 'Kodi la pose sur ton portant']} step="store" size={18} every={1400} style={{ minHeight: 24, gap: 8 }} />
                      ) : (
                        <KodeThinking phrases={jobPhrases(j)} step={jobStep(j)} size={18} every={2600} style={{ minHeight: 24, gap: 8 } as CSSProperties} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
