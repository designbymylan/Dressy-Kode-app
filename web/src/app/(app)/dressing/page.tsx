import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { ACTIVE_STATUSES, JOB_SELECT, jobsFilter, type JobRow } from '@/lib/jobs';
import { loadPieces, signAll } from '@/lib/garments';
import { CATEGORIES } from '@/lib/wardrobe';
import { JobList } from '@/components/JobList';
import { PieceArt } from '@/components/PieceArt';
import { Screen, Title, Card, Icon, ICON } from '@/components/ui';

export default async function Dressing({
  searchParams,
}: {
  searchParams: Promise<{ demande?: string }>;
}) {
  const { demande } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  const supabase = await createClient();

  const [items, { data: jobRows }] = await Promise.all([
    loadPieces(supabase),
    supabase
      .from('ai_jobs')
      .select(JOB_SELECT)
      // En cours, en échec, ou rangées depuis peu : la photo garde ses pièces cochées.
      .or(jobsFilter())
      .order('created_at'),
  ]);

  const jobs = (jobRows ?? []) as unknown as JobRow[];
  const active = new Set<string>(ACTIVE_STATUSES);
  const working = jobs.some((j) => active.has(j.status));
  const sources = await signAll(supabase, 'uploads', [...new Set(jobs.map((j) => j.source_paths[0]).filter(Boolean))]);

  // Les pièces déjà rangées montrent leur version détourée.
  const doneIds = jobs.filter((j) => j.status === 'done' && j.garment_id).map((j) => j.garment_id!);
  const { data: doneGarments } = doneIds.length
    ? await supabase.from('garments').select('id, thumb_path, image_path').in('id', doneIds)
    : { data: [] as { id: string; thumb_path: string | null; image_path: string | null }[] };
  const thumbOf = new Map((doneGarments ?? []).map((g) => [g.id, g.thumb_path ?? g.image_path]));
  const cutouts = await signAll(supabase, 'garments', [...thumbOf.values()].filter(Boolean) as string[]);

  // Un portant par catégorie, bijoux et accessoires compris.
  const rails = CATEGORIES.map((c) => ({ ...c, pieces: items.filter((g) => g.category_id === c.id) }));
  const sent = Number(demande) || 0;

  return (
    <Screen>
      <Title sub={`${items.length} pièce${items.length > 1 ? 's' : ''} dans ${viewer.spaceName.toLowerCase()}`}>
        <em className="accent">Dressing</em>
      </Title>

      {sent && working ? (
        <Card strong i={1}>
          <p role="status" className="small center">
            {sent > 1 ? `${sent} photos confiées à Kode.` : 'Photo confiée à Kode.'} Il repère chaque pièce
            et les dessine en même temps. Tu peux quitter cet écran : elles arriveront dans ton dressing,
            détourées, une fois vérifiées.
          </p>
        </Card>
      ) : null}

      {jobs.length ? (
        <Card i={1}>
          <h2 className="section-title">{working ? 'Kode s’occupe de tes photos' : 'Tout juste rangé'}</h2>
          {/* La clé change quand une pièce part, arrive ou est relancée : la liste repart de l'état serveur. */}
          <JobList
            key={jobs.map((j) => `${j.id}:${j.status}`).join('|')}
            initial={jobs.map((j) => ({
              ...j,
              photo: sources.get(j.source_paths[0]) ?? null,
              cutout: j.garment_id ? cutouts.get(thumbOf.get(j.garment_id) ?? '') ?? null : null,
            }))}
          />
        </Card>
      ) : null}

      {items.length === 0 ? (
        <Card center i={2}>
          <h2 style={{ fontSize: 22 }}>Ta garde-robe est <em className="accent">vide</em></h2>
          <p className="lead small">
            C&apos;est normal : rien n&apos;est ajouté pour toi. Commence par une pièce
            que tu portes souvent, un sac ou un bijou : Kode a besoin de deux ou trois
            pièces pour proposer sa première tenue.
          </p>
          <Link href="/dressing/ajouter" className="btn btn-primary btn-block">
            Ajouter une pièce
          </Link>
        </Card>
      ) : (
        <>
          {rails
            .filter((r) => r.pieces.length > 0)
            .map((rail, r) => (
              <section
                key={rail.id}
                className="rise"
                style={{ '--i': 2 + r, display: 'flex', flexDirection: 'column', gap: 10 } as CSSProperties}
              >
                <h2 className="eyebrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon d={rail.icon} size={14} width={1.8} />
                  {rail.label}
                  <span style={{ opacity: 0.6 }}>{rail.pieces.length}</span>
                </h2>
                <div className="scroll-x" style={{ paddingBlock: 4 }}>
                  {rail.pieces.map((p, i) => (
                    <article
                      key={p.id}
                      className="piece pop"
                      style={{ '--i': i, flex: 'none', width: 108 } as CSSProperties}
                    >
                      <div className="piece-frame" style={{ aspectRatio: 'auto', height: 124, padding: 10 }}>
                        <PieceArt piece={p} size={46} />
                      </div>
                      <span className="piece-name">{p.name}</span>
                    </article>
                  ))}
                </div>
              </section>
            ))}

          <div className="rise" style={{ '--i': 2 + rails.length, display: 'grid', gap: 10 } as CSSProperties}>
            <Link href="/dressing/ajouter" className="btn btn-primary btn-block">
              Ajouter une pièce
            </Link>
            {items.length >= 2 ? (
              <Link href="/tenues/nouvelle" className="btn btn-glass btn-block">
                <Icon d={ICON.sparkle} size={18} /> Composer une tenue
              </Link>
            ) : null}
          </div>
        </>
      )}
    </Screen>
  );
}
