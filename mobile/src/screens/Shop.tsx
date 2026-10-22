/**
 * La boutique (09/10), copie de la maquette validée : la même page que les
 * offres (promesse en grand, deux cartes, lignes à cocher, réassurance,
 * bouton noir en bas), pour les services à l'unité. Les deux cartes disent
 * où tu en es (places, questions) ; les lignes, les cinq packs et le lot.
 * Ni patch ni pastille : l'économie du lot se lit par le prix barré.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LIMITS, pieceLimit, questionsLeft, useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Button } from '../ui/Button';
import { Badge } from '../ui/bits';
import { Icon, type IconName } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Ambient } from '../ui/Ambient';
import { ScrollEdge, useHeaderScroll } from '../ui/layout';
import { BottomFade, CloseButton, FeatureCard, Fold, Promise, RadioRow, Reassure, Scribble } from '../ui/shop';
import { price } from './Offers';
import type { Nav, Route } from '../navigation/types';

/** Le contenu des packs vient de la maquette d'origine (Offres) : quatre lignes concrètes, un délai, un prix. */
export const PACKS: { id: string; name: string; price: string; icon: IconName; desc: string; delivery: string; cta: string; included?: boolean; contents: string[] }[] = [
  { id: 'occasion', name: 'Pack Occasion', price: '3,99 €', icon: 'gift', included: true, desc: 'Un mariage, un entretien, un dîner : la tenue est trouvée.', delivery: 'Prêt en 2 minutes, valable 30 jours', cta: 'Préparer mon occasion', contents: ['Le code vestimentaire décrypté : ce qui se porte et ce qui se remarque', 'Trois tenues complètes montées depuis tes propres pièces', 'Ce qui manque, et par quoi le remplacer dans ton dressing', 'La check-list accessoires, chaussures et plan B si la météo tourne'] },
  { id: 'voyage', name: 'Capsule voyage', price: '5,99 €', icon: 'plane', included: true, desc: 'Tes dates, ta destination, une valise qui tient debout.', delivery: 'Prête en 3 minutes, modifiable jusqu’au départ', cta: 'Composer ma valise', contents: ['La valise calibrée sur la durée du séjour et la météo sur place', 'Douze pièces qui font neuf tenues, sans doublon', 'L’ordre de port jour par jour, y compris l’avion', 'La liste de rangement à cocher et ce qui se relave sur place'] },
  { id: 'audit', name: 'Audit de garde-robe', price: '5,99 €', icon: 'chart', desc: 'Ce qui dort, ce qui double, ce qui manque vraiment.', delivery: 'Rapport complet en 5 minutes', cta: 'Lancer l’audit', contents: ['Les pièces qui n’ont pas bougé depuis six mois, listées et chiffrées', 'Tes doublons réels : combien de chemises blanches, combien portées', 'Les cinq manques de ta garde-robe, classés par usage', 'Ton coût par port moyen et un plan d’achat sur trois mois'] },
  { id: 'couleurs', name: 'Analyse couleurs', price: '2,99 €', icon: 'palette', desc: 'Tes teintes, testées sur les vêtements que tu as déjà.', delivery: 'Résultat immédiat, gardé dans ton profil', cta: 'Trouver ma palette', contents: ['Ta palette en douze teintes, appliquée à tes pièces', 'Les trois couleurs qui t’éteignent, avec leur remplacement', 'Les associations qui marchent déjà dans tes portants', 'Un filtre palette activable sur tout le dressing'] },
  { id: 'defi', name: 'Défi 30 jours', price: '0,99 €', icon: 'leaf', desc: 'Un mois sans rien acheter de neuf, une contrainte par jour.', delivery: 'Commence demain matin, s’arrête quand tu veux', cta: 'Relever le défi', contents: ['Trente jours sans achat neuf, suivis dans l’app', 'Une contrainte par jour tirée de ton dressing', 'Les pièces qui dormaient depuis six mois remises en jeu', 'Le bilan à la fin : ports gagnés, euros non dépensés'] },
];

