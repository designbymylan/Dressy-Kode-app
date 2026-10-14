'use client';

import { useEffect } from 'react';
import { StatusScreen } from '@/components/StatusScreen';
import './globals.css';

/**
 * Erreur dans la mise en page racine elle-même : elle remplace tout le
 * document, d'où son propre <html>. Thème laissé au système (`auto`).
 */
export default function ErreurGlobale({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr" data-theme="auto">
      <body>
        <StatusScreen title="Quelque chose a coincé" lead="Ce n’est pas de ton fait. Réessaie dans un instant.">
          <button type="button" className="btn btn-primary btn-block" onClick={reset}>
            Réessayer
          </button>
          <a href="/" className="btn btn-ghost">
            Revenir à l’accueil
          </a>
        </StatusScreen>
      </body>
    </html>
  );
}
