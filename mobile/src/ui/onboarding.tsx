/**
 * Les pièces de l'onboarding : règle graduée, emplacements photo, figure de
 * mesures, cartes de style, couleurs aimées/évitées, premier portant.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Platform, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { Piece } from '../data/wardrobe';
import type { MeasureId, Silhouette } from '../state/profile';
import { useTheme } from '../theme/ThemeProvider';
import { glassSurface } from './Glass';
import { motion } from '../theme/tokens';
import { Garment, hangOf, type GarmentKind } from './Garment';
import { Icon } from './Icon';
import { T } from './T';
import { Tap, haptic } from './Tap';
import { IconButton } from './Button';
import { isLight } from './controls';
import { F } from '../theme/fonts';

/* ---- Règle graduée (taille, poids) ---- */

const TICK = 10;

/**
 * Une règle qu'on fait glisser, comme dans les apps de santé : la valeur se
 * lit en grand, le trait laiton marque le centre. Les boutons − et + restent
 * pour VoiceOver, la souris, et les réglages au centimètre près.
 */
export function Ruler({ value, onChange, min, max, unit, label, width, testID }: { value: number; onChange: (v: number) => void; min: number; max: number; unit: string; label: string; width: number; testID?: string }) {
  const { c } = useTheme();
  const ref = useRef<ScrollView>(null);
  const last = useRef(value);
  const pad = width / 2;
  const count = max - min;

  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollTo({ x: (value - min) * TICK, animated: false }), 30);
    return () => clearTimeout(t);
    // Au montage seulement : ensuite, c'est le défilement qui fait foi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const v = Math.max(min, Math.min(max, min + Math.round(e.nativeEvent.contentOffset.x / TICK)));
    if (v !== last.current) {
      last.current = v;
      haptic('select');
      onChange(v);
    }
  };
  const nudge = (d: number) => {
    const v = Math.max(min, Math.min(max, value + d));
    last.current = v;
    onChange(v);
    ref.current?.scrollTo({ x: (v - min) * TICK, animated: true });
  };

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${value} ${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={{ gap: 6 }}
    >
      <View className="flex-row items-center justify-between">
        <IconButton testID={testID && `${testID}-minus`} icon="minus" label={`Diminuer ${label}`} variant="quiet" size={40} onPress={() => nudge(-1)} />
        <T v="hero" style={{ fontSize: 52, lineHeight: 56, textAlign: 'center' }} accessibilityElementsHidden>
          {value}
          <T v="cardTitle" tone="ink2">
            {' '}
            {unit}
          </T>
        </T>
        <IconButton testID={testID && `${testID}-plus`} icon="plus" label={`Augmenter ${label}`} variant="quiet" size={40} onPress={() => nudge(1)} />
      </View>
      <View style={{ height: 64 }}>
        <ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          snapToInterval={TICK}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: pad }}
        >
          <Svg width={count * TICK + 1} height={64}>
            {Array.from({ length: count + 1 }, (_, i) => {
              const v = min + i;
              const major = v % 10 === 0;
              const mid = v % 5 === 0;
              return (
                <Line key={i} x1={i * TICK + 0.5} x2={i * TICK + 0.5} y1={0} y2={major ? 26 : mid ? 18 : 11} stroke={major ? c.ink : c.control} strokeWidth={major ? 1.5 : 1} />
              );
            })}
            {Array.from({ length: Math.floor(count / 10) + 1 }, (_, k) => {
              const v = Math.ceil(min / 10) * 10 + k * 10;
              if (v > max) return null;
              return (
                <SvgText key={v} x={(v - min) * TICK} y={46} fill={c.ink2} fontSize={12} fontFamily="Sans500" textAnchor="middle">
                  {v}
                </SvgText>
              );
            })}
          </Svg>
        </ScrollView>
        <View pointerEvents="none" style={{ position: 'absolute', left: pad - 1.5, top: -4, width: 3, height: 36, borderRadius: 0, backgroundColor: c.brass }} />
      </View>
    </View>
  );
}

/* ---- Le premier portant ---- */

