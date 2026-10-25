import { useEffect, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import type { OrbStep } from '../state/jobs';

/**
 * L'orbe de Kodi (25/10, même dessin que le web, components/Orb.tsx) : une
 * sphère qui tourne, dont la couleur dit l'étape (lavande quand il repère,
 * pêche quand il dessine, ciel quand il compare, menthe quand il range).
 * C'est le seul visage de Kodi qui reste : dans la barre de navigation, et
 * partout où Kodi travaille (`KodeThinking`). La mascotte (ses humeurs, ses
 * bras, ses yeux) a été abandonnée ce jour-là.
 */
const STEP_COLORS: Record<OrbStep, [string, string]> = {
  look: ['#b9adff', '#9fd0ff'],
  draw: ['#ffb89c', '#ffd6e5'],
  check: ['#9fd0ff', '#cfe6ff'],
  store: ['#9fe3c3', '#d4f3e4'],
};

let orbUid = 0;

export function Orb({ size = 44, step, style }: { size?: number; step?: OrbStep; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const gradId = useRef(`orb-grad-${++orbUid}`).current;
  const spin = useSharedValue(0);
  const breathe = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(360, { duration: 2800, easing: Easing.linear }), -1);
    breathe.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [reduced, spin, breathe]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));

  const [c1, c2] = step ? STEP_COLORS[step] : STEP_COLORS.look;
  const inner = size * 0.56;

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[{ width: size, height: size }, spinStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={gradId} cx="32%" cy="28%" r="85%">
              <Stop offset="0%" stopColor={c1} />
              <Stop offset="100%" stopColor={c2} />
            </RadialGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2 - 0.5} fill={`url(#${gradId})`} />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          { position: 'absolute', width: inner, height: inner, borderRadius: inner / 2, backgroundColor: c['glass-strong'] },
          breatheStyle,
        ]}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.22,
          top: size * 0.08,
          width: size * 0.4,
          height: size * 0.26,
          borderRadius: size * 0.13,
          backgroundColor: 'rgba(255,255,255,0.7)',
        }}
      />
    </View>
  );
}
