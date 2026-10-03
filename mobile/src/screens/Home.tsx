import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { WEATHER_WORD, DAYS_LETTER, dayDate, euros, lcFirst, shortDate, sinceLabel, type Piece } from '../data/wardrobe';
import { MODULE_LABELS, eventsOf, sleeping, usageRate, useMeteo, useStore, useTodayOutfits, type HomeModule } from '../state/store';
import { ferieDu, tendancesChezToi } from '../state/contexte';
import { Credit } from '../ui/Credit';
import { missingForOutfit } from '../state/outfits';
import { FirstRail } from '../ui/onboarding';
import { useTheme } from '../theme/ThemeProvider';
import { space, TAB_CLEARANCE } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Chip } from '../ui/controls';
import { Masthead, Rule, ScrollEdge, SectionHead, useTabScroll } from '../ui/layout';
import { OutfitBoard, Legend, assembleDelay } from '../ui/outfit';
import { motion } from '../theme/tokens';
import { Card, WeatherIcon } from '../ui/bits';
import { Garment } from '../ui/Garment';
import { Icon } from '../ui/Icon';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import type { Nav } from '../navigation/types';
import { F } from '../theme/fonts';

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

export function Home() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width } = useScreen();
  const edge = useSharedValue(0);
  const onScroll = useTabScroll(edge);
  const byId = new Map(s.pieces.map((p) => [p.id, p]));
  const outfits = useTodayOutfits();
  const outfit = outfits.length ? outfits[s.outfitIndex % outfits.length] : null;
  const pieces = outfit ? (outfit.pieces.map((id) => byId.get(id)).filter(Boolean) as Piece[]) : [];
  const worn = !!s.wornToday;
  const meteo = useMeteo();
  const now = meteo.now;
  const city = s.profile.city;
  // « Ven. 2 oct. · Lyon, 15°, nuageux » ; sans météo connue, la date et la ville seulement.
  const meteoTxt = now ? `${now.t}°, ${now.mot ?? (city ? WEATHER_WORD[now.kind] : (meteo.jours[0]?.label ?? WEATHER_WORD[now.kind]))}` : null;
  const meta = [capital(shortDate(0)), [city, meteoTxt].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const semaineVisible = s.modules.some((m) => m.id === 'semaine' && m.on);
  const open = (p: Piece) => nav.navigate('Piece', { id: p.id });
  const W = width - space.gutter * 2;
  const { c } = useTheme();

  return (
    <View style={{ flex: 1 }} className="bg-paper">
      <Ambient weather={now?.kind} />
    <ScrollEdge y={edge} />
    <Animated.ScrollView
      testID="screen-home"
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: space.gutter, paddingBottom: TAB_CLEARANCE + insets.bottom, gap: 18 }}
    >
      <Masthead kicker="DRESSKODE" meta={meta} />

      {!outfit ? (
        <EmptyToday />
      ) : (
      <>
      <Animated.View key={outfit.id} entering={FadeIn.duration(320)} exiting={FadeOut.duration(120)} style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <T v="kicker" tone={worn ? 'positive' : 'ink2'}>
            {worn ? 'Portée aujourd’hui' : 'Tenue du jour'}
          </T>
          {/* La tenue s'assemble sur la planche, puis son titre s'écrit. */}
          <Animated.View entering={FadeInDown.delay(assembleDelay(pieces.length)).duration(520)}>
            <T v="hero" accessibilityRole="header">
              {outfit.lead}
              <T v="hero" style={{ ...F.accent }}>
                {outfit.em}
              </T>
            </T>
          </Animated.View>
        </View>
        <OutfitBoard pieces={pieces} width={W} onPiece={open} assemble />
        <Legend pieces={pieces} onPiece={open} />
        <View style={{ gap: 8, paddingTop: 12, borderTopWidth: 1 }} className="border-rule">
          <T v="quote">« {outfit.why} »</T>
          <T v="kicker" tone="ink2">
            Kode
          </T>
        </View>
      </Animated.View>

      {worn ? (
        <WornToday pieces={pieces} />
      ) : (
        <View className="flex-row" style={{ gap: 8 }}>
          <Button testID="wear-today" label="Je la porte" grow feedback="success" onPress={() => a.wear(outfit.pieces, 'Notée dans ton journal')} />
          <Button testID="another-outfit" label="Une autre" variant="secondary" icon="refresh" grow disabled={outfits.length < 2} onPress={a.nextOutfit} />
        </View>
      )}
      </>
      )}

      {s.modules.filter((m) => m.on).map((m) => (
        <Module key={m.id} id={m.id} W={W} />
      ))}

      {/* La météo de l'en-tête est créditée dans « Ta semaine » ; module masqué, elle l'est ici. */}
      {meteo.reelle && !semaineVisible && <Credit blocs={[s.contexte?.meteo]} />}

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

