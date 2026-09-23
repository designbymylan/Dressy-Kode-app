import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { ManualForm, PhotoForm } from '@/components/AddGarmentForms';
import { Screen, Title, Card } from '@/components/ui';

export default async function Ajouter() {
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from('categories')
    .select('id, label')
    .order('sort');

  return (
    <Screen>
      <Title sub="Deux façons de remplir ton dressing.">Ajouter une pièce</Title>

      <Card>
        <h2 style={{ fontSize: 19 }}>Kode la prend en photo</h2>
        <PhotoForm spaceId={viewer.spaceId} />
      </Card>

      <Card>
        <h2 style={{ fontSize: 19 }}>Je la saisis</h2>
        <ManualForm categories={categories ?? []} />
      </Card>

      <Link href="/dressing" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'underline' }}>
        Retour au dressing
      </Link>
    </Screen>
  );
}
