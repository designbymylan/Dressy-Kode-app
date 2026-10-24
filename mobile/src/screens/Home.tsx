import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { WEATHER_WORD, DAYS, DAYS_LETTER, DAYS_SHORT, MONTHS, dayDate, euros, lcFirst, relativeDay, shortDate, sinceLabel, type Piece } from '../data/wardrobe';
import { MODULE_LABELS, eventsOn, precision, sleeping, usageRate, useMeteo, useStore, useTodayOutfits, type HomeModule } from '../state/store';
import { isoOf, spanLabel } from '../state/planning';
import { usePlanifier } from '../state/usePlanifier';
import { ferieDu, tendancesChezToi } from '../state/contexte';
import { Credit } from '../ui/Credit';
import { canCompose, missingForOutfit } from '../state/outfits';
import { FirstRail } from '../ui/onboarding';
import { useTheme } from '../theme/ThemeProvider';
import { material, motion, space, TAB_CLEARANCE } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button, IconButton } from '../ui/Button';
import { ScrollEdge, TabHeader, useTabScroll, useTabTop } from '../ui/layout';
import { DressRows, FlatLay, assembleDelay, headToToe, rowOf, type RowId } from '../ui/outfit';
import { Card, Tag, WeatherIcon } from '../ui/bits';
import { NotForMeSheet } from '../ui/ecart';
import { bilanDe, jourDeBilan } from '../state/bilan';
import { Garment } from '../ui/Garment';
import { Icon } from '../ui/Icon';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import { KodeThinking } from '../ui/KodeThinking';
import { Kodi } from '../ui/Kodi';
import { isActive } from '../state/jobs';
import type { Nav } from '../navigation/types';
import { F } from '../theme/fonts';

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);
/** « jeudi 9 octobre » : la date du jour en toutes lettres. */
const longDate = () => {
  const d = new Date();
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/**
 * L'accueil (06/10) : chaque section a sa forme, dans l'ordre choisi dans
 * Personnaliser, la tenue du jour comprise. Rangées de la tête aux pieds,
 * cartes de la semaine, bulle de Kodi, arches, page de magazine,
 * classement, mosaïque, tickets, bloc plein (canevas
 * https://claude.ai/artifact/D6Y93CiR4UXrrp6djzxXcc). Couleurs, polices,
 * verre et arrondis restent ceux de la charte.
 */
export function Home() {
  const { s } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width } = useScreen();
  const edge = useSharedValue(0);
  const onScroll = useTabScroll(edge);
  const outfits = useTodayOutfits();
  const meteo = useMeteo();
  const now = meteo.now;
  const city = s.profile.city;
  // « Mar. 6 oct. · Lyon, 15°, nuageux » ; sans météo connue, la date et la ville seulement.
  const meteoTxt = now ? `${now.t}°, ${now.mot ?? (city ? WEATHER_WORD[now.kind] : (meteo.jours[0]?.label ?? WEATHER_WORD[now.kind]))}` : null;
  const todayEvents = eventsOn(s.events, isoOf(0)).length;
  const { c } = useTheme();
  const semaineVisible = s.modules.some((m) => m.id === 'semaine' && m.on);
  const W = width - space.gutter * 2;
  const top = useTabTop();

  return (
    <View style={{ flex: 1 }} className="bg-paper">
      <Ambient weather={now?.kind} />
      <ScrollEdge y={edge} />
      <TabHeader title="Dresskode" brand y={edge} actions={[{ icon: 'sliders', label: 'Personnaliser l’accueil', onPress: () => nav.navigate('Customize'), testID: 'customize-home' }]} />
      <Animated.ScrollView
        testID="screen-home"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: TAB_CLEARANCE + insets.bottom, gap: 28 }}
      >
        {/* Le salut (09/10) : la date et la ville en petites capitales, une phrase fine, la météo et la journée en puces. */}
        <View style={{ gap: 8, paddingHorizontal: 4, marginBottom: -12 }} testID="home-hello">
          <T v="label" tone="ink2" numberOfLines={1}>
            {[capital(longDate()), city].filter(Boolean).join(' · ')}
          </T>
          <T v="hero" accessibilityRole="header">
            {`Bonjour${s.profile.name ? ` ${s.profile.name}` : ''},\n`}
            {!outfits.length ? 'ton dressing\nt’attend' : s.wornToday ? 'ta tenue du jour\nest ' : 'ta tenue du jour\nest '}
            {outfits.length ? (
              <T v="hero" style={F.accent}>
                {s.wornToday ? 'portée' : 'prête'}
              </T>
            ) : null}
            .
          </T>
          <View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 2 }}>
            {now && (
              <View className="flex-row items-center" style={{ gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: c['glass-strong'], borderWidth: 1, borderColor: c['card-edge'] }}>
                <Icon name={now.kind === 'soleil' ? 'sun' : now.kind === 'nuages' ? 'cloud' : now.kind === 'pluie' ? 'rain' : 'showers'} size={15} color={c.ink} />
                <T v="small">{meteoTxt}</T>
              </View>
            )}
            {todayEvents > 0 && (
              <Tap testID="home-today-events" hitSlop={6} onPress={() => nav.navigate('Tabs', { screen: 'Agenda' })} accessibilityLabel={`${todayEvents} rendez-vous aujourd’hui`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: c['glass-strong'], borderWidth: 1, borderColor: c['card-edge'] }}>
                <Icon name="calendar" size={15} color={c.ink} />
                <T v="small">{`${todayEvents} rendez-vous`}</T>
              </Tap>
            )}
          </View>
        </View>

        {/* Un dressing pas encore prêt : l'appel à ajouter reste en tête, quel que soit l'ordre choisi. */}
        {!outfits.length && <EmptyToday />}

        {/* Le dimanche et le lundi, le bilan de la semaine passe devant (09/10). */}
        {outfits.length > 0 && jourDeBilan() && <BilanCard />}

        {/* Un dressing pas encore prêt : les premiers pas seuls, sans sections vides ni suggestions sans pièces. */}
        {s.modules
          .filter((m) => m.on && outfits.length > 0)
          .map((m) => (m.id === 'tenue' ? outfits.length ? <TodayCard key="tenue" W={W} /> : null : <Module key={m.id} id={m.id} W={W} />))}

        {/* La météo de l'en-tête est créditée dans « Ta semaine » ; section masquée, elle l'est ici. */}
        {meteo.reelle && !semaineVisible && <Credit blocs={[s.contexte?.meteo]} />}
      </Animated.ScrollView>
    </View>
  );
}

