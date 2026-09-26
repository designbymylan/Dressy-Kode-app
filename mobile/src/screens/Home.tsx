import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { EVENTS, TODAY_OUTFITS, WEATHER, DAYS_LETTER, dayDate, lcFirst, shortDate, sinceLabel, type Piece } from '../data/wardrobe';
import { MODULE_LABELS, sleeping, usageRate, useStore, type HomeModule } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space, TAB_CLEARANCE } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Chip } from '../ui/controls';
import { Masthead, Rule, ScrollEdge, SectionHead, useTabScroll } from '../ui/layout';
import { OutfitBoard, Legend } from '../ui/outfit';
import { Card, WeatherIcon } from '../ui/bits';
import { Garment } from '../ui/Garment';
import { Icon } from '../ui/Icon';
import { useScreen } from '../ui/screen';
import type { Nav } from '../navigation/types';

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

export function Home() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width } = useScreen();
  const edge = useSharedValue(0);
  const onScroll = useTabScroll(edge);
  const byId = new Map(s.pieces.map((p) => [p.id, p]));
  const outfit = TODAY_OUTFITS[s.outfitIndex];
  const pieces = outfit.pieces.map((id) => byId.get(id)).filter(Boolean) as Piece[];
  const worn = !!s.wornToday;
  const w = WEATHER[0];
  const open = (p: Piece) => nav.navigate('Piece', { id: p.id });
  const W = width - space.gutter * 2;
  const { c } = useTheme();

  return (
    <View style={{ flex: 1 }} className="bg-paper">
    <ScrollEdge y={edge} />
    <Animated.ScrollView
      testID="screen-home"
      onScroll={onScroll}
      scrollEventThrottle={16}
      className="bg-paper"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: space.gutter, paddingBottom: TAB_CLEARANCE + insets.bottom, gap: 18 }}
    >
      <Masthead kicker="DRESSKODE" meta={`${capital(shortDate(0))} · ${w.t}°, ${w.label}`} />

      <Animated.View key={outfit.id} entering={FadeIn.duration(320)} exiting={FadeOut.duration(120)} style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <T v="kicker" tone={worn ? 'positive' : 'ink2'} upper>
            {worn ? 'Portée aujourd’hui' : 'Tenue du jour'}
          </T>
          <T v="hero" accessibilityRole="header">
            {outfit.lead}
            <T v="hero" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }}>
              {outfit.em}
            </T>
          </T>
        </View>
        <OutfitBoard pieces={pieces} width={W} onPiece={open} />
        <Legend pieces={pieces} onPiece={open} />
        <View style={{ gap: 8, paddingTop: 12, borderTopWidth: 1 }} className="border-rule">
          <T v="quote">« {outfit.why} »</T>
          <T v="masthead" tone="ink2" style={{ letterSpacing: 2.4 }}>
            KODE
          </T>
        </View>
      </Animated.View>

      {worn ? (
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Icon name="check" size={20} color={c.positive} strokeWidth={2.2} />
          <T v="body" tone="ink2" style={{ flex: 1 }}>
            Bonne journée. Kode s’en souviendra pour tes prochaines tenues.
          </T>
        </View>
      ) : (
        <View className="flex-row" style={{ gap: 8 }}>
          <Button testID="wear-today" label="Je la porte" grow onPress={() => a.wear(outfit.pieces, 'Notée dans ton journal')} />
          <Button testID="another-outfit" label="Une autre" variant="secondary" icon="refresh" grow onPress={a.nextOutfit} />
        </View>
      )}

      {s.modules.filter((m) => m.on).map((m) => (
        <Module key={m.id} id={m.id} W={W} />
      ))}

      <Tap testID="customize-home" onPress={() => nav.navigate('Customize')} scaleTo={1} accessibilityLabel="Personnaliser l’accueil" style={{ minHeight: 44 }} className="flex-row items-center justify-center">
        <Icon name="sliders" size={18} color={c.ink2} />
        <T v="caption" tone="ink2" style={{ marginLeft: 8 }}>
          Personnaliser l’accueil
        </T>
      </Tap>
    </Animated.ScrollView>
    </View>
  );
}

