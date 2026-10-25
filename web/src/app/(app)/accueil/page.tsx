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
  if (!viewer) redirect('/bienvenue');
  const supabase = await createClient();

  const [{ count }, { data: planned }] = await Promise.all([
    supabase.from('garments').select('id', { count: 'exact', head: true }),
    // La tenue prévue pour aujourd'hui (par Kodi ou à la main) passe avant tout le reste.
    supabase
      .from('planned_days')
      .select(`worn, outfits(${OUTFIT_SELECT})`)
      .eq('space_id', viewer.spaceId)
      .eq('day', parisDay(0))
      .maybeSingle(),
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
    </Screen>
  );
}