/** La tenue du jour : de la tête aux pieds, voisines à toucher, cadenas pour « Une autre ». */
function TodayCard({ W }: { W: number }) {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const { c } = useTheme();
  const outfits = useTodayOutfits();
  const byId = new Map(s.pieces.map((p) => [p.id, p]));
  const outfit = outfits[s.outfitIndex % outfits.length];
  const pieces = outfit.pieces.map((id) => byId.get(id)).filter(Boolean) as Piece[];
  const worn = !!s.wornToday;
  const inner = W - 28;
  // La tenue telle qu'on l'a ajustée : une pièce prise à une voisine remplace celle de sa rangée.
  const [swapped, setSwapped] = useState<Partial<Record<RowId, string>>>({});
  const [pinned, setPinned] = useState<Set<RowId>>(new Set());
  const [nope, setNope] = useState(false);
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
    <Card style={{ padding: 14, gap: 12 }} testID="home-outfit">
      {/* Le matin, un geste (09/10) : « Je la porte » et « Une autre » en tête de carte, visibles sans défiler. */}
      <View className="flex-row items-center" style={{ gap: 8, minHeight: 40 }}>
        <View style={{ flex: 1 }}>
          <Tag label={worn ? 'Portée aujourd’hui' : 'Tenue du jour'} />
        </View>
        {!worn && (
          <>
            {outfits.length > 1 && <IconButton testID="another-outfit" icon="refresh" label="Une autre tenue" variant="quiet" size={40} onPress={another} />}
            <Button testID="wear-today" label="Je la porte" size="s" feedback="success" onPress={() => a.wear(shown.map((p) => p.id), 'Notée dans ton journal')} />
          </>
        )}
      </View>
      {/* De la tête aux pieds : visage et cou, veste, haut, bas, chaussures, sac. */}
      <Animated.View key={outfit.id} entering={FadeIn.duration(320)} style={{ backgroundColor: c.stage, borderRadius: 22, paddingVertical: 12, overflow: 'hidden' }}>
        <DressRows
          pieces={shown}
          pool={worn ? [] : s.pieces}
          width={inner}
          pinned={pinned}
          onTogglePin={(r) => setPinned((prev) => { const n = new Set(prev); if (n.has(r)) n.delete(r); else n.add(r); return n; })}
          onSwap={(r, to) => setSwapped((prev) => ({ ...prev, [r]: to.id }))}
          onPiece={(p) => nav.navigate('Piece', { id: p.id })}
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
      {worn && <WornToday pieces={shown} />}
      {/* « Pas pour moi » (09/10) : la raison part chez Kodi, la tenue ne revient plus. */}
      {!worn && (
        <View className="flex-row items-center justify-between" style={{ borderTopWidth: 1, borderColor: c.rule, marginHorizontal: 4 }}>
          <T testID="not-for-me" v="label" tone="ink2" onPress={() => setNope(true)} accessibilityRole="button" accessibilityHint="Dis à Kodi pourquoi, et vois une autre tenue" suppressHighlighting style={{ paddingTop: 14, paddingBottom: 16, marginBottom: -12, paddingRight: 16 }}>
            Pas pour moi
          </T>
          <T v="small" tone="ink2">
            {outfits.length > 1 ? `${(s.outfitIndex % outfits.length) + 1} sur ${outfits.length}` : ''}
          </T>
        </View>
      )}
      <NotForMeSheet
        visible={nope}
        pieces={shown}
        onClose={() => setNope(false)}
        onConfirm={(raison, cibles) => {
          setNope(false);
          a.ecarter(shown.map((p) => p.id), raison, cibles, outfit.pieces);
          // La suivante arrive telle que Kodi l'a pensée : les pièces changées ou gardées repartent.
          setSwapped({});
          setPinned(new Set());
        }}
      />
    </Card>
  );
}

