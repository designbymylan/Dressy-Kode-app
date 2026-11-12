import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { haptic } from './Tap';

/**
 * Tirer pour actualiser (12/11) : le geste attendu sur un écran de compte.
 * Le compte et les données du jour sont relus (`a.refresh`). Sans compte
 * connecté, il n'y a rien à relire : le geste n'existe pas, plutôt qu'un
 * anneau qui tourne pour rien. `offset` : la place de la capsule d'en-tête,
 * pour que l'anneau apparaisse dessous et non derrière elle.
 */
export function usePullRefresh(offset = 0) {
  const { s, a } = useStore();
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  if (s.account !== 'connecte') return undefined;
  const run = async () => {
    setBusy(true);
    try {
      // Un retour léger quand c'est relu : on sait que le geste a porté sans regarder l'anneau.
      if (await a.refresh()) haptic('light');
    } finally {
      setBusy(false);
    }
  };
  return <RefreshControl testID="pull-refresh" refreshing={busy} onRefresh={run} tintColor={c.ink2} colors={[c.ink]} progressBackgroundColor={c.paper} progressViewOffset={offset} accessibilityLabel="Actualiser" />;
}
