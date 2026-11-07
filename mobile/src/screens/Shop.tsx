/**
 * La boutique (09/10), copie de la maquette validée : la même page que les
 * offres (promesse en grand, deux cartes, lignes à cocher, réassurance,
 * bouton noir en bas). Depuis le brief v6 (31/10), elle vend les packs de
 * places (+10 et +30, paiement unique Stripe) ; les cinq services à l'unité
 * (occasion, voyage, audit, couleurs, défi), jamais construits, ne sont plus
 * en vente (07/11). Ni patch ni pastille : l'économie se lit au prix barré.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LIMITS, PLACE_PACKS, pieceLimit, questionsLeft, useStore, type PlacePackId } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Button } from '../ui/Button';
import { Ambient } from '../ui/Ambient';
import { ScrollEdge, useHeaderScroll } from '../ui/layout';
import { BottomFade, CloseButton, FeatureCard, Fold, Promise, RadioRow, Reassure, Scribble } from '../ui/shop';
import { price } from './Offers';
import type { Nav, Route } from '../navigation/types';

export function Shop() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route<'Shop'>>();
  const insets = useSafeAreaInsets();
  const { y, onScroll } = useHeaderScroll();
  const { c } = useTheme();
  const limit = pieceLimit(s);
  const left = questionsLeft(s);
  const quota = LIMITS[s.plan].questions;
  const [pick, setPick] = useState<PlacePackId>('moyen');
  const chosen = PLACE_PACKS.find((p) => p.id === pick) ?? PLACE_PACKS[0];
  // Le petit pack sert d'étalon : trois petits valent plus qu'un moyen, l'économie se lit au prix barré.
  const petit = PLACE_PACKS[0];

  useEffect(() => {
    const id = route.params?.pack;
    if (id && PLACE_PACKS.some((p) => p.id === id)) setPick(id as PlacePackId);
  }, [route.params]);

  const used = quota === null ? 0 : quota - (left ?? 0);
  const bar = (v: number, max: number) => (
    <View style={{ height: 3, borderRadius: 2, backgroundColor: c.rule, overflow: 'hidden' }}>
      <View style={{ height: 3, borderRadius: 2, width: `${Math.min(100, Math.round((v / max) * 100))}%`, backgroundColor: c.ink }} />
    </View>
  );

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-shop">
      <Ambient />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: insets.top + 50, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 120, gap: 12 }}>
        <Scribble variant={1} />
        <Promise title={`Plus de place,\ndès ${price(petit.cents)}`} lead="Des places en plus pour ton dressing" note="Un achat unique : les places s’ajoutent à ton offre et restent." />

        <Fold label="Où tu en es" />
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          <FeatureCard testID="shop-places" icon="hanger" title="Places" right={limit === null ? 'Sans limite' : `${s.pieces.length} / ${limit}`}>
            {limit !== null && bar(s.pieces.length, limit)}
          </FeatureCard>
          <FeatureCard testID="shop-questions" icon="kode" title="Questions à Kodi" right={quota === null ? 'Sans limite' : `${used} / ${quota}`}>
            {quota !== null && bar(used, quota)}
            {quota !== null && (
              <T testID="shop-more-questions" v="small" tone="ink2" onPress={() => nav.navigate('Offers')} accessibilityRole="link" suppressHighlighting style={{ paddingVertical: 6 }}>
                Sans limite avec Sapologue
              </T>
            )}
          </FeatureCard>
        </View>

        {limit === null ? (
          <T v="body" tone="ink2" style={{ paddingTop: 4 }}>
            Ton offre n’a pas de limite de places : rien à ajouter.
          </T>
        ) : (
          <View accessibilityRole="radiogroup" accessibilityLabel="Packs de places" style={{ gap: 8, paddingTop: 4 }}>
            {PLACE_PACKS.map((p) => {
              const fois = p.places / petit.places;
              return (
                <RadioRow
                  key={p.id}
                  testID={`pack-${p.id}`}
                  name={p.name}
                  note={`${p.places} pièces de plus dans ton dressing`}
                  price={price(p.cents)}
                  struck={fois > 1 ? price(petit.cents * fois) : undefined}
                  on={pick === p.id}
                  onPress={() => setPick(p.id)}
                />
              );
            })}
          </View>
        )}

        <Reassure
          items={[
            { icon: 'lock', text: 'Paiement unique et sécurisé, rien ne se renouvelle.' },
            { icon: 'hanger', text: 'Des places, jamais des générations : tes pièces gardent leur place.' },
            { icon: 'check', text: 'Autant de packs que tu veux, ils s’additionnent.' },
          ]}
        />
        <T testID="shop-offers" v="label" tone="ink2" onPress={() => nav.navigate('Offers')} accessibilityRole="link" suppressHighlighting style={{ alignSelf: 'center', paddingVertical: 12 }}>
          Voir les abonnements
        </T>
      </Animated.ScrollView>

      <ScrollEdge y={y} />
      <CloseButton />
      <BottomFade />
      {limit !== null && (
        <View style={{ position: 'absolute', left: space.gutter, right: space.gutter, bottom: insets.bottom + 16, gap: 6 }}>
          <Button testID="shop-cta" label={`Ajouter ${chosen.places} places · ${price(chosen.cents)}`} icon="lock" onPress={() => a.buyPlaces(chosen.id)} />
          {s.account !== 'connecte' && (
            <T v="small" tone="ink2" style={{ textAlign: 'center' }}>
              Aperçu : le paiement est simulé, rien n’est prélevé.
            </T>
          )}
        </View>
      )}
    </View>
  );
}
