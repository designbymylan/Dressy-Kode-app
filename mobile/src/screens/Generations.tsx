/**
 * La fin des générations offertes (brief v6, 31/10) : un seul écran, ouvert
 * par un geste (« Image propre » à zéro), jamais en pop-up. Sapologue en
 * avant, Fashion en plus petit, « Continuer sans générer » en lien : la
 * personne garde son dressing, elle ne génère plus d'image. Ni pack ni prix
 * annuel ici : l'abonnement d'abord.
 */
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Button } from '../ui/Button';
import { Ambient } from '../ui/Ambient';
import { ScrollEdge, useHeaderScroll } from '../ui/layout';
import { CloseButton } from '../ui/shop';
import { Tag } from '../ui/bits';
import { PLANS, price } from './Offers';
import type { Nav } from '../navigation/types';

export function Generations() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { y, onScroll } = useHeaderScroll();
  const { c, scheme } = useTheme();
  const big = PLANS.find((p) => p.flagged)!;
  const small = PLANS.find((p) => p.id === 'capsule')!;
  const gens = (p: (typeof PLANS)[number]) => p.features.find((f) => f.label.includes('générations'))?.label;
  const subscribed = s.plan !== 'decouverte';

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-generations">
      <Ambient />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: insets.top + 56, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40, gap: 16 }}>
        <T v="title" accessibilityRole="header" testID="generations-title" style={{ textAlign: 'center', paddingHorizontal: 24 }}>
          {subscribed ? 'Tes générations reviennent le 1er du mois.' : 'Tu as utilisé tes générations offertes.'}
        </T>

        {!subscribed && (
          <>
            <View testID="generations-big" style={{ gap: 12, padding: 20, borderRadius: 28, backgroundColor: c.card, borderWidth: 1, borderColor: c['card-edge'] }}>
              <Tag label={big.name} />
              <T v="title">{`${price(big.cents.mois)} par mois`}</T>
              <T v="body" tone="ink2">
                {`${gens(big)}, Kodi sans limite. Sans engagement.`}
              </T>
              <Button testID="generations-pick-big" variant={scheme === 'dark' ? 'primary' : 'dark'} label={`Choisir ${big.name}`} onPress={() => a.setPlan(big.id, 'mois')} />
            </View>

            <View testID="generations-small" style={{ gap: 10, padding: 16, borderRadius: 24, backgroundColor: c.card, borderWidth: 1, borderColor: c['card-edge'] }}>
              <T v="bodyStrong">{`${small.name} · ${price(small.cents.mois)} par mois`}</T>
              <T v="small" tone="ink2">
                {gens(small)}
              </T>
              <Button testID="generations-pick-small" variant="secondary" size="m" label={`Choisir ${small.name}`} onPress={() => a.setPlan(small.id, 'mois')} />
            </View>
          </>
        )}

        <T testID="generations-skip" v="label" tone="ink2" onPress={() => nav.goBack()} accessibilityRole="link" suppressHighlighting style={{ alignSelf: 'center', paddingVertical: 12 }}>
          Continuer sans générer
        </T>
      </Animated.ScrollView>

      <ScrollEdge y={y} />
      <CloseButton />
    </View>
  );
}