/**
 * « Je la porte » tenu : la coche se pose, de petites pastilles aux couleurs
 * de la tenue s'envolent, et le compteur de ports monte pendant que le coût
 * par port baisse. Porter ce qu'on a, c'est tout le propos de l'app.
 */
function WornToday({ pieces }: { pieces: Piece[] }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  // Ce bloc n'apparaît qu'au geste (le port du jour n'est pas gardé d'un lancement à l'autre) : il joue une fois.
  const k = useSharedValue(reduced ? 1 : 0);
  const bump = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    k.value = withSpring(1, motion.spring);
    bump.value = withDelay(380, withSequence(withTiming(1.18, { duration: 140 }), withSpring(1, motion.spring)));
  }, [k, bump, reduced]);
  const check = useAnimatedStyle(() => ({ transform: [{ scale: k.value }, { rotate: `${(1 - k.value) * -40}deg` }], opacity: Math.min(1, k.value * 2) }));
  const count = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  const total = pieces.reduce((n, p) => n + p.wears, 0);
  const priced = pieces.filter((p) => p.price);
  const cpw = priced.length ? priced.reduce((n, p) => n + (p.price ?? 0), 0) / Math.max(1, priced.reduce((n, p) => n + p.wears, 0)) : null;
  const colours = pieces.map((p) => p.tint ?? p.swatch);

  return (
    <View className="flex-row items-center" style={{ gap: 12 }} accessibilityLiveRegion="polite">
      <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        {!reduced && colours.length > 0 && Array.from({ length: 12 }, (_, i) => <Spark key={i} i={i} colour={colours[i % colours.length]} />)}
        <Animated.View className="bg-primary-bg items-center justify-center" style={[{ width: 44, height: 44, borderRadius: 0 }, check]}>
          <Icon name="check" size={22} color={c['primary-fg']} strokeWidth={2.2} />
        </Animated.View>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="body" tone="ink2">
          Bonne journée. Kode s’en souviendra pour tes prochaines tenues.
        </T>
        <Animated.View style={[{ alignSelf: 'flex-start', transformOrigin: 'left' }, count]}>
          <T v="caption" tone="ink">
            {`${total} port${total > 1 ? 's' : ''} pour ces pièces${cpw !== null ? ` · coût par port ${euros(cpw)}` : ''}`}
          </T>
        </Animated.View>
      </View>
    </View>
  );
}

/** Une pastille qui s'envole de la coche, dans une couleur de la tenue. */
function Spark({ i, colour }: { i: number; colour: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 900, easing: motion.easing });
  }, [t]);
  const angle = (i / 12) * Math.PI * 2 + (i % 2) * 0.3;
  const d = 34 + (i % 3) * 14;
  const style = useAnimatedStyle(() => ({
    // Elles restent bien visibles pendant le vol et s'éteignent à la fin.
    opacity: 1 - t.value * t.value * t.value,
    transform: [{ translateX: Math.cos(angle) * d * t.value }, { translateY: (Math.sin(angle) * d - 18) * t.value }, { scale: 1 - 0.6 * t.value }],
  }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 9, height: 9, borderRadius: 0, backgroundColor: colour }, style]} />;
}

/**
 * L'accueil d'un dressing vide (ou presque) : on montre ce qui va arriver,
 * pas un écran blanc. Le portant attend, la jauge dit combien il manque.
 */
