import { useEffect, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import type { OrbStep } from '../state/jobs';
import { useTheme } from '../theme/ThemeProvider';
import { T } from './T';
import { Icon, type IconName } from './Icon';
import { F } from '../theme/fonts';

/** L'étape en cours se lit à l'icône au centre du rond : repérer, dessiner, comparer, ranger. */
const STEP_ICON: Record<OrbStep | 'kode', IconName> = { kode: 'kode', look: 'eye', draw: 'edit', check: 'check', store: 'hanger' };

/**
 * L'orbe de Kode, en noir et blanc comme toute la galerie : le rond noir de
 * Kode (le même que dans la barre d'onglets), l'icône de l'étape au centre,
 * et un arc fin qui tourne autour tant que Kode travaille. Quand l'étape
 * change, la nouvelle icône apparaît en fondu. Immobile si les animations
 * sont réduites.
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
  const inset = Math.round(size * 0.14);
  const r = size / 2 - 1;

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, ring]}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.ink} strokeWidth={1.4} fill="none" strokeDasharray={`${r * 1.6} ${r * 6.4}`} />
        </Svg>
      </Animated.View>
      <View style={{ position: 'absolute', left: inset, top: inset, right: inset, bottom: inset, borderRadius: size, backgroundColor: c['primary-bg'] }} className="items-center justify-center">
        <Animated.View key={step} entering={reduced ? undefined : FadeIn.duration(300)}>
          <Icon name={STEP_ICON[step]} size={Math.round(size * 0.4)} color={c['primary-fg']} strokeWidth={1.9} />
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * « Kode réfléchit » : l'orbe et une phrase qui change toutes les deux
 * secondes environ, comme si Kode commentait ce qu'il fait. Aucun nom de
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
