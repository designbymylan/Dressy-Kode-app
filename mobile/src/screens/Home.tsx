import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
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
import { ScrollEdge, TabHeader, useTabScroll, useTabTop } from '../ui/layout';
import { DressRows, assembleDelay, headToToe, rowOf, type RowId } from '../ui/outfit';
import { motion } from '../theme/tokens';
import { Card, DotChip, Tag, WeatherIcon } from '../ui/bits';
import { Garment } from '../ui/Garment';
import { Icon } from '../ui/Icon';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import { KodeThinking } from '../ui/KodeThinking';
import { isActive } from '../state/jobs';
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

  const top = useTabTop();
  const inner = W - 28;
  // La tenue telle qu'on l'a ajustée : une pièce prise à une voisine remplace celle de sa rangée.
  const [swapped, setSwapped] = useState<Partial<Record<RowId, string>>>({});
  const [pinned, setPinned] = useState<Set<RowId>>(new Set());
  const base = worn ? (s.wornToday!.map((id) => byId.get(id)).filter(Boolean) as Piece[]) : pieces;
  const shown = (() => {
    const out = base.map((p) => {
      const id = swapped[rowOf(p)];
      return id && byId.get(id) ? byId.get(id)! : p;
    });
    // Une pièce gardée d'une tenue à l'autre s'ajoute si la nouvelle n'a pas cette rangée.
    for (const [r, id] of Object.entries(swapped)) if (id && !out.some((p) => rowOf(p) === r) && byId.get(id)) out.push(byId.get(id)!);
    return headToToe(out.filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i));
  })();
  const another = () => {
    // Les rangées verrouillées passent à la tenue suivante ; le reste change.
    const keep: Partial<Record<RowId, string>> = {};
    for (const r of pinned) {
      const p = shown.find((x) => rowOf(x) === r);
      if (p) keep[r] = p.id;
    }
    setSwapped(keep);
    a.nextOutfit();
  };

  return (
    <View style={{ flex: 1 }} className="bg-paper">
      <Ambient weather={now?.kind} />
      <ScrollEdge y={edge} />
      <TabHeader title="Dresskode" brand y={edge} actions={[{ icon: 'sliders', label: 'Personnaliser l’accueil', onPress: () => nav.navigate('Customize'), testID: 'customize-home' }]} />
      <Animated.ScrollView
        testID="screen-home"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: TAB_CLEARANCE + insets.bottom, gap: 12 }}
      >
        <T v="kicker" tone="ink2" style={{ textAlign: 'center' }} numberOfLines={1}>
          {meta}
        </T>

        {!outfit ? (
          <EmptyToday />
        ) : (
          <Card style={{ padding: 14, gap: 12 }} testID="home-outfit">
            <Tag label={worn ? 'Portée aujourd’hui' : 'Tenue du jour'} />
            {/* De la tête aux pieds : visage et cou, veste, haut, bas, chaussures, sac. */}
            <Animated.View key={outfit.id} entering={FadeIn.duration(320)} style={{ backgroundColor: c.stage, borderRadius: 22, paddingVertical: 12, overflow: 'hidden' }}>
              <DressRows
                pieces={shown}
                pool={worn ? [] : s.pieces}
                width={inner}
                pinned={pinned}
                onTogglePin={(r) => setPinned((prev) => { const n = new Set(prev); if (n.has(r)) n.delete(r); else n.add(r); return n; })}
                onSwap={(r, to) => setSwapped((prev) => ({ ...prev, [r]: to.id }))}
                onPiece={open}
              />
            </Animated.View>
            {/* La tenue s'assemble sur la planche, puis son titre s'écrit. */}
            <Animated.View key={`t-${outfit.id}`} entering={FadeInDown.delay(assembleDelay(pieces.length)).duration(520)} style={{ gap: 4, paddingHorizontal: 4 }}>
              <T v="cardTitle" style={{ fontSize: 20, lineHeight: 25 }} accessibilityRole="header">
                {`${outfit.lead}${outfit.em}`.replace(/\s+/g, ' ')}
              </T>
              <T v="caption" tone="ink2" numberOfLines={2}>
                {outfit.why}
              </T>
            </Animated.View>
            {worn ? (
              <WornToday pieces={shown} />
            ) : (
              <View style={{ gap: 8 }}>
                <Button testID="wear-today" label="Je la porte" feedback="success" onPress={() => a.wear(shown.map((p) => p.id), 'Notée dans ton journal')} />
                <Button testID="another-outfit" label="Une autre" variant="quiet" icon="refresh" disabled={outfits.length < 2} onPress={another} />
              </View>
            )}
          </Card>
        )}

        {s.modules.filter((m) => m.on).map((m) => (
          <Module key={m.id} id={m.id} W={W} />
        ))}

        {/* La météo de l'en-tête est créditée dans « Ta semaine » ; module masqué, elle l'est ici. */}
        {meteo.reelle && !semaineVisible && <Credit blocs={[s.contexte?.meteo]} />}
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
        <Animated.View style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: c['positive-soft'], alignItems: 'center', justifyContent: 'center' }, check]}>
          <Icon name="check" size={22} color={c.positive} strokeWidth={2.6} />
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
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: colour }, style]} />;
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
  // Les photos confiées à Kode (au questionnaire ou depuis l'ajout) : on voit qu'il travaille.
  const drawing = new Set(s.jobs.filter(isActive).map((j) => j.source_paths[0])).size;
  const waiting = s.pendingPhotos.length;
  return (
    <Animated.View entering={FadeIn.duration(320)} style={{ gap: 16 }} testID="home-empty">
      {drawing > 0 ? (
        <Card className="bg-butter" style={{ gap: 8 }} testID="home-drawing">
          <KodeThinking phrases={['Kode repère chaque pièce', 'Kode dessine tes pièces', 'Kode les range sur tes portants']} />
          <T v="body" tone="ink2">
            {drawing > 1 ? `${drawing} photos en cours` : 'Une photo en cours'} : chaque vêtement arrive sur tes portants, sans fond, dès qu’il est dessiné.
          </T>
        </Card>
      ) : waiting > 0 ? (
        <Card className="bg-butter" style={{ gap: 6 }} testID="home-waiting">
          <T v="cardTitle">{waiting > 1 ? `${waiting} photos attendent ton compte.` : 'Une photo attend ton compte.'}</T>
          <T v="body" tone="ink2">
            {s.pendingEmail ? 'Confirme ton adresse, puis connecte-toi depuis Moi : Kode dessinera tes pièces aussitôt.' : 'Crée ton compte depuis Moi : Kode dessinera tes pièces aussitôt.'}
          </T>
        </Card>
      ) : null}
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
            <View key={k} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: k < Math.min(3, n) ? c.ink : c.rule }} />
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
          <View key={x.t} className="bg-stage" style={{ flex: 1, borderRadius: 18, padding: 12, gap: 6 }}>
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
  // Chaque module est une carte ouverte par son étiquette à point, avec son lien à droite.
  const head = (action?: string, onAction?: () => void, icon?: 'kode') => (
    <View className="flex-row items-center justify-between" style={{ minHeight: 28 }}>
      <Tag label={title} icon={icon} />
      {action && onAction && (
        <T testID={`module-${id}-action`} v="caption" tone="ink2" onPress={onAction} accessibilityRole="link" suppressHighlighting style={{ paddingVertical: 12, paddingLeft: 12 }}>
          {action}
        </T>
      )}
    </View>
  );
  const card = { padding: 14, gap: 12 };

  if (id === 'kode') {
    const tomorrow = eventsOf(s.profile).find((e) => e.day === 1);
    const asks = [
      tomorrow ? `Pour ${lcFirst(tomorrow.title)}, demain` : 'Une tenue pour demain',
      s.profile.occasions.includes('Bureau') ? 'Une tenue de bureau' : 'Une tenue pour ce soir',
      s.pieces.length >= 8 ? 'Qu’est-ce que je ne porte jamais ?' : 'Qu’est-ce qui va avec mon jean ?',
    ];
    return (
      <Card style={card}>
        {head(undefined, undefined, 'kode')}
        <Tap testID="home-ask-kode" onPress={() => nav.navigate('Tabs', { screen: 'Kode' })} scaleTo={0.99} accessibilityLabel="Poser une question à Kode" style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.sunk, height: 50, borderRadius: 25, paddingHorizontal: 18, gap: 10 }}>
          <Icon name="kode" size={20} color={c.ink} />
          <T v="body" tone="ink2">
            Pose ta question
          </T>
        </Tap>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {asks.map((q) => (
            <DotChip key={q} label={q} onPress={() => nav.navigate('Tabs', { screen: 'Kode', params: { ask: q, nonce: Date.now() } })} />
          ))}
        </View>
      </Card>
    );
  }

  if (id === 'semaine') {
    return (
      <Card style={card}>
        {head('Agenda', () => nav.navigate('Tabs', { screen: 'Agenda' }))}
        <View className="flex-row" style={{ gap: 4 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const d = dayDate(i);
            const w = meteo.jours[i];
            const ferie = ferieDu(s.contexte, i);
            const busy = eventsOf(s.profile).some((e) => e.day === i) || !!s.planned[i] || !!ferie;
            const label = [i === 0 ? 'Aujourd’hui' : shortDate(i), w ? `${w.t} degrés, ${w.label}` : null, ferie ? `férié, ${ferie.nom}` : null, busy && !ferie ? 'un événement' : null];
            const today = i === 0;
            const fg = today ? c['primary-fg'] : c.ink;
            return (
              <Tap key={i} testID={`week-${i}`} onPress={() => nav.navigate('Tabs', { screen: 'Agenda', params: { day: i } })} accessibilityLabel={label.filter(Boolean).join(', ')} outerStyle={{ flex: 1 }} style={{ backgroundColor: today ? c['primary-bg'] : c.pill, alignItems: 'center', justifyContent: 'center', gap: 5, height: 88, borderRadius: 22 }}>
                <T v="kicker" style={{ color: fg }}>
                  {DAYS_LETTER[d.getDay()]}
                </T>
                {w ? <WeatherIcon w={w} size={17} color={fg} /> : <View style={{ height: 17 }} />}
                <T v="kicker" style={{ color: fg }}>
                  {w ? `${w.t}°` : String(d.getDate())}
                </T>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: busy ? fg : 'transparent' }} />
              </Tap>
            );
          })}
        </View>
        {meteo.reelle && <Credit blocs={[s.contexte?.meteo, s.contexte?.feries]} />}
      </Card>
    );
  }

  if (id === 'oubliees') {
    const list = sleeping(s.pieces).slice(0, 5);
    if (!list.length) return <Quiet head={head()} text="Rien ne dort : tout ton dressing tourne." />;
    return (
      <Card style={card}>
        {head('Tout voir', () => nav.navigate('Tabs', { screen: 'Dressing', params: { view: 'grille' } }))}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -14 }} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
          {list.map((p) => (
            <Tap key={p.id} testID={`sleeping-${p.id}`} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={`${p.name}, ${sinceLabel(p)}`} style={{ width: 108 }}>
              <View className="bg-stage items-center justify-center" style={{ height: 128, borderRadius: 22 }}>
                <Garment kind={p.kind} tint={p.tint} image={p.image} size={72} dark={scheme === 'dark'} label={p.name} />
              </View>
              <T v="caption" style={{ marginTop: 6, ...F.s600 }} numberOfLines={1}>
                {p.name}
              </T>
              <T v="kicker" tone="ink2" numberOfLines={1}>
                {capital(sinceLabel(p))}
              </T>
            </Tap>
          ))}
        </ScrollView>
      </Card>
    );
  }

  if (id === 'tendance' && meteo.reelle) {
    // Compte connecté : la pièce dont l'intérêt monte le plus cette semaine, et que le dressing a déjà.
    const top = tendancesChezToi(s.contexte, s.pieces)[0];
    if (!top) return <Quiet head={head()} text="Aucune tendance de la semaine dans ton dressing." />;
    const { t, pieces: owned } = top;
    const thumb = (W - 28 - 16) / 5;
    return (
      <Card style={card}>
        {head()}
        <T v="cardTitle">{t.variation !== null ? `${t.libelle} : +${t.variation} % cette semaine.` : `${t.libelle} : de saison.`}</T>
        <T v="kicker" tone="ink2">
          {`Déjà ${owned.length > 1 ? `${owned.length} chez toi` : 'une chez toi'}`}
        </T>
        <View className="flex-row" style={{ gap: 4 }}>
          {owned.slice(0, 5).map((p) => (
            <Tap key={p.id} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={p.name} style={{ width: thumb, alignItems: 'center' }}>
              <Garment kind={p.kind} tint={p.tint} image={p.image} size={thumb - 4} dark={scheme === 'dark'} label={p.name} />
            </Tap>
          ))}
        </View>
        <Button testID="trend-compose" label="Composer avec" variant="quiet" size="m" icon="layers" onPress={() => nav.navigate('Compose', { pieces: owned.slice(0, 1).map((p) => p.id) })} />
        <Credit blocs={[s.contexte?.tendances]} />
      </Card>
    );
  }

  if (id === 'tendance') {
    const camel = s.pieces.filter((p) => ['Camel', 'Cognac', 'Camel et crème'].includes(p.color));
    if (camel.length < 2) return <Quiet head={head()} text="Aucune tendance de la saison dans ton dressing." />;
    const thumb = (W - 28 - 16) / 5;
    return (
      <Card style={card}>
        {head()}
        <T v="cardTitle">Le camel revient cette saison.</T>
        <T v="kicker" tone="ink2">
          {`Déjà ${camel.length} pièces chez toi`}
        </T>
        <View className="flex-row" style={{ gap: 4 }}>
          {camel.slice(0, 5).map((p) => (
            <Tap key={p.id} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={p.name} style={{ width: thumb, alignItems: 'center' }}>
              <Garment kind={p.kind} tint={p.tint} image={p.image} size={thumb - 4} dark={scheme === 'dark'} label={p.name} />
            </Tap>
          ))}
        </View>
        <Button testID="trend-compose" label="Composer avec le camel" variant="quiet" size="m" icon="layers" onPress={() => nav.navigate('Compose', { pieces: camel.slice(0, 3).map((p) => p.id) })} />
      </Card>
    );
  }

  if (id === 'prevues') {
    const days = Object.keys(s.planned).map(Number).filter((d) => d >= 1 && d <= 13).sort((x, z) => x - z).slice(0, 4);
    if (!days.length)
      return <Quiet head={head()} text="Rien de prévu ces prochains jours." action={<Button testID="module-prevues-compose" label="Prévoir demain" size="m" variant="quiet" icon="layers" onPress={() => nav.navigate('Compose', { day: 1 })} />} />;
    return (
      <Card style={card}>
        {head('Agenda', () => nav.navigate('Tabs', { screen: 'Agenda' }))}
        {days.map((d) => {
          const o = s.planned[d];
          const ps = o.pieces.map((pid) => s.pieces.find((p) => p.id === pid)).filter(Boolean) as Piece[];
          return (
            <Tap key={d} testID={`planned-${d}`} onPress={() => nav.navigate('Tabs', { screen: 'Agenda', params: { day: d } })} scaleTo={0.99} accessibilityLabel={`${shortDate(d)}, ${o.title}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 }}>
              <View style={{ width: 64, gap: 2 }}>
                <T v="kicker" tone="ink2">{capital(shortDate(d))}</T>
              </View>
              <View className="flex-row" style={{ flex: 1, gap: 4 }}>
                {headToToe(ps).slice(0, 4).map((p) => (
                  <View key={p.id} style={{ width: 46, height: 56, borderRadius: 14, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center' }}>
                    <Garment kind={p.kind} tint={p.tint} image={p.image} size={34} dark={scheme === 'dark'} label={p.name} />
                  </View>
                ))}
              </View>
              <Icon name="chevron" size={16} color={c.ink2} />
            </Tap>
          );
        })}
      </Card>
    );
  }

  if (id === 'nouveautes' || id === 'porte') {
    const list = id === 'nouveautes'
      ? [...s.pieces].filter((p) => p.addedDaysAgo <= 21).sort((x, z) => x.addedDaysAgo - z.addedDaysAgo).slice(0, 6)
      : [...s.pieces].filter((p) => p.wears > 0).sort((x, z) => z.wears - x.wears).slice(0, 6);
    if (!list.length)
      return id === 'nouveautes'
        ? <Quiet head={head()} text="Rien de neuf ces trois dernières semaines." action={<Button label="Ajouter une pièce" size="m" variant="quiet" icon="plus" onPress={() => nav.navigate('AddPiece')} />} />
        : <Quiet head={head()} text="Porte une tenue : le classement commence." />;
    return (
      <Card style={card}>
        {head('Tout voir', () => nav.navigate('Tabs', { screen: 'Dressing', params: { view: 'grille' } }))}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -14 }} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
          {list.map((p) => (
            <Tap key={p.id} testID={`${id}-${p.id}`} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={id === 'porte' ? `${p.name}, ${p.wears} ports` : p.name} style={{ width: 108 }}>
              <View className="bg-stage items-center justify-center" style={{ height: 128, borderRadius: 22 }}>
                <Garment kind={p.kind} tint={p.tint} image={p.image} size={72} dark={scheme === 'dark'} label={p.name} />
                {id === 'porte' && (
                  <View style={{ position: 'absolute', top: 8, left: 8 }}>
                    <Tag label={`${p.wears}×`} tone="glass" dot={false} />
                  </View>
                )}
              </View>
              <T v="caption" style={{ marginTop: 6, ...F.s600 }} numberOfLines={1}>
                {p.name}
              </T>
            </Tap>
          ))}
        </ScrollView>
      </Card>
    );
  }

  if (id === 'prets') {
    const loans = s.shares.filter((x) => x.mode !== 'montrer');
    if (!loans.length) return <Quiet head={head()} text="Aucun prêt ni don en cours." />;
    return (
      <Card style={card}>
        {head()}
        {loans.slice(0, 4).map((x) => {
          const p = s.pieces.find((q) => q.id === x.pieceId);
          return (
            <Tap key={x.id} onPress={() => p && nav.navigate('Piece', { id: p.id })} scaleTo={0.99} accessibilityLabel={`${p?.name ?? 'Pièce'}, ${x.mode === 'preter' ? 'prêtée à' : 'donnée à'} ${x.friend}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
              <View style={{ width: 46, height: 52, borderRadius: 14, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center' }}>
                {p && <Garment kind={p.kind} tint={p.tint} image={p.image} size={32} dark={scheme === 'dark'} label={p.name} />}
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyStrong" numberOfLines={1}>{p?.name ?? 'Pièce'}</T>
                <T v="kicker" tone="ink2">{`${x.mode === 'preter' ? 'Chez' : 'Donnée à'} ${x.friend}`}</T>
              </View>
            </Tap>
          );
        })}
      </Card>
    );
  }

  // bilan
  const worn30 = s.pieces.filter((p) => p.lastWorn !== null && p.lastWorn <= 30).length;
  return (
    <Card style={card}>
      {head()}
      <View className="flex-row" style={{ gap: 8 }}>
        {[
          { v: `${usageRate(s.pieces)} %`, l: 'porté en 3 mois' },
          { v: String(worn30), l: 'sorties ce mois' },
        ].map((x) => (
          <View key={x.l} className="bg-stage" style={{ flex: 1, gap: 4, borderRadius: 22, padding: 14 }}>
            <T v="stat" style={{ fontSize: 34, lineHeight: 36 }}>
              {x.v}
            </T>
            <T v="kicker" tone="ink2">
              {x.l}
            </T>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Une section sans rien à montrer reste à sa place, en une ligne : on voit qu'elle est là et où. */
function Quiet({ head, text, action }: { head: ReactNode; text: string; action?: ReactNode }) {
  return (
    <Card style={{ padding: 14, gap: 10 }}>
      {head}
      <T v="caption" tone="ink2" style={{ paddingHorizontal: 2 }}>
        {text}
      </T>
      {action}
    </Card>
  );
}
