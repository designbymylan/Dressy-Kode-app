import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { Screen, Title, Card, Icon, ICON } from '@/components/ui';

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
        {viewer.displayName ? <>Salut, <em className="accent">{viewer.displayName}</em></> : 'Salut'}
      </Title>

      {n === 0 ? (
        <Card center i={1}>
          <h2 className="title-2">On commence par <em className="accent">tes vêtements</em></h2>
          <p className="lead small">
            Ton espace est prêt et il est vide : rien n&apos;y est ajouté sans toi.
            Dès que deux ou trois pièces y seront, Kode pourra composer une tenue
            avec ce que tu as déjà.
          </p>
          <Link href="/dressing/ajouter" className="btn btn-primary btn-block">
            Ajouter ma première pièce
          </Link>
        </Card>
      ) : (
        <Card center i={1}>
          <h2 className="title-2">Tenue du <em className="accent">jour</em></h2>
          <p className="lead small">
            {n} pièce{n > 1 ? 's' : ''} dans ton dressing.{' '}
            {n < 2
              ? 'Encore une ou deux et tu pourras composer une tenue complète.'
              : 'Compose ta tenue en quelques gestes, avec ce que tu as déjà.'}
          </p>
          {n < 2 ? (
            <Link href="/dressing/ajouter" className="btn btn-primary btn-block">Ajouter une pièce</Link>
          ) : (
            <>
              <Link href="/tenues/nouvelle" className="btn btn-primary btn-block">
                <Icon d={ICON.sparkle} size={18} /> Composer ma tenue
              </Link>
              <Link href="/tenues" className="btn btn-glass btn-block">Voir mes tenues</Link>
            </>
          )}
        </Card>
      )}
    </Screen>
  );
}
