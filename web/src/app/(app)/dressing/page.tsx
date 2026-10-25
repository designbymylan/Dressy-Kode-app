import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { ACTIVE_STATUSES, JOB_SELECT, jobsFilter, type JobRow } from '@/lib/jobs';
import { loadPieces, signAll } from '@/lib/garments';
import { CATEGORIES } from '@/lib/wardrobe';
import { parisDay } from '@/lib/dates';
import { usageMood, usageOf, WINDOW_DAYS } from '@/lib/usage';
import { JobList } from '@/components/JobList';
import { DressingRails, type WearStat } from '@/components/DressingRails';
import { Kodi } from '@/components/Kodi';
import { Screen, Title, Card, Cut, Icon, ICON, ProgressBar } from '@/components/ui';

export default async function Dressing({
  searchParams,
}: {
  searchParams: Promise<{ demande?: string }>;
}) {
  const { demande } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  const supabase = await createClient();

  const [items, { data: jobRows }, { data: statRows }] = await Promise.all([
    loadPieces(supabase),
    supabase
      .from('ai_jobs')
      .select(JOB_SELECT)
      // En cours, en échec, ou rangées depuis peu : la photo garde ses pièces cochées.
      .or(jobsFilter())
      .order('created_at'),
    supabase.from('garment_stats').select('garment_id, wear_count, last_worn_on').eq('space_id', viewer.spaceId),
  ]);
  const stats: Record<string, WearStat> = Object.fromEntries(
    ((statRows ?? []) as { garment_id: string; wear_count: number | null; last_worn_on: string | null }[])
      .map((st) => [st.garment_id, { wears: st.wear_count ?? 0, last: st.last_worn_on }]),
  );

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
  const rails = CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon, pieces: items.filter((g) => g.category_id === c.id) }));
  const sent = Number(demande) || 0;

  // La barre de progression : la part du dressing portée ces 90 derniers jours.
  const usage = usageOf(items, Object.fromEntries(Object.entries(stats).map(([id, st]) => [id, st.last])), CATEGORIES, parisDay(-WINDOW_DAYS));
  const kodi = usageMood(usage);

  return (
    <Screen>
      <Title sub={`${items.length} pièce${items.length > 1 ? 's' : ''} dans ${viewer.spaceName.toLowerCase()}`}>
        <em className="accent">Dressing</em>
      </Title>

      {usage.total ? (
        <Cut close label="Pièces portées" i={1}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="eyebrow">Pièces portées</span>
              <p className="stat" style={{ fontSize: 26, lineHeight: 1.1 }}>
                {usage.worn} sur {usage.total} pièce{usage.total > 1 ? 's' : ''}
              </p>
              <span className="small muted">portée{usage.worn > 1 ? 's' : ''} ces {WINDOW_DAYS} derniers jours</span>
            </div>
            <Kodi mood={kodi.mood} size={66} track />
          </div>

          <ProgressBar value={usage.pct} label={`Part de ta garde-robe portée ces ${WINDOW_DAYS} derniers jours`} />
          <p className="small" style={{ color: 'var(--on-panel-muted)' }}>{kodi.line}</p>

          {usage.categories.length > 1 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 14px', marginTop: 2 }}>
              {usage.categories.map((c) => (
                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 13, fontWeight: 600 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                    <span style={{ color: 'var(--on-panel-muted)', fontWeight: 500 }}>{c.worn}/{c.total}</span>
                  </span>
                  <ProgressBar value={c.pct} size="sm" label={`${c.label} : part portée`} />
                </div>
              ))}
            </div>
          ) : null}
        </Cut>
      ) : null}

      {sent && working ? (
        <Card strong i={1}>
          <p role="status" className="small center">
            {sent > 1 ? `${sent} photos confiées à Kodi.` : 'Photo confiée à Kodi.'} Il repère chaque pièce
            et les dessine en même temps. Tu peux quitter cet écran : elles arriveront dans ton dressing,
            détourées, une fois vérifiées.
          </p>
        </Card>
      ) : null}

      {jobs.length ? (
        <Card i={1}>
          <h2 className="section-title">{working ? 'Kodi s’occupe de tes photos' : 'Tout juste rangé'}</h2>
          {/* La clé change quand une pièce part, arrive ou est relancée : la liste repart de l’état serveur. */}
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
            C’est normal : rien n’est ajouté pour toi. Commence par une pièce
            que tu portes souvent, un sac ou un bijou : Kodi a besoin de deux ou trois
            pièces pour proposer sa première tenue.
          </p>
          <Link href="/dressing/ajouter" className="btn btn-primary btn-block">
            Ajouter une pièce
          </Link>
        </Card>
      ) : (
        <>
          <DressingRails rails={rails.filter((r) => r.pieces.length > 0)} stats={stats} />

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