/** Le prix d'un pack, en centimes, pour additionner sans arrondi. */
const cents = (p: string) => Math.round(parseFloat(p.replace(',', '.').replace(/[^\d.]/g, '')) * 100);
const BUNDLE = 1499;
const SHORT: Record<string, string> = {
  occasion: 'Un mariage, un entretien : la tenue est trouvée',
  voyage: 'Tes dates, ta destination, ta valise',
  audit: 'Ce qui dort, ce qui double, ce qui manque',
  couleurs: 'Tes teintes, testées sur tes pièces',
  defi: 'Un mois sans achat neuf, une règle par jour',
};

export function Shop() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route<'Shop'>>();
  const insets = useSafeAreaInsets();
  const { y, onScroll } = useHeaderScroll();
  const { c } = useTheme();
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
  const [pick, setPick] = useState<string>(allOwned ? PACKS[0].id : 'tout');
  const chosen = PACKS.find((p) => p.id === pick);

  useEffect(() => {
    if (route.params?.pack) {
      setPick(route.params.pack);
      setOpen(route.params.pack);
    }
  }, [route.params]);

  const used = quota === null ? 0 : quota - (left ?? 0);
  const bar = (v: number, max: number) => (
    <View style={{ height: 3, borderRadius: 2, backgroundColor: c.rule, overflow: 'hidden' }}>
      <View style={{ height: 3, borderRadius: 2, width: `${Math.min(100, Math.round((v / max) * 100))}%`, backgroundColor: c.ink }} />
    </View>
  );
  const cta = pick === 'tout' ? `Prendre les cinq · ${price(BUNDLE)}` : chosen ? (owns(chosen.id) ? `Ouvrir ${chosen.name}` : `${chosen.cta} · ${chosen.price}`) : '';

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-shop">
      <Ambient />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: insets.top + 50, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 120, gap: 12 }}>
        <Scribble variant={1} />
        <Promise title={`À l’unité,\ndès ${price(cheapest)}`} lead="Cinq services, à toi pour toujours" note="Pas d’abonnement : un achat, et c’est débloqué." />

        <Fold label="Où tu en es" />
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          <FeatureCard testID="shop-places" icon="hanger" title="Places" right={limit === null ? 'Sans limite' : `${s.pieces.length} / ${limit}`}>
            {limit !== null && bar(s.pieces.length, limit)}
            {limit !== null && (
              <T testID="buy-places" v="small" tone="ink2" onPress={a.buyPlaces} accessibilityRole="button" suppressHighlighting style={{ paddingVertical: 6 }}>
                +30 places · 4,99 €
              </T>
            )}
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

        <View accessibilityRole="radiogroup" accessibilityLabel="Services" style={{ gap: 8, paddingTop: 4 }}>
          {!allOwned && (
            <RadioRow testID="pack-tout" name="Les cinq ensemble" note="Occasion, voyage, audit, couleurs, défi" price={price(BUNDLE)} struck={price(total)} on={pick === 'tout'} onPress={() => setPick('tout')} />
          )}
          {PACKS.map((p) => (
            <RadioRow
              key={p.id}
              testID={`pack-${p.id}`}
              name={p.name}
              note={SHORT[p.id] ?? p.desc}
              price={p.price}
              on={pick === p.id}
              onPress={() => setPick(p.id)}
              right={owns(p.id) ? <Badge label="À toi" icon="check" /> : undefined}
            />
          ))}
        </View>

        <Reassure
          items={[
            { icon: 'check', text: 'Occasion et voyage déjà inclus dans Sapologue : rien à payer deux fois.' },
            { icon: 'lock', text: 'Paiement sécurisé, sans date limite d’utilisation.' },
          ]}
        />
        <T testID="shop-offers" v="label" tone="ink2" onPress={() => nav.navigate('Offers')} accessibilityRole="link" suppressHighlighting style={{ alignSelf: 'center', paddingVertical: 12 }}>
          Voir les abonnements
        </T>
      </Animated.ScrollView>

      <ScrollEdge y={y} />
      <CloseButton />
      <BottomFade />
      <View style={{ position: 'absolute', left: space.gutter, right: space.gutter, bottom: insets.bottom + 16 }}>
        <Button testID="shop-cta" label={cta} onPress={() => (pick === 'tout' ? setBundle(true) : setOpen(pick))} />
      </View>

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
                  Déjà inclus dans Sapologue.
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
