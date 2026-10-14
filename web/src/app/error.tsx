'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { StatusScreen } from '@/components/StatusScreen';

/**
 * Erreur pendant l'affichage d'une page : un message de la charte, sans
 * détail technique à l'écran (le détail part dans les journaux), un essai de
 * plus et une sortie vers l'accueil.
 */
export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen title="Quelque chose a coincé" lead="Ce n’est pas de ton fait. Réessaie dans un instant.">
      <button type="button" className="btn btn-primary btn-block" onClick={reset}>
        Réessayer
      </button>
      <Link href="/" className="btn btn-ghost">
        Revenir à l’accueil
      </Link>
    </StatusScreen>
  );
}
