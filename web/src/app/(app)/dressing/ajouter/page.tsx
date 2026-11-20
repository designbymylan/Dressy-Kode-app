import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/space';
import { ManualForm, PhotoForm } from '@/components/AddGarmentForms';
import { AjoutPieces } from '@/components/AjoutPieces';
import { PIPELINE_AJOUT } from '@/lib/ajout';
import { Screen, Title, Card } from '@/components/ui';

export default async function Ajouter() {
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion');

  return (
    <Screen>
      <Title sub="Deux façons de remplir ton dressing.">
        Ajouter <em className="accent">une pièce</em>
      </Title>

      <Card i={1}>
        <h2 className="section-title" style={{ justifyContent: 'center' }}>{PIPELINE_AJOUT ? 'Une photo, une pièce' : 'Kodi la prend en photo'}</h2>
        {PIPELINE_AJOUT ? <AjoutPieces spaceId={viewer.spaceId} /> : <PhotoForm spaceId={viewer.spaceId} />}
      </Card>

      <Card i={2}>
        <h2 id="a-la-main" className="section-title" style={{ justifyContent: 'center', scrollMarginTop: 80 }}>Je la saisis</h2>
        <ManualForm />
      </Card>

      <Link href="/dressing" className="btn btn-ghost rise" style={{ alignSelf: 'center' }}>
        Retour au dressing
      </Link>
    </Screen>
  );
}
