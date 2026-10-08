import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LIMITS, pieceLimit, questionsLeft, useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { Badge, Card, Gauge, Tag } from '../ui/bits';
import { Patch, Struck } from '../ui/Patch';
import { glassSurface } from '../ui/Glass';
import { price } from './Offers';
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

/** Le prix d'un pack, en centimes, pour additionner sans arrondi. */
const cents = (price: string) => Math.round(parseFloat(price.replace(',', '.').replace(/[^\d.]/g, '')) * 100);
const BUNDLE = 1499;

/**
 * La boutique (refaite le 07/10), sur le modèle des applis de banque envoyées
 * en exemple : la grande carte noire des cinq packs avec son prix barré, les
 * packs en cartes qui défilent, chacun avec son patch, et deux tuiles d'usage
 * (places, questions) qui disent où tu en es, en pourcentage.
 */
export function Shop() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route<'Shop'>>();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const [open, setOpen] = useState<string | null>(null);
  const [bundle, setBundle] = useState(false);
  const limit = pieceLimit(s);
  const left = questionsLeft(s);
  const quota = LIMITS[s.plan].questions;
  const pack = PACKS.find((p) => p.id === open);
  const inPlan = s.plan === 'atelier' || s.plan === 'couture';
  const owns = (id: string) => s.packs.includes(id) || (inPlan && !!PACKS.find((p) => p.id === id)?.included);
  const allOwned = PACKS.every((p) => owns(p.id));
  const total = PACKS.reduce((n, p) => n + cents(p.price), 0);
  const cheapest = Math.min(...PACKS.map((p) => cents(p.price)));

  useEffect(() => {
    if (route.params?.pack) setOpen(route.params.pack);
  }, [route.params]);

  const patch = (p: (typeof PACKS)[number]) =>
    owns(p.id) ? null : p.included ? { label: 'Inclus dans Atelier', tone: 'ink' as const } : cents(p.price) === cheapest ? { label: 'Petit prix', tone: 'butter' as const } : null;

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-shop">
      <Ambient />
      <StackHeader title="La boutique" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingBottom: insets.bottom + 32, gap: 20 }}>
        <View style={{ paddingHorizontal: space.gutter }}>
          <T v="kicker" tone="ink2">
            Packs à l’unité, à toi pour toujours
          </T>
          <T v="hero" style={{ fontSize: 56, lineHeight: 60 }} accessibilityRole="header">
            {`dès ${price(cheapest)}`}
          </T>
        </View>

        {/* La grande carte : les cinq packs, le prix barré, l'économie. */}
        {!allOwned && (
          <View style={{ paddingHorizontal: space.gutter }}>
            <View testID="bundle" style={{ borderRadius: 28, padding: 20, gap: 16, backgroundColor: c['primary-bg'] }}>
              <View className="flex-row items-center justify-between">
                <T v="brand" tone="primary-fg" style={{ fontSize: 13 }}>
                  LES CINQ PACKS
                </T>
              </View>
              <View className="flex-row" style={{ gap: 8 }}>
                {PACKS.map((p) => (
                  <View key={p.id} className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c['primary-fg'], opacity: 0.85 }}>
                    <Icon name={p.icon} size={18} color={c['primary-fg']} />
                  </View>
                ))}
              </View>
              <View className="flex-row items-end" style={{ gap: 10 }}>
                <T v="hero" tone="primary-fg" style={{ fontSize: 44, lineHeight: 46 }}>
                  {price(BUNDLE)}
                </T>
                <View style={{ paddingBottom: 6 }}>
                  <Struck label={price(total)} tone="primary-fg" />
                </View>
              </View>
              <Tap testID="bundle-buy" onPress={() => setBundle(true)} accessibilityLabel={`Prendre les cinq pour ${price(BUNDLE)}`} style={{ alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 25, backgroundColor: c.paper }}>
                <T v="button">{`Tout prendre · ${price(BUNDLE)}`}</T>
              </Tap>
              <Patch label={`Économise ${price(total - BUNDLE)}`} tilt={5} icon="tag" style={{ position: 'absolute', top: -12, right: 18 }} />
            </View>
          </View>
        )}

        {/* Les packs, en cartes qui défilent. */}
        <View style={{ gap: 10 }}>
          <View style={{ paddingHorizontal: space.gutter }}>
            <Tag label="Les packs" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={CARD + 12} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 14, gap: 12 }}>
            {PACKS.map((p) => {
              const mine = owns(p.id);
              const pt = patch(p);
              return (
                <View key={p.id}>
                  <Tap testID={`pack-${p.id}`} onPress={() => setOpen(p.id)} scaleTo={0.98} accessibilityLabel={`${p.name}, ${mine ? 'déjà à toi' : p.price}`} style={[{ width: CARD, height: 236, borderRadius: 28, padding: 18, gap: 10 }, glassSurface(c, scheme)]}>
                    <View className="items-center justify-center" style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.pill }}>
                      <Icon name={p.icon} size={22} color={c.ink} />
                    </View>
                    <T v="section" numberOfLines={2} style={{ fontSize: 22 }}>
                      {p.name}
                    </T>
                    <T v="caption" tone="ink2" numberOfLines={3} style={{ flex: 1 }}>
                      {p.desc}
                    </T>
                    <View className="flex-row items-center justify-between">
                      {mine ? (
                        <Badge label="À toi" icon="check" />
                      ) : (
                        <View style={{ borderRadius: 999, paddingHorizontal: 14, height: 34, justifyContent: 'center', backgroundColor: c['primary-bg'] }}>
                          <T v="caption" tone="primary-fg" style={F.s600}>
                            {p.price}
                          </T>
                        </View>
                      )}
                      <Icon name="chevron" size={18} color={c.ink2} />
                    </View>
                  </Tap>
                  {pt && <Patch label={pt.label} tone={pt.tone} tilt={-4} style={{ position: 'absolute', top: -10, right: 12 }} />}
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Où tu en es : deux tuiles, chacune avec son pourcentage. */}
        <View className="flex-row" style={{ gap: 10, paddingHorizontal: space.gutter }}>
          <Usage
            testID="shop-places"
            icon="hanger"
            label="Places"
            value={s.pieces.length}
            max={limit}
            action={limit === null ? undefined : <Button testID="buy-places" label="+30 · 4,99 €" size="s" onPress={a.buyPlaces} />}
          />
          <Usage
            testID="shop-questions"
            icon="kode"
            label="Questions"
            value={quota === null ? 0 : quota - (left ?? 0)}
            max={quota}
            action={quota === null ? undefined : <Button testID="shop-more-questions" label="Sans limite" variant="secondary" size="s" onPress={() => nav.navigate('Offers')} />}
          />
        </View>

        <View style={{ paddingHorizontal: space.gutter }}>
          <Button label="Voir les abonnements" variant="plain" iconRight="chevron" onPress={() => nav.navigate('Offers')} />
        </View>
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
            label={`Payer ${price(BUNDLE)}`}
            icon="lock"
            onPress={() => {
              PACKS.forEach((p) => a.buyPack(p.id));
              setBundle(false);
            }}
          />
        }
      >
        <T v="body" tone="ink2">
          {`Cinq packs, ${price(total - BUNDLE)} d’économie, sans date limite. Aperçu : le paiement est simulé.`}
        </T>
      </Sheet>
    </View>
  );
}

const CARD = 214;

/** Une tuile d'usage : l'icône, le compte, la jauge et le pourcentage en pastille. */
function Usage({ icon, label, value, max, action, testID }: { icon: IconName; label: string; value: number; max: number | null; action?: ReactNode; testID?: string }) {
  const { c } = useTheme();
  const pct = max === null ? null : Math.min(100, Math.round((value / max) * 100));
  return (
    <Card testID={testID} style={{ flex: 1, padding: 16, gap: 10, borderRadius: 24 }}>
      <View className="flex-row items-center justify-between">
        <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.pill }}>
          <Icon name={icon} size={18} color={c.ink} />
        </View>
        {pct !== null && <Badge label={`${pct} %`} tone={pct >= 90 ? 'caution' : 'neutral'} />}
      </View>
      <View>
        <T v="kicker" tone="ink2">
          {label}
        </T>
        <T v="stat" style={{ fontSize: 30, lineHeight: 33 }}>
          {max === null ? 'Sans limite' : `${value}/${max}`}
        </T>
      </View>
      {max !== null && <Gauge value={value} max={max} label={label} />}
      {action}
    </Card>
  );
}
