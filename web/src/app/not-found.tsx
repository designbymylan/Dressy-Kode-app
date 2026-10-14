import Link from 'next/link';
import { StatusScreen } from '@/components/StatusScreen';

/** Adresse inconnue : une page de la charte, en français, avec un chemin de retour. */
export default function NotFound() {
  return (
    <StatusScreen title="Cette page n’existe pas" lead="Le lien est peut-être ancien, ou mal recopié.">
      <Link href="/" className="btn btn-primary btn-block">
        Revenir à l’accueil
      </Link>
    </StatusScreen>
  );
}