/** La carte du bilan : la semaine en sept traits de couleur, et le chiffre qui compte. */
function BilanCard() {
  const { s } = useStore();
  const nav = useNavigation<Nav>();
  const { c } = useTheme();
  const b = bilanDe(s);
  const byId = new Map(s.pieces.map((p) => [p.id, p]));
  const vide = b.habilles === 0;
  return (
    <Tap testID="home-bilan" onPress={() => nav.navigate('Bilan')} scaleTo={0.99} accessibilityLabel={vide ? 'Ton bilan : prépare ta semaine' : `Ton bilan : ${b.habilles} tenues cette semaine`} style={{ borderRadius: 28, padding: 16, gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c['card-edge'] }}>
      <View className="flex-row items-center justify-between">
        <Tag label={new Date().getDay() === 0 ? 'Bilan du dimanche' : 'Ta semaine passée'} />
        <Icon name="arrow" size={16} color={c.ink2} />
      </View>
      <View className="flex-row items-end justify-between" style={{ gap: 12 }}>
        <T v="section" style={{ flex: 1 }}>
          {vide ? 'Ta semaine qui vient' : `${b.habilles} tenue${b.habilles > 1 ? 's' : ''} sur 7 jours`}
        </T>
        <View className="flex-row" style={{ gap: 4 }} accessibilityElementsHidden importantForAccessibility="no">
          {b.jours.map((j) => {
            const tints = j.pieces.map((id) => byId.get(id)).filter(Boolean).map((p) => (p as Piece).tint ?? (p as Piece).swatch).slice(0, 3);
            return (
              <View key={j.date} style={{ width: 10, height: 34, borderRadius: 5, overflow: 'hidden', justifyContent: 'flex-end', gap: 1, borderWidth: 1, borderColor: tints.length ? c['card-edge'] : c.rule, opacity: j.futur ? 0.4 : 1 }}>
                {tints.map((t, k) => (
                  <View key={k} style={{ flex: 1, backgroundColor: t }} />
                ))}
              </View>
            );
          })}
        </View>
      </View>
      <T v="caption" tone="ink2">
        {vide ? 'Kodi prépare tes tenues avec la météo et tes rendez-vous.' : `${b.portees.length} pièces portées · ${b.part} % de ton dressing${b.ecartees ? ` · ${b.ecartees} écartée${b.ecartees > 1 ? 's' : ''}` : ''}`}
      </T>
    </Tap>
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
          Bonne journée. Kodi s’en souviendra pour tes prochaines tenues.
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
  // Les photos confiées à Kodi (au questionnaire ou depuis l'ajout) : on voit qu'il travaille.
  const drawing = new Set(s.jobs.filter(isActive).map((j) => j.source_paths[0])).size;
  const waiting = s.pendingPhotos.length;
  const knows = precision(s.profile);
  // Trois premiers pas, dans l'ordre où ils servent : des pièces, un style, une silhouette.
  const steps: { id: string; title: string; note: string; done: boolean; onPress: () => void }[] = [
    { id: 'pieces', title: n >= 3 ? 'Trois pièces ajoutées' : `Ajouter trois pièces · ${n}/3`, note: 'Une photo de tenue entière en compte plusieurs.', done: n >= 3, onPress: () => nav.navigate('AddPiece') },
    { id: 'style', title: 'Dire à Kodi ton style', note: 'Deux ou trois mots suffisent.', done: s.profile.styles.length > 0, onPress: () => nav.navigate('ProfileEdit') },
    { id: 'affiner', title: 'Aider Kodi à viser juste', note: `Deux minutes, tout est facultatif · ${knows} %`, done: knows >= 50, onPress: () => nav.navigate('Affiner') },
  ];
  const done = steps.filter((x) => x.done).length;
  return (
    <Animated.View entering={FadeIn.duration(320)} style={{ gap: 12 }} testID="home-empty">
      {drawing > 0 ? (
        <Card className="bg-butter" style={{ gap: 8 }} testID="home-drawing">
          <KodeThinking phrases={['Kodi repère chaque pièce', 'Kodi dessine tes pièces', 'Kodi les range sur tes portants']} />
          <T v="body" tone="ink2">
            {drawing > 1 ? `${drawing} photos en cours` : 'Une photo en cours'} : chaque vêtement arrive sur tes portants, sans fond, dès qu’il est dessiné.
          </T>
        </Card>
      ) : waiting > 0 ? (
        <Card className="bg-butter" style={{ gap: 6 }} testID="home-waiting">
          <T v="cardTitle">{waiting > 1 ? `${waiting} photos attendent ton compte.` : 'Une photo attend ton compte.'}</T>
          <T v="body" tone="ink2">
            {s.pendingEmail ? 'Confirme ton adresse, puis connecte-toi depuis Moi : Kodi dessinera tes pièces aussitôt.' : 'Crée ton compte depuis Moi : Kodi dessinera tes pièces aussitôt.'}
          </T>
        </Card>
      ) : null}

      {/* Tes premiers pas (09/10) : ce qui manque pour la première tenue, et deux gestes qui aident Kodi. */}
      <Card style={{ gap: 14, padding: 16 }} testID="home-first-steps">
        <View className="flex-row items-center justify-between">
          <Tag label="Tes premiers pas" />
          <T v="kicker" tone="ink2">{`${done}/3`}</T>
        </View>
        <View style={{ marginHorizontal: -16 }}>
          <FirstRail pieces={s.pieces.slice(0, 5)} slots={5} size={62} onPiece={(p) => nav.navigate('Piece', { id: p.id })} />
        </View>
        <T v="caption" tone="ink2">
          {n ? `Il manque ${missing} pour ta première tenue.` : 'Trois pièces suffisent pour ta première tenue : un haut, un bas, des chaussures.'}
        </T>
        <Button testID="home-add-first" label={n ? 'Ajouter la pièce qui manque' : 'Ajouter mes premières pièces'} icon="plus" onPress={() => nav.navigate('AddPiece')} />
        <View>
          {steps.map((x, k) => (
            <Tap
              key={x.id}
              testID={`first-${x.id}`}
              onPress={x.onPress}
              scaleTo={0.99}
              accessibilityLabel={`${x.title}${x.done ? ', fait' : ''}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderTopWidth: 1, borderColor: c.rule }}
            >
              <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: x.done ? 0 : 1.5, borderColor: c.control, backgroundColor: x.done ? c['primary-bg'] : 'transparent' }}>
                {x.done ? <Icon name="check" size={14} color={c['primary-fg']} strokeWidth={2.4} /> : <T v="small" tone="ink2">{String(k + 1)}</T>}
              </View>
              <View style={{ flex: 1, paddingVertical: 8 }}>
                <T v="body" style={[F.s500, x.done && { textDecorationLine: 'line-through', color: c.ink2 }]}>
                  {x.title}
                </T>
                {!x.done && (
                  <T v="small" tone="ink2">
                    {x.note}
                  </T>
                )}
              </View>
              {!x.done && <Icon name="chevron" size={16} color={c.ink2} />}
            </Tap>
          ))}
        </View>
      </Card>
    </Animated.View>
  );
}

/** Une petite ligne à point : un mot ou deux. */
function DotLine({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View className="flex-row items-center" style={{ gap: 6 }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.ink }} />
      <T v="kicker" numberOfLines={1} style={{ flexShrink: 1 }}>
        {text}
      </T>
    </View>
  );
}

/** Un jour de la semaine : sa tenue posée à plat, ou une carte en pointillés pour la prévoir. */
function DayCard({ d }: { d: number }) {
  const { s } = useStore();
  const meteo = useMeteo();
  const nav = useNavigation<Nav>();
  const { c } = useTheme();
  const w = meteo.jours[d];
  const date = isoOf(d);
  const o = s.planned[date];
  const ev = eventsOn(s.events, date)[0];
  const ferie = ferieDu(s.contexte, d);
  const label = d === 1 ? 'Demain' : capital(DAYS_SHORT[dayDate(d).getDay()]);
  const num = String(dayDate(d).getDate()).padStart(2, '0');
  const pieces = o ? (o.pieces.map((id) => s.pieces.find((p) => p.id === id)).filter(Boolean) as Piece[]) : [];
  const note = ev?.title ?? ferie?.nom ?? o?.title ?? null;
  const said = [relativeDay(d), shortDate(d), w ? `${w.t} degrés, ${w.label}` : null, note].filter(Boolean).join(', ');
  const shell = { width: 150, borderRadius: 28, padding: 12, gap: 8 };
  const top = (
    <>
      <View className="flex-row items-center justify-between">
        <T v="kicker">{label}</T>
        {w ? (
          <View className="flex-row items-center" style={{ gap: 3 }}>
            <WeatherIcon w={w} size={15} color={c.ink} />
            <T v="kicker">{`${w.t}°`}</T>
          </View>
        ) : null}
      </View>
      <T v="stat" style={{ fontSize: 32, lineHeight: 36 }}>
        {num}
      </T>
    </>
  );
  if (!o)
    return (
      <Tap testID={`week-plan-${d}`} onPress={() => nav.navigate('Compose', { date })} accessibilityLabel={`Prévoir une tenue : ${said}`} scaleTo={0.98} style={[shell, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.faint }]}>
        {top}
        <View style={{ height: 132, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.pill, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={22} color={c.ink} />
          </View>
          <T v="bodyStrong" style={{ fontSize: 14, ...F.s600 }}>
            Prévoir
          </T>
        </View>
        <View style={{ height: 16 }}>{note ? <DotLine text={note} /> : null}</View>
      </Tap>
    );
  return (
    <Tap testID={`planned-${d}`} onPress={() => nav.navigate('Planning', { date })} accessibilityLabel={`Tenue prévue : ${said}`} scaleTo={0.98} style={[shell, { backgroundColor: c.card, borderWidth: d === 1 ? 1.5 : 1, borderColor: d === 1 ? c.ink : c['card-edge'] }]}>
      {top}
      <FlatLay pieces={pieces} w={126} h={132} />
      <View style={{ height: 16 }}>
        <DotLine text={note ?? 'Prête'} />
      </View>
    </Tap>
  );
}

/**
 * Ta semaine (06/10) : les tenues prévues et la météo réunies, en grand.
 * Une barre de sept jours dit ce qui est prêt ; chaque jour est une carte ;
 * Kodi peut compléter les jours vides avec tes pièces.
 */
function Week() {
  const { s, a } = useStore();
  const meteo = useMeteo();
  const nav = useNavigation<Nav>();
  const { c } = useTheme();
  const outfits = useTodayOutfits();
  const planifier = usePlanifier();
  const [busy, setBusy] = useState(false);
  const ready = (i: number) => (i === 0 ? outfits.length > 0 || !!s.wornToday : !!s.planned[isoOf(i)]);
  const count = Array.from({ length: 7 }, (_, i) => ready(i)).filter(Boolean).length;
  const empty = [1, 2, 3, 4, 5, 6].filter((d) => !s.planned[isoOf(d)]).map((d) => isoOf(d));
  const trip = s.trips.find((t) => t.end >= isoOf(0));
  const fill = async () => {
    setBusy(true);
    try {
      // Kodi prépare les jours vides, avec les rendez-vous et la météo de chacun.
      const out = await planifier(empty);
      const n = Object.keys(out).length;
      for (const [d, o] of Object.entries(out)) a.plan(d, o, 'kode');
      if (n) a.toast(n > 1 ? `${n} tenues prévues` : 'Une tenue prévue');
    } finally {
      setBusy(false);
    }
  };
  const month = () => nav.navigate('Planning', {});
  return (
    <View style={{ gap: 14 }} testID="home-week">
      <View className="flex-row items-end justify-between" style={{ paddingHorizontal: 4 }}>
        <T testID="home-week-title" v="hero" accessibilityRole="header" onPress={month} suppressHighlighting style={{ fontSize: 28, lineHeight: 32 }}>
          Ta semaine
        </T>
        <T testID="module-semaine-action" v="label" tone="ink2" onPress={month} accessibilityRole="link" suppressHighlighting style={{ paddingVertical: 12, paddingLeft: 12, marginVertical: -12 }}>
          Calendrier
        </T>
      </View>
      {/* Sept jours : le trait se remplit quand la tenue est prête. */}
      <Tap testID="home-week-bar" onPress={month} scaleTo={1} feedback="none" accessibilityLabel={`${count} jours sur 7 ont leur tenue, ouvrir le calendrier`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 4 }}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: ready(i) ? c.ink : c.rule }} />
            <T v="kicker" tone={i === 0 ? 'ink' : 'ink2'}>
              {DAYS_LETTER[dayDate(i).getDay()]}
            </T>
          </View>
        ))}
        <T v="kicker" style={{ paddingLeft: 8 }}>{`${count}/7`}</T>
      </Tap>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter }} contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 4, paddingBottom: 10, gap: 10 }}>
        {[1, 2, 3, 4, 5, 6].map((d) => (
          <DayCard key={d} d={d} />
        ))}
      </ScrollView>
      {trip && (
        <Tap testID="home-trip" onPress={() => nav.navigate('Trip', { id: trip.id })} scaleTo={0.99} accessibilityLabel={`Voyage à ${trip.destination}, ${spanLabel(trip.start, trip.end)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
          <Icon name="plane" size={18} color={c.ink} />
          <T v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
            {`${trip.destination} · ${spanLabel(trip.start, trip.end)}`}
          </T>
          <Icon name="chevron" size={16} color={c.ink2} />
        </Tap>
      )}
      {empty.length > 0 && canCompose(s.pieces) && <Button testID="week-fill" label="Compléter avec Kodi" variant="secondary" icon="kode" loading={busy} onPress={fill} />}
      {meteo.reelle && <Credit blocs={[s.contexte?.meteo, s.contexte?.feries]} />}
    </View>
  );
}

/** « Aujourd'hui », « Hier », le jour de la semaine, puis « Il y a 12 j ». */
function addedLabel(p: Piece) {
  const n = p.addedDaysAgo;
  if (n <= 0) return 'Aujourd’hui';
  if (n === 1) return 'Hier';
  if (n < 7) return capital(DAYS_SHORT[dayDate(-n).getDay()]);
  return `Il y a ${n} j`;
}

function Module({ id, W }: { id: HomeModule; W: number }) {
  const { s } = useStore();
  const meteo = useMeteo();
  const nav = useNavigation<Nav>();
  const { c, scheme } = useTheme();
  const dark = scheme === 'dark';
  const title = MODULE_LABELS[id].title;
  // L'étiquette à point de la section, avec son lien à droite.
  const head = (action?: string, onAction?: () => void) => (
    <View className="flex-row items-center justify-between" style={{ minHeight: 28 }}>
      <Tag label={title} />
      {action && onAction && (
        <T testID={`module-${id}-action`} v="label" tone="ink2" onPress={onAction} accessibilityRole="link" suppressHighlighting style={{ paddingVertical: 12, paddingLeft: 12 }}>
          {action}
        </T>
      )}
    </View>
  );
  const allPieces = () => nav.navigate('Tabs', { screen: 'Dressing', params: { view: 'grille' } });

  if (id === 'semaine') return <Week />;

  // Kodi : une bulle de message beurre, son coin bas presque droit, et Kodi qui salue (21/10).
  if (id === 'kode') {
    const tomorrow = eventsOn(s.events, isoOf(1))[0];
    const asks = [
      tomorrow ? `${capital(lcFirst(tomorrow.title))}, demain` : 'Une tenue pour demain',
      s.profile.occasions.includes('Bureau') ? 'Tenue de bureau' : 'Une tenue pour ce soir',
      s.pieces.length >= 8 ? 'Ce que je ne porte jamais' : 'Ce qui va avec mon jean',
    ];
    const ink = c['butter-ink'];
    return (
      <Card className="bg-butter" style={{ padding: 18, gap: 14, borderBottomLeftRadius: 8 }} testID="home-kode">
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Kodi mood="wave" size={44} track />
          <T v="cardTitle" accessibilityRole="header" style={{ color: ink, ...F.s600 }}>
            {title}
          </T>
        </View>
        <Tap testID="home-ask-kode" onPress={() => nav.navigate('Tabs', { screen: 'Kode' })} scaleTo={0.99} accessibilityLabel="Poser une question à Kodi" style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c['butter-field'], height: 50, borderRadius: 25, paddingHorizontal: 18 }}>
          <T v="body" style={{ color: ink }}>
            Une tenue pour…
          </T>
        </Tap>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {asks.map((q) => (
            <Tap key={q} onPress={() => nav.navigate('Tabs', { screen: 'Kode', params: { ask: q, nonce: Date.now() } })} accessibilityLabel={`Demander à Kodi : ${q}`} style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: c['butter-field'], justifyContent: 'center' }}>
              <T v="caption" style={{ color: ink, ...F.s500, fontSize: 14 }}>
                {q}
              </T>
            </Tap>
          ))}
        </View>
      </Card>
    );
  }

  // À redécouvrir : chaque pièce dans une arche, le nombre de jours en grand.
  if (id === 'oubliees') {
    const list = sleeping(s.pieces).slice(0, 3);
    if (!list.length) return <Quiet head={head()} text="Rien ne dort : tout ton dressing tourne." />;
    const aw = (W - 32 - 20) / 3;
    return (
      <Card style={{ padding: 16, gap: 14 }} testID="home-sleeping">
        {head('Tout voir', allPieces)}
        <View className="flex-row" style={{ gap: 10 }}>
          {list.map((p) => (
            <Tap key={p.id} testID={`sleeping-${p.id}`} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={`${p.name}, ${sinceLabel(p)}`} style={{ width: aw, alignItems: 'center', gap: 8 }}>
              <View style={{ width: aw, height: 138, borderTopLeftRadius: aw / 2, borderTopRightRadius: aw / 2, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', paddingBottom: 8 }}>
                <Garment kind={p.kind} tint={p.tint} image={p.image} size={aw * 0.78} dark={dark} label={p.name} />
              </View>
              <View className="flex-row items-baseline" style={{ gap: 4 }}>
                <T v="stat" style={{ fontSize: 30, lineHeight: 32 }}>
                  {String(p.lastWorn ?? p.addedDaysAgo)}
                </T>
                <T v="kicker" tone="ink2">
                  jours
                </T>
              </View>
            </Tap>
          ))}
        </View>
      </Card>
    );
  }

  // Tendance : une page de magazine, le nom en grand, les pièces dans des ronds qui se chevauchent.
  if (id === 'tendance') {
    let name: string;
    let line: string;
    let owned: Piece[];
    if (meteo.reelle) {
      // Compte connecté : la pièce dont l'intérêt monte le plus cette semaine, et que le dressing a déjà.
      const top = tendancesChezToi(s.contexte, s.pieces)[0];
      if (!top) return <Quiet head={head()} text="Aucune tendance de la semaine dans ton dressing." />;
      name = top.t.libelle;
      owned = top.pieces;
      line = top.t.variation !== null ? `+${top.t.variation} % cette semaine` : 'De saison';
    } else {
      owned = s.pieces.filter((p) => ['Camel', 'Cognac', 'Camel et crème'].includes(p.color));
      if (owned.length < 2) return <Quiet head={head()} text="Aucune tendance de la saison dans ton dressing." />;
      name = 'Le camel';
      line = 'De saison';
    }
    const n = owned.length;
    const R = Math.min(120, Math.floor((W - 48) / 2.56));
    const step = R * 0.78;
    const circles = owned.slice(0, 3);
    return (
      <View style={{ gap: 12, paddingHorizontal: 4 }} testID="home-trend">
        <Tag label={title} />
        <T v="hero" accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit style={{ fontSize: 34, lineHeight: 38 }}>
          {name}
        </T>
        <T v="body" tone="ink2">
          {`${line} · ${n > 1 ? `${n} pièces chez toi` : 'une pièce chez toi'}`}
        </T>
        <View style={{ height: R + 4 }}>
          {circles.map((p, k) => (
            <View key={p.id} style={{ position: 'absolute', left: k * step, top: 0 }}>
              <Tap onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={p.name} style={{ width: R, height: R, borderRadius: R / 2, backgroundColor: c.stage, borderWidth: 4, borderColor: c.paper, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <Garment kind={p.kind} tint={p.tint} image={p.image} size={R * 0.62} dark={dark} label={p.name} />
              </Tap>
            </View>
          ))}
          <View style={{ position: 'absolute', left: (circles.length - 1) * step + R - 20, top: R / 2 - 28 }}>
            <Tap testID="trend-compose" onPress={() => nav.navigate('Compose', { pieces: owned.slice(0, meteo.reelle ? 1 : 3).map((p) => p.id) })} accessibilityLabel={`Composer une tenue : ${name.toLowerCase()}`} style={[{ width: 56, height: 56, borderRadius: 28, backgroundColor: c['primary-bg'], alignItems: 'center', justifyContent: 'center' }]}>
              <Icon name="kode" size={22} color={c['primary-fg']} />
            </Tap>
          </View>
        </View>
        {meteo.reelle && <Credit blocs={[s.contexte?.tendances]} />}
      </View>
    );
  }

  // Le plus porté : un classement, une barre par pièce.
  if (id === 'porte') {
    const list = [...s.pieces].filter((p) => p.wears > 0).sort((x, z) => z.wears - x.wears).slice(0, 3);
    if (!list.length) return <Quiet head={head()} text="Porte une tenue : le classement commence." />;
    const max = list[0].wears;
    return (
      <Card style={{ padding: 16, gap: 14 }} testID="home-most-worn">
        {head('Tout voir', allPieces)}
        <View style={{ gap: 12 }}>
          {list.map((p, k) => (
            <Tap key={p.id} testID={`porte-${p.id}`} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={`${k + 1}, ${p.name}, ${p.wears} ports`} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72 }}>
              <T v="stat" style={{ width: 22, textAlign: 'center', fontSize: 28, lineHeight: 32 }}>
                {String(k + 1)}
              </T>
              <View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <Garment kind={p.kind} tint={p.tint} image={p.image} size={50} dark={dark} label={p.name} />
              </View>
              <View style={{ flex: 1, gap: 9 }}>
                <View className="flex-row items-baseline justify-between" style={{ gap: 8 }}>
                  <T v="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {p.name}
                  </T>
                  <T v="kicker">{`${p.wears}×`}</T>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: c.rule }}>
                  <View style={{ width: `${Math.round((p.wears / max) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: c.ink }} />
                </View>
              </View>
            </Tap>
          ))}
        </View>
      </Card>
    );
  }

  // Nouveautés : une mosaïque, une grande vignette et deux petites.
  if (id === 'nouveautes') {
    const list = [...s.pieces].filter((p) => p.addedDaysAgo <= 21).sort((x, z) => x.addedDaysAgo - z.addedDaysAgo).slice(0, 3);
    if (!list.length) return <Quiet head={head()} text="Rien de neuf ces trois dernières semaines." action={<Button label="Ajouter une pièce" size="m" variant="quiet" icon="plus" onPress={() => nav.navigate('AddPiece')} />} />;
    const half = (W - 10) / 2;
    const tile = (p: Piece, w: number, h: number, size: number) => (
      <Tap key={p.id} testID={`nouveautes-${p.id}`} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={`${p.name}, ${addedLabel(p).toLowerCase()}`} style={{ width: w, height: h, borderRadius: 22, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Garment kind={p.kind} tint={p.tint} image={p.image} size={size} dark={dark} label={p.name} />
        <View style={{ position: 'absolute', top: 10, left: 10 }}>
          <Tag label={addedLabel(p)} tone="glass" />
        </View>
      </Tap>
    );
    return (
      <View style={{ gap: 12 }} testID="home-new">
        <View style={{ paddingHorizontal: 4 }}>{head('Dressing', allPieces)}</View>
        {list.length === 1 ? (
          tile(list[0], W, 220, 130)
        ) : list.length === 2 ? (
          <View className="flex-row" style={{ gap: 10 }}>
            {tile(list[0], half, 220, half * 0.7)}
            {tile(list[1], half, 220, half * 0.7)}
          </View>
        ) : (
          <View className="flex-row" style={{ gap: 10 }}>
            {tile(list[0], half, 268, half * 0.8)}
            <View style={{ gap: 10 }}>
              {tile(list[1], half, 129, 82)}
              {tile(list[2], half, 129, 82)}
            </View>
          </View>
        )}
      </View>
    );
  }

  // Prêts en cours : des tickets à talon, la pièce d'un côté, l'amie de l'autre.
  if (id === 'prets') {
    const loans = s.shares.filter((x) => x.mode !== 'montrer').slice(0, 3);
    if (!loans.length) return <Quiet head={head()} text="Aucun prêt ni don en cours." />;
    return (
      <View style={{ gap: 12 }} testID="home-loans">
        <View style={{ paddingHorizontal: 4 }}>{head()}</View>
        {loans.map((x) => {
          const p = s.pieces.find((q) => q.id === x.pieceId);
          const lent = x.mode === 'preter';
          return (
            <Tap key={x.id} onPress={() => p && nav.navigate('Piece', { id: p.id })} scaleTo={0.99} accessibilityLabel={`${p?.name ?? 'Pièce'}, ${lent ? 'prêtée à' : 'donnée à'} ${x.friend}`} style={{ height: 96, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c['card-edge'], flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
              <View style={{ width: 96, height: 96, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {p && <Garment kind={p.kind} tint={p.tint} image={p.image} size={62} dark={dark} label={p.name} />}
              </View>
              <View pointerEvents="none" style={{ position: 'absolute', left: 96, top: 12, bottom: 12, borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: c.faint }} />
              {/* Les encoches du talon : deux demi-ronds découpés dans le bord. */}
              <View pointerEvents="none" style={{ position: 'absolute', left: 87, top: -10, width: 18, height: 18, borderRadius: 9, backgroundColor: c.paper, borderWidth: 1, borderColor: c['card-edge'] }} />
              <View pointerEvents="none" style={{ position: 'absolute', left: 87, bottom: -10, width: 18, height: 18, borderRadius: 9, backgroundColor: c.paper, borderWidth: 1, borderColor: c['card-edge'] }} />
              <View style={{ flex: 1, paddingLeft: 18, paddingRight: 8, gap: 6 }}>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c['primary-bg'], alignItems: 'center', justifyContent: 'center' }}>
                    <T v="stat" style={{ fontSize: 16, lineHeight: 18, color: c['primary-fg'] }}>
                      {(x.friend[0] ?? '?').toUpperCase()}
                    </T>
                  </View>
                  <T v="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {x.friend}
                  </T>
                </View>
                <T v="caption" tone="ink2" numberOfLines={1}>
                  {p?.name ?? 'Pièce'}
                </T>
              </View>
              <View style={{ marginRight: 14 }}>
                <Tag label={lent ? 'Prêtée' : 'Donnée'} dot={false} />
              </View>
            </Tap>
          );
        })}
      </View>
    );
  }

  // Ton mois : un bloc plein (noir en clair, blanc en sombre), trois grands chiffres.
  const worn30 = s.pieces.filter((p) => p.lastWorn !== null && p.lastWorn <= 30).length;
  const priced = s.pieces.filter((p) => p.price && p.wears > 0);
  const cpw = priced.length ? priced.reduce((n, p) => n + (p.price ?? 0), 0) / priced.reduce((n, p) => n + p.wears, 0) : null;
  const stats = [
    { v: String(worn30), l: 'pièces sorties' },
    { v: `${usageRate(s.pieces)} %`, l: 'du dressing porté' },
    ...(cpw !== null ? [{ v: euros(cpw), l: 'par port' }] : []),
  ];
  // Un bloc plein, sur le panneau noir du 21/10 (la section découpée du web).
  const fg = c['on-panel'];
  return (
    <View testID="home-month" style={[{ borderRadius: 28, backgroundColor: c.panel, padding: 20, gap: 18 }, material.card[scheme]]}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} />
          <T v="kicker" accessibilityRole="header" style={{ color: fg }}>
            {title}
          </T>
        </View>
        <T v="kicker" style={{ color: fg }}>
          {capital(MONTHS[new Date().getMonth()])}
        </T>
      </View>
      <View className="flex-row" style={{ gap: 10 }}>
        {stats.map((x) => (
          <View key={x.l} style={{ flex: 1, gap: 6 }}>
            <T v="stat" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 32, lineHeight: 36, color: fg }}>
              {x.v}
            </T>
            <T v="caption" style={{ color: fg }}>
              {x.l}
            </T>
          </View>
        ))}
      </View>
    </View>
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
