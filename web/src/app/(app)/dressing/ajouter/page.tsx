import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { ManualForm, PhotoForm } from '@/components/AddGarmentForms';
import { Icon } from '@/components/icons';
import { Screen, Title, Card, btn } from '@/components/ui';

/** Deux façons de remplir le dressing ; une seule visible à la fois. */
export default async function Ajouter({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const manual = mode === 'saisie';
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');

  const supabase = await createClient();
  const { data: categories } = manual
    ? await supabase.from('categories').select('id, label').order('sort')
    : { data: [] };

  return (
    <Screen>
      <Link href="/dressing" className={`${btn.ghost} dk-btn--sm`} style={{ alignSelf: 'flex-start', marginLeft: -12, color: 'var(--ink)' }}>
        <Icon name="chevronLeft" size={16} /> Dressing
      </Link>

      <Title sub="Une photo suffit : Kodi s’occupe du reste.">Ajouter une pièce</Title>

      <nav aria-label="Méthode" className="dk-seg" style={{ '--n': 2, '--i': manual ? 1 : 0 } as CSSProperties}>
        <span className="dk-seg__thumb" aria-hidden="true" />
        <Link href="/dressing/ajouter" className="dk-seg__opt" aria-current={!manual ? 'page' : undefined}>
          <Icon name="camera" size={16} /> En photo
        </Link>
        <Link href="/dressing/ajouter?mode=saisie" className="dk-seg__opt" aria-current={manual ? 'page' : undefined}>
          <Icon name="pencil" size={16} /> À la main
        </Link>
      </nav>

      <Card>
        {manual ? <ManualForm categories={categories ?? []} /> : <PhotoForm spaceId={viewer.spaceId} />}
      </Card>
    </Screen>
  );
}
