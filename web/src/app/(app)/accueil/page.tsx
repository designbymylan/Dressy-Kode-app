import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { parisDay, parisDateLabel } from '@/lib/dates';
import { outfitViews, OUTFIT_SELECT, type OutfitRow } from '@/lib/kode';
import { OutfitCard } from '@/components/OutfitCard';
import { WearButton } from '@/components/WearButton';
import { Screen, Title, Card, buttonPrimary } from '@/components/ui';

export default async function Accueil() {
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  const supabase = await createClient();

  const [{ count }, { data: today }] = await Promise.all([
    supabase.from('garments').select('id', { count: 'exact', head: true }),
    supabase
      .from('planned_days')
      .select(`worn, outfits(${OUTFIT_SELECT})`)
      .eq('space_id', viewer.spaceId)
      .eq('day', parisDay(0))
      .maybeSingle(),
  ]);

  const n = count ?? 0;
  const planned = (today?.outfits ?? null) as unknown as OutfitRow | null;
  const outfit = planned ? (await outfitViews(supabase, [{ outfit: planned }])).get(planned.id) ?? null : null;

  return (
    <Screen>
      <Title sub={parisDateLabel()}>
        {viewer.displayName ? `Salut, ${viewer.displayName}` : 'Salut'}
      </Title>

      {outfit ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 21 }}>Tenue du jour</h2>
          <OutfitCard outfit={outfit}>
            <WearButton outfitId={outfit.id} worn={Boolean(today?.worn)} />
          </OutfitCard>
        </section>
      ) : n === 0 ? (
        <Card>
          <h2 style={{ fontSize: 21 }}>On commence par tes vêtements</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--muted)' }}>
            Ton espace est prêt et il est vide — rien n&apos;y est ajouté sans toi.
            Dès que deux ou trois pièces y seront, Kode pourra composer une tenue
            avec ce que tu as déjà.
          </p>
          <Link href="/dressing/ajouter" style={{ ...buttonPrimary, alignSelf: 'flex-start' }}>
            Ajouter ma première pièce
          </Link>
        </Card>
      ) : (
        <Card>
          <h2 style={{ fontSize: 21 }}>Tenue du jour</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--muted)' }}>
            {n} pièce{n > 1 ? 's' : ''} dans ton dressing.{' '}
            {n < 3
              ? 'Encore une ou deux et Kode pourra proposer une tenue complète.'
              : "Rien n'est prévu pour aujourd'hui : demande à Kode de composer ta tenue."}
          </p>
          <Link href={n < 3 ? '/dressing/ajouter' : '/kode'} style={{ ...buttonPrimary, alignSelf: 'flex-start' }}>
            {n < 3 ? 'Ajouter une pièce' : 'Demander à Kode'}
          </Link>
        </Card>
      )}
    </Screen>
  );
}