/** Un cintre vide qui attend une pièce : contour pointillé, léger balancement. */
function EmptyHanger({ size, i }: { size: number; i: number }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    r.value = withDelay(i * 220, withRepeat(withSequence(withTiming(2.2, { duration: 1600, easing: Easing.inOut(Easing.sin) }), withTiming(-2.2, { duration: 1600, easing: Easing.inOut(Easing.sin) })), -1, true));
  }, [i, r, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={[{ transformOrigin: 'top' }, style]}>
      <Svg width={size} height={size * 1.25} viewBox="0 0 120 150">
        <Path d="M60 17 L60 9 Q60 3 65 3 Q70 3 70 8" stroke={c.rod} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <Path d="M60 17 L30 28 M60 17 L90 28" stroke={c.rod} strokeWidth={3} fill="none" strokeLinecap="round" />
        <Path d="M34 30 L86 30 L90 118 L30 118 Z" stroke={c.control} strokeWidth={1.6} strokeDasharray="5 6" fill="none" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

/** Une pièce qui arrive sur la tringle : elle tombe et se balance un instant. */
function Arriving({ piece, size, dark }: { piece: Piece; size: number; dark: boolean }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const y = useSharedValue(reduced ? 0 : -50);
  const r = useSharedValue(reduced ? 0 : 9);
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    o.value = withTiming(1, { duration: 200 });
    y.value = withSpring(0, { damping: 14, stiffness: 190 });
    r.value = withSequence(withSpring(-6, { damping: 10, stiffness: 120 }), withSpring(0, motion.swing));
  }, [o, r, y, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }, { rotate: `${r.value}deg` }] }));
  const hangs = hangOf(piece.kind) !== 'none';
  return (
    <Animated.View style={[{ transformOrigin: 'top', height: size * 1.25, justifyContent: hangs ? 'flex-start' : 'flex-end' }, style]}>
      <Garment kind={piece.kind} tint={piece.tint} image={piece.image} size={hangs ? size : size * 0.86} hanger={hangs} hangerColor={c.rod} dark={dark} label={piece.name} />
    </Animated.View>
  );
}

/** Le portant de départ : les pièces ajoutées, puis des cintres vides jusqu'à `slots`. */
export function FirstRail({ pieces, slots = 5, size = 76, onPiece }: { pieces: Piece[]; slots?: number; size?: number; onPiece?: (p: Piece) => void }) {
  const { c, scheme } = useTheme();
  const empty = Math.max(0, slots - pieces.length);
  return (
    <View style={{ height: size * 1.25 + 8 }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 2, height: 1.5, backgroundColor: c.rod }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
        {pieces.map((p) => (
          <Tap key={p.id} testID={`rail-new-${p.id}`} onPress={onPiece ? () => onPiece(p) : undefined} disabled={!onPiece} accessibilityLabel={p.name} scaleTo={0.96}>
            <Arriving piece={p} size={size} dark={scheme === 'dark'} />
          </Tap>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <EmptyHanger key={`e${i}`} i={i} size={size} />
        ))}
      </ScrollView>
    </View>
  );
}

/* ---- Photos pour l'analyse de silhouette ---- */

/** Une silhouette de personne, pour guider la pose et illustrer les photos d'exemple. */
export function Figure({ pose = 'face', color, fill, width = 60 }: { pose?: 'face' | 'profil'; color: string; fill: string; width?: number }) {
  const face = 'M22 30 Q30 26 38 30 L44 36 Q46 52 42 62 L41 70 Q46 84 44 98 L40 150 L33 150 L31 104 L29 104 L27 150 L20 150 L16 98 Q14 84 19 70 L18 62 Q14 52 16 36 Z';
  const side = 'M26 30 Q33 27 36 32 Q40 44 38 58 Q42 66 41 80 Q41 92 38 100 L37 150 L29 150 L28 104 Q24 90 25 78 Q20 64 24 50 Q22 38 26 30 Z';
  return (
    <Svg width={width} height={width * 2.6} viewBox="0 0 60 156">
      <Circle cx={pose === 'face' ? 30 : 31} cy={15} r={10} fill={fill} stroke={color} strokeWidth={1.4} />
      <Path d={pose === 'face' ? face : side} fill={fill} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  );
}

