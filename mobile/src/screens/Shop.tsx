import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { pieceLimit, useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { Badge, Card, Gauge } from '../ui/bits';
import { Icon, type IconName } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Ambient } from '../ui/Ambient';
import type { Nav, Route } from '../navigation/types';
import { F } from '../theme/fonts';

/** Le contenu des packs vient de la maquette d'origine (Offres) : quatre lignes concrètes, un délai, un prix. */
export const PACKS: { id: string; name: string; price: string; icon: IconName; desc: string; delivery: string; cta: string; included?: boolean; contents: string[] }[] = [
  { id: 'occasion', name: 'Pack Occasion', price: '3,99 €', icon: 'gift', included: true, desc: 'Un mariage, un entretien, un dîner : la tenue est trouvée.', delivery: 'Prêt en 2 minutes, valable 30 jours', cta: 'Préparer mon occasion', contents: ['Le code vestimentaire décrypté : ce qui se porte et ce qui se remarque', 'Trois tenues complètes montées depuis tes propres pièces', 'Ce qui manque, et par quoi le remplacer dans ton dressing', 'La check-list accessoires, chaussures et plan B si la météo tourne'] },
  { id: 'voyage', name: 'Capsule voyage', price: '5,99 €', icon: 'plane', included: true, desc: 'Tes dates, ta destination, une valise qui tient debout.', delivery: 'Prête en 3 minutes, modifiable jusqu’au départ', cta: 'Composer ma valise', contents: ['La valise calibrée sur la durée du séjour et la météo sur place', 'Douze pièces qui font neuf tenues, sans doublon', 'L’ordre de port jour par jour, y compris l’avion', 'La liste de rangement à cocher et ce qui se relave sur place'] },
  { id: 'audit', name: 'Audit de garde-robe', price: '5,99 €', icon: 'chart', desc: 'Ce qui dort, ce qui double, ce qui manque vraiment.', delivery: 'Rapport complet en 5 minutes', cta: 'Lancer l’audit', contents: ['Les pièces qui n’ont pas bougé depuis six mois, listées et chiffrées', 'Tes doublons réels : combien de chemises blanches, combien portées', 'Les cinq manques de ta garde-robe, classés par usage', 'Ton coût par port moyen et un plan d’achat sur trois mois'] },
  { id: 'couleurs', name: 'Analyse couleurs', price: '2,99 €', icon: 'palette', desc: 'Tes teintes, testées sur les vêtements que tu as déjà.', delivery: 'Résultat immédiat, gardé dans ton profil', cta: 'Trouver ma palette', contents: ['Ta palette en douze teintes, appliquée à tes pièces', 'Les trois couleurs qui t’éteignent, avec leur remplacement', 'Les associations qui marchent déjà dans tes portants', 'Un filtre palette activable sur tout le dressing'] },
  { id: 'defi', name: 'Défi 30 jours', price: '0,99 €', icon: 'leaf', desc: 'Un mois sans rien acheter de neuf, une contrainte par jour.', delivery: 'Commence demain matin, s’arrête quand tu veux', cta: 'Relever le défi', contents: ['Trente jours sans achat neuf, suivis dans l’app', 'Une contrainte par jour tirée de ton dressing', 'Les pièces qui dormaient depuis six mois remises en jeu', 'Le bilan à la fin : ports gagnés, euros non dépensés'] },
];

