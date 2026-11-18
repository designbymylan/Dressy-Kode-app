/**
 * Garde les rappels du téléphone d'accord avec le planning : à chaque
 * changement (tenue prévue ou portée, rendez-vous, voyage, nombre de pièces,
 * choix des notifications),
 * tout est reprogrammé, une seconde et demie plus tard pour regrouper les
 * changements faits d'un coup. La démonstration n'en programme aucun : ses
 * rendez-vous sont inventés.
 */
import { useEffect } from 'react';
import { allerA, navRef } from '../navigation/ref';
import { useStore } from './store';
import { rappels } from './rappels';
import { ecouterTouchers, programmer } from './notifications';
import { accorderJeton } from './push';

export function useRappels() {
  const { s } = useStore();
  useEffect(() => {
    if (s.booting) return;
    const t = setTimeout(() => {
      const choix = s.account === 'demo' ? null : s.notifs;
      void programmer(rappels(choix, { ...s, nbPieces: s.pieces.length }, new Date()), choix === 'tout');
    }, 1500);
    return () => clearTimeout(t);
    // Seuls ces morceaux de l'état changent les rappels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.booting, s.account, s.notifs, s.planned, s.events, s.trips, s.journal, s.pieces.length]);
}

/**
 * Le push (18/11) : le jeton de l'appareil suit le choix. Renouvelé à chaque
 * lancement (le ménage de la nuit retire les appareils qu'on ne voit plus).
 */
export function usePush() {
  const { s } = useStore();
  const actif = s.notifs === 'tout' || s.notifs === 'planning';
  useEffect(() => {
    if (s.booting || !s.session) return;
    void accorderJeton(actif);
  }, [s.booting, s.session?.userId, actif]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Un toucher sur « tes pièces sont prêtes » ouvre le dressing, dès que la navigation est prête (5 s au plus). */
export function useToucherNotif() {
  useEffect(
    () =>
      ecouterTouchers(({ type }) => {
        if (type !== 'piece') return;
        let essais = 0;
        const t = setInterval(() => {
          if (navRef.isReady()) {
            clearInterval(t);
            allerA('Tabs', { screen: 'Dressing' });
          } else if (++essais > 16) clearInterval(t);
        }, 300);
      }),
    [],
  );
}

/** À poser une fois sous le fournisseur d'état. */
export function Rappels() {
  useRappels();
  usePush();
  useToucherNotif();
  return null;
}
