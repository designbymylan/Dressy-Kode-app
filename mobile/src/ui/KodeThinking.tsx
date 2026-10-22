import { useEffect, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Kodi, type KodiMood } from './Kodi';
import Svg, { Circle } from 'react-native-svg';
import type { OrbStep } from '../state/jobs';
import { useTheme } from '../theme/ThemeProvider';
import { T } from './T';
import { F } from '../theme/fonts';

/** La tête de Kodi selon l'étape (21/10, comme le web) : il cherche, il dessine, il vérifie, il range. */
const STEP_MOOD: Partial<Record<OrbStep | 'kode', KodiMood>> = { look: 'listening', check: 'surprised', store: 'happy' };

/**
 * L'orbe de Kodi : Kodi en personne qui réfléchit, entouré d'un arc fin qui
 * tourne tant qu'il travaille. Sa tête dit l'étape (il regarde, il dessine,
 * il vérifie, il range). Immobile si les animations sont réduites.
 */
export function KodeOrb({ size = 28, step = 'kode' }: { size?: number; step?: OrbStep | 'kode' }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(360, { duration: 1400, easing: Easing.linear }), -1);
  }, [reduced, spin]);

  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const big = Math.round(size * 1.45);
  const r = big / 2 - 1;

  return (
    <View style={{ width: big, height: big, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ position: 'absolute', width: big, height: big }, ring]}>
        <Svg width={big} height={big}>
          <Circle cx={big / 2} cy={big / 2} r={r} stroke={c['blue-ink']} strokeWidth={1.4} fill="none" strokeDasharray={`${r * 1.6} ${r * 6.4}`} />
        </Svg>
      </Animated.View>
      <Kodi mood={STEP_MOOD[step] ?? 'thinking'} size={Math.round(big * 0.86)} tap={false} decorative />
    </View>
  );
}

/**
 * « Kodi réfléchit » : l'orbe et une phrase qui change toutes les deux
 * secondes environ, comme si Kodi commentait ce qu'il fait. Aucun nom de
 * modèle ni de service n'apparaît jamais à l'écran.
 */
export function KodeThinking({
  phrases,
  step,
  size = 28,
  every = 2200,
  center,
  style,
}: {
  phrases: readonly string[];
  step?: OrbStep;
  size?: number;
  every?: number;
  center?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [i, setI] = useState(0);
  const list = useRef(phrases);
  list.current = phrases;
  useEffect(() => {
    setI(0);
    if (phrases.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % list.current.length), every);
    return () => clearInterval(t);
  }, [phrases.join('|'), every]); // eslint-disable-line react-hooks/exhaustive-deps
  const phrase = phrases[i % phrases.length];
  return (
    <View className="flex-row items-center" style={[{ gap: 12, minHeight: 32, justifyContent: center ? 'center' : 'flex-start' }, style]} accessibilityRole="progressbar" accessibilityLabel={phrase} accessibilityLiveRegion="polite">
      <KodeOrb size={size} step={step ?? 'kode'} />
      <View className="flex-row items-center" style={{ flexShrink: 1, gap: 4 }}>
        <Animated.View key={phrase} entering={FadeIn.duration(360)}>
          <T v="caption" tone="ink2" style={{ ...F.s500 }}>
            {phrase}
          </T>
        </Animated.View>
        <Dots />
      </View>
    </View>
  );
}

function Dots() {
  return (
    <View className="flex-row" style={{ gap: 3, marginTop: 2 }}>
      {[0, 1, 2].map((k) => (
        <Dot key={k} i={k} />
      ))}
    </View>
  );
}

function Dot({ i }: { i: number }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const o = useSharedValue(reduced ? 0.6 : 0.25);
  useEffect(() => {
    if (reduced) return;
    o.value = withDelay(i * 150, withRepeat(withSequence(withTiming(1, { duration: 480 }), withTiming(0.25, { duration: 480 })), -1));
  }, [o, i, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: (o.value - 0.25) * -3 }] }));
  return <Animated.View style={[{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.ink2 }, style]} />;
}
