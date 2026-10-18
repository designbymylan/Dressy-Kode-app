/**
 * Garde les rappels du téléphone d'accord avec le planning : à chaque
 * changement (tenue prévue, rendez-vous, voyage, choix des notifications),
 * tout est reprogrammé, une seconde et demie plus tard pour regrouper les
 * changements faits d'un coup. La démonstration n'en programme aucun : ses
 * rendez-vous sont inventés.
 */
import { useEffect } from 'react';
import { useStore } from './store';
import { rappels } from './rappels';
import { programmer } from './notifications';

export function useRappels() {
  const { s } = useStore();
  useEffect(() => {
    if (s.booting) return;
    const t = setTimeout(() => {
      const choix = s.account === 'demo' ? null : s.notifs;
      void programmer(rappels(choix, s, new Date()), choix === 'tout');
    }, 1500);
    return () => clearTimeout(t);
    // Seuls ces morceaux de l'état changent les rappels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.booting, s.account, s.notifs, s.planned, s.events, s.trips]);
}

/** À poser une fois sous le fournisseur d'état. */
export function Rappels() {
  useRappels();
  return null;
}
