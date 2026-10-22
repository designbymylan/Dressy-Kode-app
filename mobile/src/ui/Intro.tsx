import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { type } from '../theme/tokens';
import { Kodi, type KodiMood } from './Kodi';

/**
 * L'intro (13/10), une fois par lancement, la même que sur le web
 * (`web/src/components/Intro.tsx`) : le K se coud trait par trait,
 * l'étincelle de Kodi s'allume, une couture se pique, DRESSKODE se resserre ;
 * Kodi arrive alors en rebond sous la marque, déroule son auvent et fait
 * coucou (21/10), puis la caméra plonge dans le K et l'app apparaît derrière. Noir sur blanc
 * en clair, blanc sur noir en sombre. Un toucher la passe ; « Réduire les
 * animations » la réduit à un fondu.
 */
const AnimatedPath = Animated.createAnimatedComponent(Path);

const SIZE = 128;
const SPARK = 'M71 3C72 13 75 16 85 17C75 18 72 21 71 31C70 21 67 18 57 17C67 16 70 13 71 3Z';
// Longueur de chaque trait du K, pour le dessiner au pointillé qui avance.
const LEN = { stem: 72, up: 43.84, lo: 59.09 };
const END = 2900;
const SEAM_DASHES = Array.from({ length: 33 });
const BRAND_SPACING = type.brand.letterSpacing;

const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const out = Easing.bezier(0.33, 1, 0.68, 1);
const outExpo = Easing.bezier(0.22, 1, 0.36, 1);
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

  // 1 = au début, 0 = en place (pointillés) ; 0 → 1 pour le reste.
  const stem = useSharedValue(reduced ? 0 : 1);
  const up = useSharedValue(reduced ? 0 : 1);
  const lo = useSharedValue(reduced ? 0 : 1);
  const spark = useSharedValue(reduced ? 1 : 0);
  const glint = useSharedValue(reduced ? 1 : 0);
  const seam = useSharedValue(reduced ? 1 : 0);
  const word = useSharedValue(reduced ? 1 : 0);
  const push = useSharedValue(reduced ? 1 : 0);
  const zoom = useSharedValue(0);
  const tail = useSharedValue(0); // la couture et le mot s'effacent avant la plongée
  const curtain = useSharedValue(1);
  // Kodi arrive (0,75 s), puis fait coucou tant que l'intro dure.
  const [kodi, setKodi] = useState<KodiMood | null>(null);

  useEffect(() => {
    if (reduced) return;
    const a = setTimeout(() => setKodi('idle'), 750);
    const b = setTimeout(() => setKodi('wave'), 1300);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [reduced]);

  useEffect(() => {
    shown = true;
    if (reduced) {
      curtain.value = at(700, 0, 400);
      const t = setTimeout(onDone, 1150);
      return () => clearTimeout(t);
    }
    push.value = withTiming(1, { duration: 1900, easing: outExpo });
    stem.value = at(150, 0, 500, inOut);
    up.value = at(550, 0, 360);
    lo.value = at(620, 0, 420);
    spark.value = at(950, 1, 600, spring);
    glint.value = at(1050, 1, 700, outExpo);
    seam.value = at(1000, 1, 500, inOut);
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

  const stemProps = useAnimatedProps(() => ({ strokeDashoffset: stem.value * LEN.stem }));
  const upProps = useAnimatedProps(() => ({ strokeDashoffset: up.value * LEN.up }));
  const loProps = useAnimatedProps(() => ({ strokeDashoffset: lo.value * LEN.lo }));

  const curtainStyle = useAnimatedStyle(() => ({ opacity: curtain.value }));
  const stageStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.92 + 0.08 * push.value }] }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 41 * zoom.value }] }));
  const sparkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, spark.value * 1.8),
    transform: [{ scale: spark.value }, { rotate: `${(1 - spark.value) * -120}deg` }],
  }));
  const glintStyle = useAnimatedStyle(() => ({
    opacity: glint.value < 0.3 ? (glint.value / 0.3) * 0.45 : (1 - glint.value) / 0.7 * 0.45,
    transform: [{ scale: 0.4 + 2 * glint.value }],
  }));
  const seamStyle = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - tail.value), transform: [{ scaleX: seam.value }] }));
  const wordStyle = useAnimatedStyle(() => {
    const spacing = BRAND_SPACING + (1 - word.value) * BRAND_SPACING * 2;
    // L'espace après la dernière lettre est compensé à gauche : le mot reste centré.
    return { opacity: word.value * (1 - tail.value), letterSpacing: spacing, paddingLeft: spacing };
  });
  const kodiStyle = useAnimatedStyle(() => ({ opacity: 1 - tail.value }));

  const px = (n: number) => (n / 100) * SIZE;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.curtain, { backgroundColor: c.paper }, curtainStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Pressable style={styles.fill} onPress={skip} accessible={false}>
        <Animated.View style={[styles.stage, stageStyle]}>
          <Animated.View style={[styles.mark, markStyle]}>
            <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
              <Defs>
                <ClipPath id="intro-clip">
                  <Rect x="0" y="14" width="100" height="72" />
                </ClipPath>
              </Defs>
              <G clipPath="url(#intro-clip)" fill="none" stroke={c.ink} strokeWidth={6.5}>
                <AnimatedPath d="M30 86V14" strokeDasharray={[LEN.stem, LEN.stem]} animatedProps={stemProps} />
                <AnimatedPath d="M30 61L61 30" strokeDasharray={[LEN.up, LEN.up]} animatedProps={upProps} />
                <AnimatedPath d="M44 47L82.3 92" strokeDasharray={[LEN.lo, LEN.lo]} animatedProps={loProps} />
              </G>
            </Svg>
            <Animated.View
              style={[styles.glint, { left: px(57), top: px(3), width: px(28), height: px(28), borderColor: c.ink }, glintStyle]}
            />
            <Animated.View style={[styles.abs, { left: px(57), top: px(3) }, sparkStyle]}>
              <Svg width={px(28)} height={px(28)} viewBox="57 3 28 28">
                <Path d={SPARK} fill={c.ink} />
              </Svg>
            </Animated.View>
          </Animated.View>

          <Animated.View style={[styles.seam, seamStyle]}>
            {SEAM_DASHES.map((_, i) => (
              <View key={i} style={[styles.dash, { backgroundColor: c.ink }]} />
            ))}
          </Animated.View>

          <Animated.Text style={[type.brand, { color: c.ink }, wordStyle]}>DRESSKODE</Animated.Text>
          <Animated.View style={[styles.kodi, kodiStyle]}>{kodi && <Kodi mood={kodi} size={84} enter shadow decorative tap={false} />}</Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  curtain: { zIndex: 1000, elevation: 1000, overflow: 'hidden' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { alignItems: 'center', gap: 22 },
  mark: { width: SIZE, height: SIZE, transformOrigin: '62% 52%' },
  abs: { position: 'absolute' },
  glint: { position: 'absolute', borderWidth: 1, borderRadius: 999 },
  seam: { width: 132, height: 1, flexDirection: 'row', gap: 2, transformOrigin: 'left' },
  dash: { width: 2, height: 1 },
  kodi: { width: 84, height: 84 },
});
