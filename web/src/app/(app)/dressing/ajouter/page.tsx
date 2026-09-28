import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/space';
import { ManualForm, PhotoForm } from '@/components/AddGarmentForms';
import { Screen, Title, Card } from '@/components/ui';

export default async function Ajouter() {
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');

  return (
    <Screen>
      <Title sub="Deux façons de remplir ton dressing.">
        Ajouter <em className="accent">une pièce</em>
      </Title>

      <Card i={1}>
        <h2 className="section-title" style={{ justifyContent: 'center' }}>Kode la prend en photo</h2>
        <PhotoForm spaceId={viewer.spaceId} />
      </Card>

      <Card i={2}>
        <h2 className="section-title" style={{ justifyContent: 'center' }}>Je la saisis</h2>
        <ManualForm />
      </Card>

      <Link href="/dressing" className="btn btn-ghost rise" style={{ alignSelf: 'center' }}>
        Retour au dressing
      </Link>
    </Screen>
  );
}