export function PhotoSlot({ label, uri, example, pose, width, onPress, testID, scanning }: { label: string; uri?: string | null; example?: boolean; pose: 'face' | 'profil'; width: number; onPress: () => void; testID?: string; scanning?: boolean }) {
  const { c } = useTheme();
  const h = width * 1.33;
  const filled = !!uri || example;
  return (
    <Tap testID={testID} onPress={onPress} accessibilityLabel={filled ? `${label} : photo ajoutée. Changer` : `${label} : ajouter une photo`} style={{ width, gap: 8 }} scaleTo={0.98}>
      <View
        style={{ width, height: h, borderRadius: 0, overflow: 'hidden', borderWidth: filled ? 0 : 1.5, borderStyle: 'dashed', borderColor: c.control, backgroundColor: filled ? (example ? '#DADADA' : c.sunk) : 'transparent' }}
        className="items-center justify-center"
      >
        {uri ? (
          <Image source={{ uri }} style={{ width, height: h }} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : example ? (
          <Figure pose={pose} color="#5E5E5E" fill="#F3F3F3" width={width * 0.36} />
        ) : (
          <View className="items-center" style={{ gap: 10, opacity: 0.9 }}>
            <View style={{ opacity: 0.55 }}>
              <Figure pose={pose} color={c.control} fill="transparent" width={width * 0.3} />
            </View>
            <View className="flex-row items-center bg-pill" style={{ borderRadius: 0, paddingHorizontal: 10, height: 28, gap: 4 }}>
              <Icon name="plus" size={14} color={c.ink} strokeWidth={2} />
              <T v="small" style={{ ...F.s600 }}>
                Ajouter
              </T>
            </View>
          </View>
        )}
        {scanning && <ScanLine height={h} />}
      </View>
      <T v="caption" style={{ textAlign: 'center', ...F.s600 }}>
        {label}
      </T>
    </Tap>
  );
}

function ScanLine({ height }: { height: number }) {
  const { c } = useTheme();
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * (height - 3) }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: c.brass }, style]} />;
}

/* ---- Figure de mesures ---- */

const LINES: Record<MeasureId, { y: number; label: string }> = {
  poitrine: { y: 44, label: 'Poitrine' },
  taille: { y: 62, label: 'Taille' },
  hanches: { y: 80, label: 'Hanches' },
};

/** Où prendre chaque mesure : la ligne active passe en laiton. */
export function MeasureFigure({ active, done, height = 190 }: { active: MeasureId | null; done: Partial<Record<MeasureId, number>>; height?: number }) {
  const { c } = useTheme();
  const w = height * 0.62;
  return (
    <Svg width={w} height={height} viewBox="0 0 74 156" accessibilityElementsHidden>
      <Circle cx={30} cy={15} r={10} fill={c.sunk} stroke={c.control} strokeWidth={1.2} />
      <Path d="M22 30 Q30 26 38 30 L44 36 Q46 52 42 62 L41 70 Q46 84 44 98 L40 150 L33 150 L31 104 L29 104 L27 150 L20 150 L16 98 Q14 84 19 70 L18 62 Q14 52 16 36 Z" fill={c.sunk} stroke={c.control} strokeWidth={1.2} strokeLinejoin="round" />
      {(Object.keys(LINES) as MeasureId[]).map((id) => {
        const on = active === id;
        const ok = !!done[id];
        return (
          <Line key={id} x1={10} x2={50} y1={LINES[id].y} y2={LINES[id].y} stroke={on ? c.brass : ok ? c.ink : c.control} strokeWidth={on ? 2.2 : 1.2} strokeDasharray={ok || on ? undefined : '3 3'} />
        );
      })}
      {(Object.keys(LINES) as MeasureId[]).map((id) => (
        <SvgText key={`t${id}`} x={54} y={LINES[id].y + 3} fill={active === id ? c.brass : c.ink2} fontSize={7.5} fontFamily="Sans600">
          {LINES[id].label}
        </SvgText>
      ))}
    </Svg>
  );
}

/* ---- Cartes de style ---- */

