import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { ACTIVE_STATUSES, type JobRow } from '@/lib/jobs';
import { signAll } from '@/lib/storage';
import { JobList } from '@/components/JobList';
import { Screen, Title, Card, buttonPrimary } from '@/components/ui';

export default async function Dressing({
  searchParams,
}: {
  searchParams: Promise<{ demande?: string }>;
}) {
  const { demande } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  const supabase = await createClient();

  const [{ data: categories }, { data: garments }, { data: jobRows }] = await Promise.all([
    supabase.from('categories').select('id, label, sort, shelf').order('sort'),
    supabase
      .from('garments')
      .select('id, name, category_id, status, image_path, thumb_path')
      .order('created_at', { ascending: false }),
    supabase
      .from('ai_jobs')
      .select('id, status, attempts, error, retries, user_input, source_paths')
      .in('status', [...ACTIVE_STATUSES, 'failed'])
      .order('created_at'),
  ]);

  const items = garments ?? [];
  const jobs = (jobRows ?? []) as JobRow[];
  const working = jobs.some((j) => j.status !== 'failed');

  const [pictures, sources] = await Promise.all([
    signAll(supabase, 'garments', items.map((g) => g.thumb_path ?? g.image_path).filter(Boolean) as string[]),
    signAll(supabase, 'uploads', jobs.map((j) => j.source_paths[0]).filter(Boolean)),
  ]);

  const rails = (categories ?? []).map((c) => ({
    ...c,
    pieces: items.filter((g) => g.category_id === c.id),
  }));

  const sent = Number(demande) || 0;

  return (
    <Screen>
      <Title sub={`${items.length} pièce${items.length > 1 ? 's' : ''} dans ${viewer.spaceName.toLowerCase()}`}>
        Dressing
      </Title>

      {sent && working ? (
        <Card style={{ background: 'var(--accent-tint)', boxShadow: 'none' }}>
          <p role="status" style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--accent-ink)' }}>
            {sent > 1 ? `${sent} photos confiées à Kode.` : 'Photo confiée à Kode.'} Tu peux quitter
            cet écran : les pièces arriveront dans ton dressing une fois vérifiées.
          </p>
        </Card>
      ) : null}

      {jobs.length ? (
        <Card>
          <h2 style={{ fontSize: 17 }}>En préparation</h2>
          {/* La clé change quand une pièce part, arrive ou est relancée : la liste repart de l'état serveur. */}
          <JobList
            key={jobs.map((j) => `${j.id}:${j.status}`).join('|')}
            initial={jobs.map((j) => ({ ...j, photo: sources.get(j.source_paths[0]) ?? null }))}
          />
        </Card>
      ) : null}

      {items.length === 0 ? (
        <Card>
          <h2 style={{ fontSize: 21 }}>Ta garde-robe est vide</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--muted)' }}>
            C&apos;est normal : rien n&apos;est ajouté pour toi. Commence par une pièce
            que tu portes souvent — Kode a besoin de deux ou trois vêtements pour
            proposer sa première tenue.
          </p>
          <Link href="/dressing/ajouter" style={{ ...buttonPrimary, alignSelf: 'flex-start' }}>
            Ajouter une pièce
          </Link>
        </Card>
      ) : (
        <>
          {rails
            .filter((r) => r.pieces.length > 0)
            .map((rail) => (
              <section key={rail.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h2
                  style={{
                    fontFamily: 'inherit', fontSize: 11, fontWeight: 500, letterSpacing: '.06em',
                    textTransform: 'uppercase', color: 'var(--muted)',
                  }}
                >
                  {rail.label}
                </h2>
                <div data-scroll style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
                  {rail.pieces.map((p) => {
                    const url = pictures.get((p.thumb_path ?? p.image_path) as string);
                    return (
                      <article
                        key={p.id}
                        style={{
                          flex: 'none', width: 108, display: 'flex', flexDirection: 'column',
                          gap: 8, alignItems: 'center',
                        }}
                      >
                        <div
                          style={{
                            width: '100%', height: 124, borderRadius: 20, background: 'var(--tile)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10,
                          }}
                        >
                          {url ? (
                            <img
                              src={url}
                              alt=""
                              loading="lazy"
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                          ) : (
                            <svg width="46" height="46" viewBox="0 0 24 24" fill="none"
                              stroke="var(--muted)" strokeWidth="1.2" strokeLinejoin="round" aria-hidden="true">
                              <path d="M8 4 12 6.5 16 4l5 2.5-2 4-2-1V20H7V9.5l-2 1-2-4Z" />
                            </svg>
                          )}
                        </div>
                        <span style={{ fontSize: 12, textAlign: 'center' }}>{p.name}</span>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}

          <Link href="/dressing/ajouter" style={{ ...buttonPrimary, alignSelf: 'flex-start' }}>
            Ajouter une pièce
          </Link>
        </>
      )}
    </Screen>
  );
}
