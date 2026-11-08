/**
 * Mon abonnement (08/11) : ce que tu paies, ce que tu gardes, et le bouton qui
 * résilie. Le bouton ouvre la page sécurisée de Stripe, dans le navigateur :
 * tu y choisis « Résilier l’abonnement ». Tu gardes ton offre jusqu’à la fin
 * du mois payé. Les factures se trouvent sur la même page. Ouvert depuis
 * Réglages. Sans compte branché, rien n’est résilié : l’écran le dit.
 */
import { useState } from 'react';
import { Linking, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CONDITIONS_URL } from '../data/legal';
import { useStore } from '../state/store';
import { online, portail } from '../state/remote';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Button } from '../ui/Button';
import { Ambient } from '../ui/Ambient';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { PLANS, price } from './Offers';
import type { Nav } from '../navigation/types';

export function Abonnement() {
  const { s } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Le portail n'existe que pour un compte branché : en aperçu, rien n'est résilié.
  const live = online && s.account === 'connecte';
  const offre = PLANS.find((p) => p.id === s.plan);
  const payant = !!offre && offre.cents.mois > 0;

  const ouvrirPortail = async () => {
    if (!live || busy) return;
    setBusy(true);
    setError(null);
    const r = await portail();
    setBusy(false);
    if (!r.ok) return setError(r.message);
    Linking.openURL(r.url);
  };

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-abonnement">
      <Ambient />
      <StackHeader title="Mon abonnement" y={y} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: top + 4, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40, gap: 16 }}
      >
        <View style={{ borderRadius: 28, backgroundColor: c.card, borderWidth: 1, borderColor: c['card-edge'], padding: 20, gap: 8 }}>
          <T v="label" tone="ink2">
            Ton offre
          </T>
          <T v="title" testID="abonnement-offre">
            {offre?.name ?? 'Découverte'}
          </T>
          <T v="body" tone="ink2">
            {offre && payant ? `${price(offre.cents.mois)} par mois, facturé chaque mois` : 'Gratuite, sans carte bancaire'}
          </T>
        </View>

        {payant ? (
          <View style={{ gap: 14 }}>
            <T v="body" tone="ink2">
              Tu gardes ton offre jusqu’à la fin du mois déjà payé. Rien n’est prélevé ensuite. Le mois commencé n’est pas remboursé au prorata.
            </T>
            <Button testID="abonnement-resilier" variant="secondary" label="Résilier mon abonnement" disabled={!live} loading={busy} onPress={ouvrirPortail} />
            <T v="small" tone="ink2">
              La page sécurisée de Stripe s’ouvre dans ton navigateur. Choisis « Résilier l’abonnement » pour finir.
            </T>
            {!live && <T v="small" tone="ink2">Aperçu : rien n’est résilié.</T>}
            {error && (
              <T v="caption" tone="caution" accessibilityRole="alert">
                {error}
              </T>
            )}
            <T testID="abonnement-factures" v="label" tone="ink2" onPress={ouvrirPortail} accessibilityRole="link" suppressHighlighting style={{ alignSelf: 'center', paddingVertical: 12 }}>
              Voir mes factures
            </T>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <T v="body" tone="ink2">
              Tu es en Découverte : il n’y a rien à résilier. Ton dressing reste à toi, avec jusqu’à 15 pièces.
            </T>
            <Button testID="abonnement-offres" variant="secondary" label="Voir les offres" onPress={() => nav.navigate('Offers')} />
          </View>
        )}

        <T testID="abonnement-conditions" v="label" tone="ink2" onPress={() => Linking.openURL(CONDITIONS_URL)} accessibilityRole="link" suppressHighlighting style={{ alignSelf: 'center', paddingVertical: 12 }}>
          Lire les conditions (résiliation, rétractation)
        </T>
      </Animated.ScrollView>
    </View>
  );
}
