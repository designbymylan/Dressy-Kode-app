import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { EVENTS, WEATHER, longDate, type Piece } from '../data/wardrobe';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Button } from '../ui/Button';
import { StackHeader, useHeaderScroll, useStackTop, Rule } from '../ui/layout';
import { Badge, Card, WeatherIcon } from '../ui/bits';
import { OutfitBoard, Legend } from '../ui/outfit';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import type { Nav, Route } from '../navigation/types';

export const PACK_OCCASION = {
  id: 'occasion',
  price: '3,99 €',
  contents: [
    'Le code vestimentaire décrypté : ce qui se porte et ce qui se remarque',
    'Trois tenues complètes montées depuis tes propres pièces',
    'Ce qui manque, et par quoi le remplacer dans ton dressing',
    'La check-list accessoires, chaussures et plan B si la météo tourne',
  ],
};

const EXTRA = [
  { title: 'Vert sapin, pour danser', pieces: ['r3', 'm2', 'c4', 'a5'], why: 'La robe vert sapin n’est jamais sortie : c’est son jour. Le blazer noir la rend plus nette pour la cérémonie, tu l’enlèves pour le dîner.' },
  { title: 'Le pantalon, version fête', pieces: ['m3', 'h5', 'b5', 'c4', 'a3'], why: 'Si tu préfères être à l’aise : blazer lin, chemise blanche et foulard soie. Chic champêtre sans robe.' },
];