export function StyleCard({ name, note, kinds, on, order, width, onPress }: { name: string; note: string; kinds: [GarmentKind, string?][]; on: boolean; order: number; width: number; onPress: () => void }) {
  const { c, scheme } = useTheme();
  const g = width * 0.36;
  return (
    <Tap testID={`style-${name}`} onPress={onPress} feedback="select" accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${name} : ${note}`} style={[{ width, borderRadius: 0, overflow: 'hidden' }, glassSurface(c, scheme), { borderWidth: on ? 2 : 1, borderColor: on ? c.ink : c['card-edge'] }]} scaleTo={0.97}>
      <View className="flex-row items-end justify-center" style={{ height: width * 0.62, paddingBottom: 6, backgroundColor: c.stage }}>
        {kinds.map(([k, t], i) => (
          <View key={i} style={{ marginLeft: i ? -g * 0.34 : 0, transform: [{ rotate: `${(i - 1) * 5}deg` }, { translateY: i === 1 ? -6 : 0 }] }}>
            <Garment kind={k} tint={t} size={g} dark={scheme === 'dark'} />
          </View>
        ))}
        {on && (
          <View className="absolute bg-primary-bg items-center justify-center" style={{ top: 8, right: 8, width: 24, height: 24, borderRadius: 0 }}>
            <T v="small" tone="primary-fg" style={{ ...F.s700 }}>
              {order}
            </T>
          </View>
        )}
      </View>
      <View style={{ padding: 10, paddingTop: 8, gap: 1 }}>
        <T v="bodyStrong">{name}</T>
        <T v="small" tone="ink2" numberOfLines={2}>
          {note}
        </T>
      </View>
    </Tap>
  );
}

/* ---- Couleurs : aimée, évitée ---- */

export type ColorState = 'aime' | 'evite' | null;

export function ColorChoice({ name, hex, state, onPress, size = 52, width }: { name: string; hex: string; state: ColorState; onPress: () => void; size?: number; width?: number }) {
  const { c } = useTheme();
  const tone = isLight(hex) ? '#1C1A17' : '#FFFFFF';
  return (
    <Tap
      testID={`color-${name}`}
      onPress={onPress}
      feedback="select"
      accessibilityRole="button"
      accessibilityLabel={`${name} : ${state === 'aime' ? 'tu aimes' : state === 'evite' ? 'tu évites' : 'neutre'}`}
      accessibilityHint="Touche pour passer de neutre à j’aime, puis à j’évite"
      style={{ width: width ?? size + 18, alignItems: 'center', gap: 6 }}
      scaleTo={0.94}
    >
      <View style={{ width: size, height: size, borderRadius: 0, padding: 3, borderWidth: 2, borderColor: state === 'aime' ? c.ink : state === 'evite' ? c.caution : 'transparent' }}>
        <View style={{ flex: 1, borderRadius: 0, backgroundColor: hex, borderWidth: 1, borderColor: c.rule, opacity: state === 'evite' ? 0.4 : 1 }} className="items-center justify-center">
          {state === 'aime' && <Icon name="heart" size={18} color={tone} strokeWidth={2} />}
          {state === 'evite' && <Icon name="close" size={18} color={c.ink} strokeWidth={2.2} />}
        </View>
      </View>
      <T v="small" tone={state ? 'ink' : 'ink2'} numberOfLines={1} style={state ? { ...F.s600 } : undefined}>
        {name}
      </T>
    </Tap>
  );
}

/* ---- Carte de choix large (rayon, mode d'analyse) ---- */

export function ChoiceCard({ title, note, on, onPress, art, badge, testID }: { title: string; note: string; on?: boolean; onPress: () => void; art?: ReactNode; badge?: string; testID?: string }) {
  const { c, scheme } = useTheme();
  return (
    <Tap testID={testID} onPress={onPress} feedback="select" accessibilityRole="radio" accessibilityState={{ checked: !!on }} accessibilityLabel={`${title}. ${note}`} scaleTo={0.985} className="flex-row items-center" style={[{ minHeight: 88, gap: 14, padding: 12, paddingRight: 16, borderRadius: 0 }, glassSurface(c, scheme), { borderWidth: on ? 2 : 1, borderColor: on ? c.ink : c['card-edge'] }]}>
      {art && <View className="items-center justify-center" style={{ width: 76, height: 76, borderRadius: 0, overflow: 'hidden', backgroundColor: c.stage }}>{art}</View>}
      <View style={{ flex: 1, gap: 3 }}>
        {badge && (
          <T v="kicker" tone="brass">
            {badge}
          </T>
        )}
        <T v="bodyStrong" style={{ fontSize: 16.5 }}>
          {title}
        </T>
        <T v="caption" tone="ink2">
          {note}
        </T>
      </View>
      <View style={{ width: 24, height: 24, borderRadius: 0, borderWidth: on ? 0 : 1.5, borderColor: c.control, backgroundColor: on ? c['primary-bg'] : 'transparent' }} className="items-center justify-center">
        {on && <Icon name="check" size={14} color={c['primary-fg']} strokeWidth={2.4} />}
      </View>
    </Tap>
  );
}

/** Trois pièces qui se chevauchent : l'art d'une carte de choix. */
export function Trio({ kinds, size = 34 }: { kinds: [GarmentKind, string?][]; size?: number }) {
  const { scheme } = useTheme();
  return (
    <View className="flex-row items-end">
      {kinds.map(([k, t], i) => (
        <View key={i} style={{ marginLeft: i ? -size * 0.3 : 0 }}>
          <Garment kind={k} tint={t} size={size} dark={scheme === 'dark'} />
        </View>
      ))}
    </View>
  );
}

export const IS_WEB = Platform.OS === 'web';
export type { Silhouette };