function Module({ id, W }: { id: HomeModule; W: number }) {
  const { s } = useStore();
  const nav = useNavigation<Nav>();
  const { c, scheme } = useTheme();
  const title = MODULE_LABELS[id].title;
  const head = (action?: string, onAction?: () => void) => (
    <View style={{ gap: 10 }}>
      <Rule />
      <SectionHead title={title} action={action} onAction={onAction} testID={`module-${id}-action`} />
    </View>
  );

  if (id === 'kode') {
    const tomorrow = EVENTS.find((e) => e.day === 1);
    const asks = [tomorrow ? `Pour ${lcFirst(tomorrow.title)}, demain` : 'Pour ce soir', 'Sans le jean, pour aujourd’hui', 'Qu’est-ce que je ne porte jamais ?'];
    return (
      <View style={{ gap: 12 }}>
        {head()}
        <Tap testID="home-ask-kode" onPress={() => nav.navigate('Tabs', { screen: 'Kode' })} scaleTo={0.99} accessibilityLabel="Poser une question à Kode" className="flex-row items-center bg-sunk" style={{ height: 50, borderRadius: 25, paddingHorizontal: 18, gap: 10 }}>
          <Icon name="kode" size={20} color={c.brass} />
          <T v="body" tone="ink2">
            Pose ta question à Kode…
          </T>
        </Tap>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {asks.map((q) => (
            <Chip key={q} label={q} onPress={() => nav.navigate('Tabs', { screen: 'Kode', params: { ask: q, nonce: Date.now() } })} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (id === 'semaine') {
    return (
      <View style={{ gap: 12 }}>
        {head('Agenda', () => nav.navigate('Tabs', { screen: 'Agenda' }))}
        <View className="flex-row" style={{ gap: 4 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const d = dayDate(i);
            const w = WEATHER[i];
            const busy = EVENTS.some((e) => e.day === i) || !!s.planned[i];
            return (
              <Tap key={i} testID={`week-${i}`} onPress={() => nav.navigate('Tabs', { screen: 'Agenda', params: { day: i } })} accessibilityLabel={`${i === 0 ? 'Aujourd’hui' : shortDate(i)}, ${w.t} degrés${busy ? ', un événement' : ''}`} outerStyle={{ flex: 1 }} style={{ alignItems: 'center', gap: 5, paddingVertical: 8, borderRadius: 18 }} className={i === 0 ? 'bg-pill' : ''}>
                <T v="small" tone="ink2">
                  {DAYS_LETTER[d.getDay()]}
                </T>
                <T v="bodyStrong">{d.getDate()}</T>
                <WeatherIcon w={w} size={18} color={c.ink2} />
                <T v="small" tone="ink2">
                  {w.t}°
                </T>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: busy ? c.brass : 'transparent' }} />
              </Tap>
            );
          })}
        </View>
      </View>
    );
  }

  if (id === 'oubliees') {
    const list = sleeping(s.pieces).slice(0, 5);
    return (
      <View style={{ gap: 12 }}>
        {head('Tout voir', () => nav.navigate('Tabs', { screen: 'Dressing', params: { view: 'grille' } }))}
        <T v="body" tone="ink2">
          Elles dorment depuis des semaines. Tu pourrais en remettre une en jeu cette semaine.
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {list.map((p) => (
            <Tap key={p.id} testID={`sleeping-${p.id}`} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={`${p.name}, ${sinceLabel(p)}`} style={{ width: 118 }}>
              <View className="bg-raised items-center justify-center" style={{ height: 140, borderRadius: 20 }}>
                <Garment kind={p.kind} tint={p.tint} size={78} dark={scheme === 'dark'} label={p.name} />
              </View>
              <T v="caption" style={{ marginTop: 6, fontFamily: 'HankenGrotesk_600SemiBold' }} numberOfLines={1}>
                {p.name}
              </T>
              <T v="small" tone="caution">
                {capital(sinceLabel(p))}
              </T>
            </Tap>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (id === 'tendance') {
    const camel = s.pieces.filter((p) => ['Camel', 'Cognac', 'Camel et crème'].includes(p.color));
    return (
      <View style={{ gap: 12 }}>
        {head()}
        <Card style={{ gap: 12 }}>
          <T v="cardTitle">Le camel revient partout cette saison.</T>
          <T v="body" tone="ink2">
            {(() => {
              const rare = camel.filter((p) => p.wears < 5).length;
              return `Pas besoin d’acheter : tu en as déjà ${camel.length} pièces${rare ? `, dont ${rare} presque jamais portée${rare > 1 ? 's' : ''}` : ''}.`;
            })()}
          </T>
          <View className="flex-row" style={{ gap: 4 }}>
            {camel.slice(0, 5).map((p) => (
              <Tap key={p.id} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={p.name} style={{ width: (W - 32 - 16) / 5, alignItems: 'center' }}>
                <Garment kind={p.kind} tint={p.tint} size={(W - 32 - 16) / 5 - 4} dark={scheme === 'dark'} label={p.name} />
              </Tap>
            ))}
          </View>
          <Button testID="trend-compose" label="Composer avec le camel" variant="secondary" size="m" icon="layers" onPress={() => nav.navigate('Compose', { pieces: camel.slice(0, 3).map((p) => p.id) })} />
        </Card>
      </View>
    );
  }

  // bilan
  const worn30 = s.pieces.filter((p) => p.lastWorn !== null && p.lastWorn <= 30).length;
  return (
    <View style={{ gap: 12 }}>
      {head()}
      <View className="flex-row" style={{ gap: 10 }}>
        {[
          { v: `${usageRate(s.pieces)} %`, l: 'de ton dressing porté en 3 mois' },
          { v: String(worn30), l: 'pièces sorties ce mois-ci' },
        ].map((x) => (
          <Card key={x.l} style={{ flex: 1, gap: 4 }}>
            <T v="title" style={{ fontSize: 36, lineHeight: 38 }}>
              {x.v}
            </T>
            <T v="caption" tone="ink2">
              {x.l}
            </T>
          </Card>
        ))}
      </View>
    </View>
  );
}