export function EventScreen() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route<'Event'>>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { width } = useScreen();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const [confirm, setConfirm] = useState(false);
  const e = EVENTS.find((x) => x.id === params.id) ?? EVENTS[4];
  const w = WEATHER[e.day];
  const owned = s.packs.includes('occasion') || s.plan === 'atelier' || s.plan === 'couture';
  const byId = new Map(s.pieces.map((p) => [p.id, p]));
  const resolve = (ids: string[]) => ids.map((id) => byId.get(id)).filter(Boolean) as Piece[];
  const first = resolve(['r2', 'm3', 'c4', 'a3']);
  const W = width - space.gutter * 2 - 32;
  const planIt = (title: string, pieces: string[]) => {
    a.plan(e.day, { title, pieces });
    a.toast(`Prévue pour le ${longDate(e.day).split(' ').slice(1).join(' ')}`);
  };

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-event">
      <Ambient />
      <StackHeader title={e.title} y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 20 }}>
        <View style={{ gap: 8 }}>
          <T v="kicker" tone="ink2" upper>
            Événement · {longDate(e.day)}
          </T>
          <T v="title" accessibilityRole="header">
            {e.title}
          </T>
        </View>
        <View style={{ gap: 0 }}>
          {[
            { icon: 'clock' as const, text: `${e.time}${e.occasion ? ` · ${e.occasion.details}` : ''}` },
            { icon: 'pin' as const, text: e.place ?? '—' },
            { icon: 'tag' as const, text: `Code : ${e.occasion?.dressCode ?? 'libre'}` },
          ].map((r) => (
            <View key={r.icon} className="flex-row items-center" style={{ minHeight: 46, gap: 12, borderBottomWidth: 1, borderColor: c.rule }}>
              <Icon name={r.icon} size={20} color={c.ink2} />
              <T v="body" style={{ flex: 1 }}>
                {r.text}
              </T>
            </View>
          ))}
          <View className="flex-row items-center" style={{ minHeight: 46, gap: 12 }}>
            <WeatherIcon w={w} size={20} color={c.ink2} />
            <T v="body">
              Prévision : {w.t}°, {w.label}, {w.low}° en soirée
            </T>
          </View>
        </View>

        <Card style={{ gap: 12 }}>
          <T v="kicker" tone="ink2" upper>
            L’idée de Kode
          </T>
          <OutfitBoard pieces={first} width={W} onPiece={(p) => nav.navigate('Piece', { id: p.id })} />
          <Legend pieces={first} />
          <Rule />
          <T v="cardTitle">Terracotta au jardin</T>
          <T v="body" tone="ink2">
            La robe terracotta et le blazer lin, jamais porté, sont faits pour une fin d’après-midi dehors. Prévois une étole : {w.low}° après le dîner.
          </T>
          <Button testID="event-plan" label="Prévoir cette tenue" size="m" onPress={() => planIt('Terracotta au jardin', first.map((p) => p.id))} />
        </Card>

        {owned ? (
          <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 16 }} testID="pack-unlocked">
            <Badge label={s.packs.includes('occasion') ? 'Pack Occasion débloqué' : 'Inclus dans ton offre'} icon="check" />
            {EXTRA.map((o) => (
              <Card key={o.title} style={{ gap: 12 }}>
                <OutfitBoard pieces={resolve(o.pieces)} width={W} />
                <Legend pieces={resolve(o.pieces)} />
                <Rule />
                <T v="cardTitle">{o.title}</T>
                <T v="body" tone="ink2">
                  {o.why}
                </T>
                <Button label="Prévoir celle-ci" size="m" variant="secondary" onPress={() => planIt(o.title, o.pieces)} />
              </Card>
            ))}
            <Card className="bg-sunk" style={{ gap: 8 }}>
              <T v="kicker" tone="ink2" upper>
                Check-list
              </T>
              {['Étole ou blazer pour la soirée', 'Escarpins : prévois des talonnettes, la pelouse est traîtresse', 'Pochette plutôt que cabas', 'Plan B pluie : le trench marine passe sur les trois tenues'].map((x) => (
                <View key={x} className="flex-row" style={{ gap: 10 }}>
                  <Icon name="check" size={18} color={c.positive} strokeWidth={2} />
                  <T v="body" style={{ flex: 1 }}>
                    {x}
                  </T>
                </View>
              ))}
            </Card>
          </Animated.View>
        ) : (
          <Card testID="pack-offer" style={{ gap: 12, borderWidth: 1, borderColor: c['rule-strong'], backgroundColor: 'transparent' }}>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Icon name="gift" size={20} color={c.brass} />
              <T v="kicker" tone="brass" upper>
                Pour aller plus loin
              </T>
            </View>
            <T v="cardTitle">Pack Occasion — {PACK_OCCASION.price}, une fois</T>
            {PACK_OCCASION.contents.map((x, i) => (
              <View key={x} className="flex-row" style={{ gap: 10 }}>
                <T v="numeral" tone="brass" style={{ fontSize: 16, width: 22 }}>
                  {String(i + 1).padStart(2, '0')}
                </T>
                <T v="body" style={{ flex: 1 }}>
                  {x}
                </T>
              </View>
            ))}
            <T v="caption" tone="ink2">
              Prêt en 2 minutes, valable 30 jours.
            </T>
            <Button testID="pack-buy" label={`Préparer mon occasion — ${PACK_OCCASION.price}`} onPress={() => setConfirm(true)} />
            <T v="caption" tone="ink2" style={{ textAlign: 'center' }}>
              Déjà inclus dans Atelier et Couture.
            </T>
          </Card>
        )}
      </Animated.ScrollView>

      <Sheet
        visible={confirm}
        onClose={() => setConfirm(false)}
        kicker="Achat unique"
        title="Pack Occasion"
        testID="pack-confirm"
        footer={
          <Button
            testID="pack-pay"
            label={`Payer ${PACK_OCCASION.price}`}
            icon="lock"
            onPress={() => {
              a.buyPack('occasion');
              setConfirm(false);
            }}
          />
        }
      >
        <View style={{ gap: 10 }}>
          <T v="body" tone="ink2">
            Pour « {e.title} ». Pas d’abonnement, rien ne se renouvelle.
          </T>
          <View className="flex-row justify-between" style={{ paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.rule }}>
            <T v="bodyStrong">Total</T>
            <T v="bodyStrong">{PACK_OCCASION.price} TTC</T>
          </View>
          <T v="small" tone="ink2">
            Aperçu : le paiement est simulé, aucune somme n’est prélevée.
          </T>
        </View>
      </Sheet>
    </View>
  );
}