function EmptyToday() {
  const { s } = useStore();
  const nav = useNavigation<Nav>();
  const { c } = useTheme();
  const n = s.pieces.length;
  const missing = missingForOutfit(s.pieces);
  return (
    <Animated.View entering={FadeIn.duration(320)} style={{ gap: 16 }} testID="home-empty">
      <View style={{ gap: 6 }}>
        <T v="kicker" tone="ink2">
          Ta première tenue
        </T>
        <T v="hero" accessibilityRole="header">
          {n === 0 ? 'Ton dressing\n' : n === 1 ? 'C’est bien\n' : 'Presque\n'}
          <T v="hero" style={{ ...F.accent }}>
            {n === 0 ? `t’attend${s.profile.name ? `, ${s.profile.name}` : ''}.` : n === 1 ? 'parti.' : 'prête.'}
          </T>
        </T>
      </View>
      <View style={{ marginHorizontal: -space.gutter }}>
        <FirstRail pieces={s.pieces.slice(0, 5)} slots={5} size={70} onPiece={(p) => nav.navigate('Piece', { id: p.id })} />
      </View>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View className="flex-row" style={{ gap: 5 }}>
          {[0, 1, 2].map((k) => (
            <View key={k} style={{ width: 10, height: 10, borderRadius: 0, backgroundColor: k < Math.min(3, n) ? c.ink : c.rule }} />
          ))}
        </View>
        <T v="caption" tone="ink2" style={{ flex: 1 }}>
          {n ? `${n} pièce${n > 1 ? 's' : ''} · il manque ${missing}` : 'Trois pièces suffisent : un haut, un bas, des chaussures.'}
        </T>
      </View>
      <Button testID="home-add-first" label={n ? 'Ajouter la pièce qui manque' : 'Ajouter mes premières pièces'} icon="plus" onPress={() => nav.navigate('AddPiece')} />
      <View className="flex-row" style={{ gap: 8 }}>
        {[
          { icon: 'camera' as const, t: 'Une photo', d: 'sur un cintre ou à plat' },
          { icon: 'hanger' as const, t: 'Une illustration', d: 'rangée sur tes portants' },
          { icon: 'kode' as const, t: 'Des tenues', d: 'selon la météo et ton style' },
        ].map((x, k) => (
          <View key={x.t} className="bg-stage" style={{ flex: 1, borderRadius: 0, padding: 12, gap: 6 }}>
            <View className="flex-row items-center justify-between">
              <Icon name={x.icon} size={20} color={k === 2 ? c.brass : c.ink} />
              <T v="numeral" tone="brass" style={{ fontSize: 15 }}>
                {String(k + 1).padStart(2, '0')}
              </T>
            </View>
            <T v="caption" style={{ ...F.s600 }}>
              {x.t}
            </T>
            <T v="small" tone="ink2">
              {x.d}
            </T>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function Module({ id, W }: { id: HomeModule; W: number }) {
  const { s } = useStore();
  const meteo = useMeteo();
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
    const tomorrow = eventsOf(s.profile).find((e) => e.day === 1);
    const asks = [
      tomorrow ? `Pour ${lcFirst(tomorrow.title)}, demain` : 'Une tenue pour demain',
      s.profile.occasions.includes('Bureau') ? 'Une tenue de bureau' : 'Une tenue pour ce soir',
      s.pieces.length >= 8 ? 'Qu’est-ce que je ne porte jamais ?' : 'Qu’est-ce qui va avec mon jean ?',
    ];
    return (
      <View style={{ gap: 12 }}>
        {head()}
        <Tap testID="home-ask-kode" onPress={() => nav.navigate('Tabs', { screen: 'Kode' })} scaleTo={0.99} accessibilityLabel="Poser une question à Kode" className="flex-row items-center bg-sunk" style={{ height: 50, borderRadius: 0, paddingHorizontal: 18, gap: 10 }}>
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
            const w = meteo.jours[i];
            const ferie = ferieDu(s.contexte, i);
            const busy = eventsOf(s.profile).some((e) => e.day === i) || !!s.planned[i] || !!ferie;
            const label = [i === 0 ? 'Aujourd’hui' : shortDate(i), w ? `${w.t} degrés, ${w.label}` : null, ferie ? `férié, ${ferie.nom}` : null, busy && !ferie ? 'un événement' : null];
            return (
              <Tap key={i} testID={`week-${i}`} onPress={() => nav.navigate('Tabs', { screen: 'Agenda', params: { day: i } })} accessibilityLabel={label.filter(Boolean).join(', ')} outerStyle={{ flex: 1 }} style={{ alignItems: 'center', gap: 5, paddingVertical: 8, borderRadius: 0 }} className={i === 0 ? 'bg-pill' : ''}>
                <T v="small" tone="ink2">
                  {DAYS_LETTER[d.getDay()]}
                </T>
                <T v="bodyStrong">{d.getDate()}</T>
                {w ? <WeatherIcon w={w} size={18} color={c.ink2} /> : <View style={{ height: 18 }} />}
                <T v="small" tone="ink2">
                  {w ? `${w.t}°` : ' '}
                </T>
                <View style={{ width: 5, height: 5, borderRadius: 0, backgroundColor: busy ? c.brass : 'transparent' }} />
              </Tap>
            );
          })}
        </View>
        {meteo.reelle && <Credit blocs={[s.contexte?.meteo, s.contexte?.feries]} />}
      </View>
    );
  }

  if (id === 'oubliees') {
    const list = sleeping(s.pieces).slice(0, 5);
    if (!list.length) return null;
    return (
      <View style={{ gap: 12 }}>
        {head('Tout voir', () => nav.navigate('Tabs', { screen: 'Dressing', params: { view: 'grille' } }))}
        <T v="body" tone="ink2">
          Elles dorment depuis des semaines. Tu pourrais en remettre une en jeu cette semaine.
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {list.map((p) => (
            <Tap key={p.id} testID={`sleeping-${p.id}`} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={`${p.name}, ${sinceLabel(p)}`} style={{ width: 118 }}>
              <View className="bg-stage items-center justify-center" style={{ height: 140, borderRadius: 0 }}>
                <Garment kind={p.kind} tint={p.tint} image={p.image} size={78} dark={scheme === 'dark'} label={p.name} />
              </View>
              <T v="caption" style={{ marginTop: 6, ...F.s600 }} numberOfLines={1}>
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

  if (id === 'tendance' && meteo.reelle) {
    // Compte connecté : la pièce dont l'intérêt monte le plus cette semaine, et que le dressing a déjà.
    const top = tendancesChezToi(s.contexte, s.pieces)[0];
    if (!top) return null;
    const { t, pieces: owned } = top;
    const rare = owned.filter((p) => p.wears < 5).length;
    const thumb = (W - 32 - 16) / 5;
    return (
      <View style={{ gap: 12 }}>
        {head()}
        <Card style={{ gap: 12 }}>
          <T v="cardTitle">{t.variation !== null ? `${t.libelle} : +${t.variation} % d’intérêt cette semaine.` : `${t.libelle} : une pièce de saison.`}</T>
          <T v="body" tone="ink2">
            {`Pas besoin d’acheter : tu en as déjà ${owned.length > 1 ? `${owned.length} dans ton dressing` : 'une dans ton dressing'}${!rare ? '' : rare === owned.length ? `, presque jamais portée${rare > 1 ? 's' : ''}` : `, dont ${rare} presque jamais portée${rare > 1 ? 's' : ''}`}.`}
          </T>
          <View className="flex-row" style={{ gap: 4 }}>
            {owned.slice(0, 5).map((p) => (
              <Tap key={p.id} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={p.name} style={{ width: thumb, alignItems: 'center' }}>
                <Garment kind={p.kind} tint={p.tint} image={p.image} size={thumb - 4} dark={scheme === 'dark'} label={p.name} />
              </Tap>
            ))}
          </View>
          <Button testID="trend-compose" label="Composer une tenue avec" variant="secondary" size="m" icon="layers" onPress={() => nav.navigate('Compose', { pieces: owned.slice(0, 1).map((p) => p.id) })} />
          <Credit blocs={[s.contexte?.tendances]} />
        </Card>
      </View>
    );
  }

  if (id === 'tendance') {
    const camel = s.pieces.filter((p) => ['Camel', 'Cognac', 'Camel et crème'].includes(p.color));
    if (camel.length < 2) return null;
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
                <Garment kind={p.kind} tint={p.tint} image={p.image} size={(W - 32 - 16) / 5 - 4} dark={scheme === 'dark'} label={p.name} />
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
            <T v="stat">
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
