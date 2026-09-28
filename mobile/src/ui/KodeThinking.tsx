import { useEffect, useId, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { OrbStep } from '../state/jobs';
import { useTheme } from '../theme/ThemeProvider';
import { T } from './T';

/**
 * Les couleurs de l'orbe, une paire par étape : lavande quand Kode repère,
 * pêche quand il dessine, ciel quand il compare, menthe quand il range.
 * Elles ne suivent pas le thème (comme le `.kode-orb` du web) : l'orbe est
 * lumineux en clair comme en sombre, c'est ce qui le rend reconnaissable.
 */
const ORB: Record<OrbStep | 'kode', [string, string, string]> = {
  kode: ['#FFB89C', '#B9ADFF', '#9FD0FF'],
  look: ['#B9ADFF', '#9FD0FF', '#D9D5FF'],
  draw: ['#FFB89C', '#FFABC9', '#FFD6E5'],
  check: ['#9FD0FF', '#B9E0FF', '#CFE6FF'],
  store: ['#8FDDB8', '#B8EBD2', '#D4F3E4'],
};

/**
 * L'orbe de Kode : un anneau de couleur qui tourne, un cœur de verre qui
 * respire. Quand l'étape change, la nouvelle couleur se fond dans
 * l'ancienne ; la progression se lit sans texte. Immobile si les
 * animations sont réduites.
 */
export function KodeOrb({ size = 28, step = 'kode' }: { size?: number; step?: OrbStep | 'kode' }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  const breathe = useSharedValue(1);
  const fade = useSharedValue(1);
  const [pair, setPair] = useState<{ now: OrbStep | 'kode'; before: OrbStep | 'kode' }>({ now: step, before: step });

  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(360, { duration: 2800, easing: Easing.linear }), -1);
    breathe.value = withRepeat(withSequence(withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) })), -1);
  }, [reduced, spin, breathe]);

  useEffect(() => {
    setPair((p) => (p.now === step ? p : { now: step, before: p.now }));
    fade.value = 0;
    fade.value = withTiming(1, { duration: reduced ? 0 : 700, easing: Easing.out(Easing.quad) });
  }, [step, reduced, fade]);

  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const next = useAnimatedStyle(() => ({ opacity: fade.value }));
  const core = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));
  const inset = size * 0.22;

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, ring]}>
        <Ring colors={ORB[pair.before]} size={size} />
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, next]}>
          <Ring colors={ORB[pair.now]} size={size} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: inset, top: inset, right: inset, bottom: inset, borderRadius: size, backgroundColor: c['glass-strong'] }, core]} />
      <View style={{ position: 'absolute', left: size * 0.22, top: size * 0.08, width: size * 0.4, height: size * 0.26, borderRadius: size, backgroundColor: 'rgba(255,255,255,0.7)' }} />
    </View>
  );
}

function Ring({ colors, size }: { colors: [string, string, string]; size: number }) {
  const id = `orb${useId().replace(/[^0-9a-z]/gi, '')}`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="0.55" stopColor={colors[1]} />
          <Stop offset="1" stopColor={colors[2]} />
        </LinearGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
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
          <T v="caption" tone="ink2" style={{ fontFamily: 'Sans500' }}>
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
