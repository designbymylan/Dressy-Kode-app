import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { type } from '../theme/tokens';

/**
 * L'intro (25/10), une fois par lancement, la même que sur le web
 * (`web/src/components/Intro.tsx`) : l'orbe apparaît, son reflet fait le tour
 * de la sphère, DRESSKODE se resserre, puis la caméra plonge dans l'orbe et
 * l'app apparaît derrière. Le fond suit le thème. Un toucher la passe ;
 * « Réduire les animations » la réduit à un fondu.
 */
const SIZE = 128;
const END = 2900;
const BRAND_SPACING = type.brand.letterSpacing;
const ORBE = { from: '#b9adff', to: '#9fd0ff' };

const out = Easing.bezier(0.33, 1, 0.68, 1);
const outExpo = Easing.bezier(0.22, 1, 0.36, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const spring = Easing.bezier(0.34, 1.56, 0.64, 1);
const dive = Easing.bezier(0.7, 0, 0.84, 0);

const at = (delay: number, to: number, duration: number, easing = out) => withDelay(delay, withTiming(to, { duration, easing }));

let shown = false;

export function Intro() {
  const [on, setOn] = useState(!shown);
  if (!on) return null;
  return <Curtain onDone={() => setOn(false)} />;
}

function Curtain({ onDone }: { onDone: () => void }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();

  const orb = useSharedValue(reduced ? 1 : 0); // 0 = invisible, 1 = en place
  const spin = useSharedValue(0); // 0 → 1 : un tour du reflet
  const word = useSharedValue(reduced ? 1 : 0);
  const push = useSharedValue(reduced ? 1 : 0);
  const zoom = useSharedValue(0);
  const tail = useSharedValue(0); // le mot s'efface avant la plongée
  const curtain = useSharedValue(1);

  useEffect(() => {
    shown = true;
    if (reduced) {
      curtain.value = at(700, 0, 400);
      const t = setTimeout(onDone, 1150);
      return () => clearTimeout(t);
    }
    push.value = withTiming(1, { duration: 1900, easing: outExpo });
    orb.value = at(100, 1, 600, spring);
    spin.value = at(600, 1, 900, inOut);
    word.value = at(1100, 1, 750, outExpo);
    tail.value = at(1950, 1, 200);
    zoom.value = at(1950, 1, 700, dive);
    curtain.value = at(2250, 0, 450, Easing.bezier(0.4, 0, 0.2, 1));
    const t = setTimeout(onDone, END);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    curtain.value = withTiming(0, { duration: 250 });
    setTimeout(onDone, 260);
  };

  const curtainStyle = useAnimatedStyle(() => ({ opacity: curtain.value }));
  const stageStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.92 + 0.08 * push.value }] }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 41 * zoom.value }] }));
  const orbStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, orb.value * 1.6), transform: [{ scale: orb.value }] }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const wordStyle = useAnimatedStyle(() => {
    const spacing = BRAND_SPACING + (1 - word.value) * BRAND_SPACING * 2;
    // L'espace après la dernière lettre est compensé à gauche : le mot reste centré.
    return { opacity: word.value * (1 - tail.value), letterSpacing: spacing, paddingLeft: spacing };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.curtain, { backgroundColor: c.paper }, curtainStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Pressable style={styles.fill} onPress={skip} accessible={false}>
        <Animated.View style={[styles.stage, stageStyle]}>
          <Animated.View style={[styles.mark, markStyle]}>
            <Animated.View style={[styles.abs, orbStyle]}>
              <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
                <Defs>
                  <RadialGradient id="intro-orbe" cx="32%" cy="28%" r="85%">
                    <Stop offset="0%" stopColor={ORBE.from} />
                    <Stop offset="100%" stopColor={ORBE.to} />
                  </RadialGradient>
                </Defs>
                <Circle cx={50} cy={50} r={50} fill="url(#intro-orbe)" />
              </Svg>
              {/* Le reflet tourne ; le disque qui le rogne reste fixe. */}
              <View style={styles.disc} pointerEvents="none">
                <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
                  <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
                    <Ellipse cx={42} cy={21} rx={20} ry={13} fill="#ffffff" fillOpacity={0.7} />
                  </Svg>
                </Animated.View>
              </View>
            </Animated.View>
          </Animated.View>

          <Animated.Text style={[type.brand, { color: c.ink }, wordStyle]}>DRESSKODE</Animated.Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  curtain: { zIndex: 1000, elevation: 1000, overflow: 'hidden' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { alignItems: 'center', gap: 22 },
  mark: { width: SIZE, height: SIZE },
  abs: { position: 'absolute', left: 0, top: 0, width: SIZE, height: SIZE },
  disc: { position: 'absolute', left: 0, top: 0, width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden' },
});
