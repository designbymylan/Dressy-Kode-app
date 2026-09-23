import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { Screen, Title, Card, buttonPrimary } from '@/components/ui';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export default async function Accueil() {
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  const supabase = await createClient();

  const { count } = await supabase
    .from('garments')
    .select('id', { count: 'exact', head: true });

  const n = count ?? 0;
  const today = new Date();
  const dateLabel = `${JOURS[today.getDay()]} ${today.getDate()} ${MOIS[today.getMonth()]}`;

  return (
    <Screen>
      <Title sub={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}>
        {viewer.displayName ? `Salut, ${viewer.displayName}` : 'Salut'}
      </Title>

      {n === 0 ? (
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
              : 'Demande à Kode de composer ta tenue.'}
          </p>
          <Link href={n < 3 ? '/dressing/ajouter' : '/kode'} style={{ ...buttonPrimary, alignSelf: 'flex-start' }}>
            {n < 3 ? 'Ajouter une pièce' : 'Demander à Kode'}
          </Link>
        </Card>
      )}
    </Screen>
  );
}
