import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { parisDay } from '@/lib/dates';
import { outfitViews, OUTFIT_SELECT, type OutfitRow } from '@/lib/kode';
import { OutfitCard } from '@/components/OutfitCard';
import { WearButton } from '@/components/WearButton';
import { Screen, Title, Card, Icon, ICON } from '@/components/ui';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export default async function Accueil() {
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion');
  const supabase = await createClient();

  const [{ count }, { data: planned }, { data: semaine }] = await Promise.all([
    supabase.from('garments').select('id', { count: 'exact', head: true }),
    // La tenue prévue pour aujourd'hui (par Kodi ou à la main) passe avant tout le reste.
    supabase
      .from('planned_days')
      .select(`worn, outfits(${OUTFIT_SELECT})`)
      .eq('space_id', viewer.spaceId)
      .eq('day', parisDay(0))
      .maybeSingle(),
    // Les sept jours à venir, pour la bande « Ta semaine ».
    supabase
      .from('planned_days')
      .select('day, outfit_id')
      .eq('space_id', viewer.spaceId)
      .gte('day', parisDay(0))
      .lte('day', parisDay(6)),
  ]);

  const n = count ?? 0;
  const row = (planned?.outfits ?? null) as unknown as OutfitRow | null;
  const outfit = row ? (await outfitViews(supabase, [{ outfit: row }])).get(row.id) ?? null : null;
  // Les ports déjà notés pour ces pièces : le compteur de « Je la porte » part de là.
  const { data: stats } = outfit
    ? await supabase.from('garment_stats').select('wear_count').in('garment_id', outfit.pieces.map((p) => p.id))
    : { data: [] as { wear_count: number | null }[] };
  const ports = (stats ?? []).reduce((n, st) => n + (st.wear_count ?? 0), 0);
  const today = new Date();
  const dateLabel = `${JOURS[today.getDay()]} ${today.getDate()} ${MOIS[today.getMonth()]}`;

  return (
    <Screen>
      <Title sub={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}>
        {viewer.displayName ? <>Salut, <em className="accent">{viewer.displayName}</em></> : 'Salut'}
      </Title>

      {outfit ? (
        <section className="rise" style={{ '--i': 1, display: 'flex', flexDirection: 'column', gap: 12 } as CSSProperties}>
          <h2 className="section-title">Tenue du <em className="accent">jour</em></h2>
          <OutfitCard outfit={outfit} assemble>
            <WearButton
              outfitId={outfit.id}
              worn={Boolean(planned?.worn)}
              colours={outfit.pieces.map((p) => p.colour).filter((x): x is string => Boolean(x))}
              ports={ports}
              count={outfit.pieces.length}
            />
          </OutfitCard>
        </section>
      ) : n === 0 ? (
        <Card center i={1}>
          <h2 style={{ fontSize: 22 }}>On commence par <em className="accent">tes vêtements</em></h2>
          <p className="lead small">
            Ton espace est prêt et il est vide : rien n&apos;y est ajouté sans toi.
            Dès que deux ou trois pièces y seront, Kodi pourra composer une tenue
            avec ce que tu as déjà.
          </p>
          <Link href="/dressing/ajouter" className="btn btn-primary btn-block">
            Ajouter ma première pièce
          </Link>
        </Card>
      ) : (
        <Card center i={1}>
          <h2 style={{ fontSize: 22 }}>Tenue du <em className="accent">jour</em></h2>
          <p className="lead small">
            {n} pièce{n > 1 ? 's' : ''} dans ton dressing.{' '}
            {n < 2
              ? 'Encore une ou deux et tu pourras composer une tenue complète.'
              : 'Compose ta tenue en quelques gestes, ou demande à Kodi.'}
          </p>
          {n < 2 ? (
            <Link href="/dressing/ajouter" className="btn btn-primary btn-block">Ajouter une pièce</Link>
          ) : (
            <>
              <Link href="/tenues/nouvelle" className="btn btn-primary btn-block">
                <Icon d={ICON.sparkle} size={18} /> Composer ma tenue
              </Link>
              <Link href="/kodi" className="btn btn-glass btn-block">Demander à Kodi</Link>
            </>
          )}
        </Card>
      )}

      {n > 0 ? <Semaine jours={semaine ?? []} /> : null}
    </Screen>
  );
}

const JOURS_COURTS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const dot = (color: string): CSSProperties => ({ width: 5, height: 5, borderRadius: 999, background: color });

/**
 * « Ta semaine » : sept jours à partir d'aujourd'hui, un point pour chaque
 * tenue prévue. Un toucher ouvre le calendrier du mois.
 */
function Semaine({ jours }: { jours: { day: string; outfit_id: string | null }[] }) {
  const prevus = new Set(jours.filter((j) => j.outfit_id).map((j) => j.day));
  const semaine = Array.from({ length: 7 }, (_, i) => parisDay(i));

  return (
    <section className="rise" style={{ '--i': 2, display: 'flex', flexDirection: 'column', gap: 12 } as CSSProperties}>
      <h2 className="section-title">Ta <em className="accent">semaine</em> <Link href="/calendrier">Calendrier</Link></h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {semaine.map((day, i) => {
          const aujourdhui = i === 0;
          const lettre = JOURS_COURTS[new Date(`${day}T12:00:00Z`).getUTCDay()];
          return (
            <Link
              key={day}
              href={`/calendrier?mois=${day.slice(0, 7)}`}
              aria-label={`${Number(day.slice(8))}${prevus.has(day) ? ', tenue prévue' : ''}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 0', borderRadius: 18,
                color: aujourdhui ? '#000000' : 'var(--ink)',
                background: aujourdhui ? 'var(--blue-glass)' : 'var(--glass)',
                border: `1px solid ${aujourdhui ? 'rgba(255, 255, 255, 0.7)' : 'var(--glass-edge)'}`,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 500, opacity: aujourdhui ? 0.8 : 1, color: aujourdhui ? '#000000' : 'var(--muted)' }}>{lettre}</span>
              <span style={{ fontSize: 15, fontWeight: aujourdhui ? 600 : 500 }}>{Number(day.slice(8))}</span>
              <span style={{ height: 5, display: 'flex' }}>
                {prevus.has(day) ? <span style={dot(aujourdhui ? '#000000' : 'var(--blue-ink)')} /> : null}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
