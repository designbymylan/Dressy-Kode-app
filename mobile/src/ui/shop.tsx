/**
 * Les pièces des pages Offres et Boutique (09/10), copiées sur la maquette
 * validée (canevas « Dresskode, nouvelle base »), elle-même tirée de la page
 * d'abonnement envoyée par l'utilisatrice : le bouton de fermeture rond, le
 * trait chromé en haut, la promesse en grand, les cartes de ce qui est
 * inclus, les lignes à cocher, les cartes de réassurance et le bouton noir
 * qui reste en bas. Aucune pastille de réduction : l'économie se lit par le
 * prix barré.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { motion, space } from '../theme/tokens';
import { F } from '../theme/fonts';
import { T } from './T';
import { Tap } from './Tap';
import { Icon, chromeStops, type IconName } from './Icon';
import { Struck, Tag } from './bits';

/** Le rond de fermeture, en haut à droite, comme sur le modèle. */
export function CloseButton() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  return (
    <Tap
      testID="header-back"
      onPress={() => nav.goBack()}
      accessibilityLabel="Fermer"
      hitSlop={6}
      outerStyle={{ position: 'absolute', top: insets.top + 6, right: space.gutter, zIndex: 10 }}
      style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c['glass-strong'], borderWidth: 1, borderColor: c['card-edge'] }}
    >
      <Icon name="close" size={18} color={c.ink} strokeWidth={1.8} />
    </Tap>
  );
}

/** Le trait chromé qui tourne en haut à droite, derrière la promesse. */
export function Scribble({ variant = 0 }: { variant?: 0 | 1 }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const stops = chromeStops(c.ink) ?? [c.ink, c.ink, c.ink, c.ink, c.ink];
  const d =
    variant === 0
      ? 'M40 150 C 20 70, 120 20, 170 60 C 215 95, 170 160, 120 130 C 75 103, 120 40, 185 48 C 225 53, 230 120, 205 160 C 190 185, 150 205, 105 205'
      : 'M30 120 C 60 40, 150 30, 190 80 C 220 120, 180 175, 130 160 C 90 148, 95 95, 140 90 C 190 85, 215 140, 200 185 C 192 210, 170 222, 150 225';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', right: -26, top: insets.top - 30 }} accessibilityElementsHidden importantForAccessibility="no">
      <Svg width={230} height={230} viewBox="0 0 230 230">
        <Defs>
          <LinearGradient id={`scribble${variant}`} x1="0" y1="0" x2="230" y2="230" gradientUnits="userSpaceOnUse">
            {stops.map((s, i) => (
              <Stop key={i} offset={['0', '0.38', '0.52', '0.68', '1'][i]} stopColor={s} />
            ))}
          </LinearGradient>
        </Defs>
        <Path d={d} fill="none" stroke={`url(#scribble${variant})`} strokeWidth={9} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/** La promesse : deux lignes fines en grand, la phrase forte centrée, la précision en gris. */
export function Promise({ title, lead, note, testID }: { title: string; lead: ReactNode; note: string; testID?: string }) {
  return (
    <View style={{ gap: 0 }}>
      <T v="hero" accessibilityRole="header" testID={testID} style={{ fontSize: 48, lineHeight: 50, letterSpacing: -0.96, maxWidth: '78%' }}>
        {title}
      </T>
      <T v="bodyL" style={{ ...F.s600, fontSize: 19, lineHeight: 24, textAlign: 'center', marginTop: 16 }}>
        {lead}
      </T>
      <T v="caption" tone="ink2" style={{ textAlign: 'center', marginTop: 6 }}>
        {note}
      </T>
    </View>
  );
}

/** « Ce qui est inclus ⌄ » : un petit titre gris centré, qui peut tout déplier. */
export function Fold({ label, open, onPress }: { label: string; open?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  const body = (
    <>
      <T v="caption" tone="ink2">
        {label}
      </T>
      <Icon name={open ? 'up' : 'down'} size={14} color={c.ink2} strokeWidth={2} flat />
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 4, minHeight: 32 };
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Tap onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: !!open }} accessibilityLabel={label} scaleTo={0.98} style={style}>
      {body}
    </Tap>
  );
}