export function Shop() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route<'Shop'>>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const [open, setOpen] = useState<string | null>(null);
  const [bundle, setBundle] = useState(false);
  const limit = pieceLimit(s);
  const pack = PACKS.find((p) => p.id === open);
  const inPlan = s.plan === 'atelier' || s.plan === 'couture';
  const owns = (id: string) => s.packs.includes(id) || (inPlan && !!PACKS.find((p) => p.id === id)?.included);
  const allOwned = PACKS.every((p) => owns(p.id));

  useEffect(() => {
    if (route.params?.pack) setOpen(route.params.pack);
  }, [route.params]);

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-shop">
      <Ambient />
      <StackHeader title="La boutique" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 20 }}>
        <View style={{ gap: 8 }}>
          <T v="kicker" tone="ink2" upper>
            La boutique
          </T>
          <T v="title" accessibilityRole="header">
            À l’unité,{'\n'}
            <T v="title" style={{ ...F.accent }}>
              quand tu en as besoin.
            </T>
          </T>
          <T v="body" tone="ink2">
            Pas d’abonnement : tu paies une fois, c’est à toi.
          </T>
        </View>

        {limit !== null && (
          <Card style={{ gap: 12 }} testID="shop-places">
            <View className="flex-row items-center justify-between">
              <T v="bodyStrong">Places du dressing</T>
              <T v="caption" tone="ink2">
                {s.pieces.length} sur {limit}
              </T>
            </View>
            <Gauge value={s.pieces.length} max={limit} label="Places du dressing" />
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <T v="caption" tone="ink2" style={{ flex: 1 }}>
                30 places de plus, une seule fois. Au-delà, Couture lève la limite.
              </T>
              <Button testID="buy-places" label="+30 · 4,99 €" size="m" onPress={a.buyPlaces} />
            </View>
          </Card>
        )}

        <View style={{ gap: 0 }}>
          {PACKS.map((p, i) => (
            <Tap key={p.id} testID={`pack-${p.id}`} onPress={() => setOpen(p.id)} scaleTo={0.99} accessibilityLabel={`${p.name}, ${owns(p.id) ? 'déjà à toi' : p.price}`} className="flex-row items-center" style={{ minHeight: 84, gap: 14, borderBottomWidth: i === PACKS.length - 1 ? 0 : 1, borderColor: c.rule, paddingVertical: 12 }}>
              <View className="bg-sunk items-center justify-center" style={{ width: 48, height: 48, borderRadius: 0 }}>
                <Icon name={p.icon} size={22} color={c.brass} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="bodyStrong">{p.name}</T>
                <T v="caption" tone="ink2" numberOfLines={2}>
                  {p.desc}
                </T>
              </View>
              {owns(p.id) ? <Badge label="À toi" icon="check" /> : <T v="bodyStrong">{p.price}</T>}
            </Tap>
          ))}
        </View>

        {!allOwned && (
          <Card className="bg-primary-bg" style={{ gap: 10 }} testID="bundle">
            <T v="kicker" tone="primary-fg" upper style={{ opacity: 0.8 }}>
              Les cinq packs
            </T>
            <T v="cardTitle" tone="primary-fg">
              14,99 € au lieu de 19,95 €
            </T>
            <T v="body" tone="primary-fg" style={{ opacity: 0.85 }}>
              Occasion, Voyage, Audit, Couleurs et Défi, débloqués sans date limite.
            </T>
            <Tap testID="bundle-buy" onPress={() => setBundle(true)} accessibilityLabel="Prendre les cinq pour 14,99 €" style={{ height: 50, borderRadius: 0, backgroundColor: c.paper }} className="items-center justify-center">
              <T v="button">Prendre les cinq · 14,99 €</T>
            </Tap>
          </Card>
        )}

        <Button label="Voir les abonnements" variant="plain" iconRight="chevron" onPress={() => nav.navigate('Offers')} />
      </Animated.ScrollView>

      <Sheet
        visible={!!pack}
        onClose={() => setOpen(null)}
        kicker={pack?.price ?? ''}
        title={pack?.name ?? ''}
        testID="pack-sheet"
        footer={
          pack && (
            <View style={{ gap: 6 }}>
              <Button
                testID="pack-sheet-buy"
                label={owns(pack.id) ? 'Ouvrir' : `${pack.cta} · ${pack.price}`}
                icon={owns(pack.id) ? undefined : 'lock'}
                onPress={() => {
                  if (!owns(pack.id)) a.buyPack(pack.id);
                  setOpen(null);
                  if (pack.id === 'occasion') nav.navigate('Event', { id: 'e5' });
                }}
              />
              {pack.included && !inPlan && (
                <T v="small" tone="ink2" style={{ textAlign: 'center' }}>
                  Déjà inclus dans Atelier et Couture.
                </T>
              )}
            </View>
          )
        }
      >
        {pack && (
          <View style={{ gap: 12 }}>
            <T v="body" tone="ink2">
              {pack.desc}
            </T>
            {pack.contents.map((x, i) => (
              <View key={x} className="flex-row" style={{ gap: 10 }}>
                <T v="numeral" tone="brass" style={{ fontSize: 16, width: 22 }}>
                  {String(i + 1).padStart(2, '0')}
                </T>
                <T v="body" style={{ flex: 1 }}>
                  {x}
                </T>
              </View>
            ))}
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Icon name="clock" size={16} color={c.ink2} />
              <T v="caption" tone="ink2">
                {pack.delivery}
              </T>
            </View>
          </View>
        )}
      </Sheet>

      <Sheet
        visible={bundle}
        onClose={() => setBundle(false)}
        kicker="Achat unique"
        title="Les cinq packs"
        footer={
          <Button
            testID="bundle-pay"
            label="Payer 14,99 €"
            icon="lock"
            onPress={() => {
              PACKS.forEach((p) => a.buyPack(p.id));
              setBundle(false);
            }}
          />
        }
      >
        <T v="body" tone="ink2">
          Cinq packs, 4,96 € d’économie, sans date limite. Aperçu : le paiement est simulé.
        </T>
      </Sheet>
    </View>
  );
}