/** Une carte de ce qui est inclus : l'icône chromée, deux mots, une phrase. */
export function FeatureCard({ icon, title, note, right, children, testID }: { icon: IconName; title: string; note?: string; right?: string; children?: ReactNode; testID?: string }) {
  const { c } = useTheme();
  return (
    <View testID={testID} style={{ flexGrow: 1, flexBasis: '45%', padding: 14, gap: 8, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c['card-edge'] }}>
      <View className="flex-row items-center justify-between">
        <Icon name={icon} size={20} color={c.ink} strokeWidth={1.7} />
        {right ? (
          <T v="kicker" style={F.s600}>
            {right}
          </T>
        ) : null}
      </View>
      <T v="body" style={{ ...F.s600, fontSize: 14, lineHeight: 18 }}>
        {title}
      </T>
      {note ? (
        <T v="small" tone="ink2">
          {note}
        </T>
      ) : null}
      {children}
    </View>
  );
}

/** Une ligne à cocher : le rond, le nom et sa précision, le prix et le prix barré. */
export function RadioRow({ name, note, price, struck, on, mine, onPress, testID, right }: { name: string; note: string; price: string; struck?: string; on: boolean; mine?: boolean; onPress: () => void; testID?: string; right?: ReactNode }) {
  const { c } = useTheme();
  return (
    <Tap
      testID={testID}
      onPress={onPress}
      disabled={mine}
      scaleTo={0.99}
      feedback="select"
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled: !!mine }}
      accessibilityLabel={`${name}, ${price}${struck ? ` au lieu de ${struck}` : ''}${mine ? ', ton offre actuelle' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: c.card, borderWidth: on ? 1.5 : 1, borderColor: on ? c.ink : c['card-edge'] }}
    >
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: on ? 6 : 1.5, borderColor: on ? c.ink : mine ? c.faint : c.control }} />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <T v="body" style={F.s500}>
            {name}
          </T>
          {mine && <Tag label="La tienne" />}
        </View>
        <T v="small" tone="ink2" numberOfLines={2}>
          {note}
        </T>
      </View>
      {right ?? (
        <View style={{ alignItems: 'flex-end', gap: 1 }}>
          <T v="body" style={{ ...F.s600, fontVariant: ['tabular-nums'] }}>
            {price}
          </T>
          {struck ? <Struck label={struck} /> : null}
        </View>
      )}
    </Tap>
  );
}

/** Les cartes de réassurance qui défilent, à la place des avis du modèle. */
export function Reassure({ items }: { items: { icon: IconName; text: string }[] }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
      {items.map((x) => (
        <View key={x.text} style={{ width: 236, padding: 14, borderRadius: 22, flexDirection: 'row', gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c['card-edge'] }}>
          <Icon name={x.icon} size={18} color={c.ink} strokeWidth={1.8} />
          <T v="caption" style={{ flex: 1 }}>
            {x.text}
          </T>
        </View>
      ))}
    </ScrollView>
  );
}

/** Le fondu sous le bouton fixe : la page passe dessous sans se couper net. */
export function BottomFade({ height = 130 }: { height?: number }) {
  const { c } = useTheme();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.paper} stopOpacity={0} />
            <Stop offset="0.55" stopColor={c.paper} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
      </Svg>
    </View>
  );
}

/**
 * Un choix à deux cases (27/10), d'après la page d'abonnement envoyée : un
 * plateau gris, et un fond clair qui glisse sous la case choisie. `tray`
 * donne le grand plateau des durées ; sinon c'est la capsule des offres.
 * « Réduire les animations » pose le fond sans le faire glisser.
 */
export function SlideChoice<V extends string>({ value, onChange, label, options, tray, testID }: { value: V; onChange: (v: V) => void; label: string; options: { value: V; a11y: string; node: (on: boolean) => ReactNode; testID?: string }[]; tray?: boolean; testID?: string }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const pad = tray ? 6 : 4;
  const cell = Math.max(0, (w - pad * 2) / options.length);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = reduced || !w ? idx * cell : withSpring(idx * cell, motion.spring);
  }, [idx, cell, w, reduced, x]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', padding: pad, borderRadius: tray ? 24 : 999, backgroundColor: c.stage, ...(tray ? null : { alignSelf: 'center', width: 280 }) }}
    >
      {/* Pas de className : le fond est animé (voir en tête de CLAUDE.md). */}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: pad, bottom: pad, left: pad, width: cell, borderRadius: tray ? 18 : 999, backgroundColor: tray ? c.paper : c['glass-strong'], borderWidth: 1, borderColor: tray ? c.rule : c['glass-border'] },
          slide,
        ]}
      />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Tap
            key={o.value}
            testID={o.testID}
            onPress={() => onChange(o.value)}
            outerStyle={{ flex: 1 }}
            style={tray ? { paddingVertical: 13, paddingHorizontal: 14, gap: 3 } : { minHeight: 40, alignItems: 'center', justifyContent: 'center' }}
            scaleTo={1}
            feedback="select"
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.a11y}
          >
            {o.node(on)}
          </Tap>
        );
      })}
    </View>
  );
}
