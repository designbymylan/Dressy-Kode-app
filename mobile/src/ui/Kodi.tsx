/**
 * Kodi, le styliste de Dresskode, en personne (21/10 ; web :
 * components/Kodi.tsx, mêmes tracés).
 *
 * Une petite boutique vivante : un auvent rayé bleu et blanc en guise de
 * chapeau, un crochet de cintre sur le dessus, un corps beurre et des yeux
 * chocopie. Sa bouche « porte de boutique » s'ouvre quand il est surpris ou
 * qu'il parle.
 *
 * Sur le mobile, chaque partie qui bouge (bras, crochet, auvent, yeux,
 * bouche, effets) est un calque : un `Animated.View` qui porte son propre
 * SVG dans la même grille de 100. Reanimated anime les vues, jamais les
 * tracés, ce qui reste fiable sur iPhone. Un point (x, y) de la grille est à
 * (x %, y %) du calque : c'est ce qui donne les centres de rotation.
 *
 * Ses couleurs ne suivent pas le thème : Kodi est le même en clair et en
 * sombre. « Réduire les animations » le fige dans sa pose.
 */
import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
  type WithTimingConfig,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { LightScope, useTheme } from '../theme/ThemeProvider';
import { motion } from '../theme/tokens';
import { haptic } from './Tap';

export type KodiMood = 'idle' | 'happy' | 'wave' | 'thinking' | 'surprised' | 'sleepy' | 'love' | 'sad' | 'celebrate' | 'listening' | 'wink' | 'talking' | 'shy';

export type KodiLook = 'center' | 'left' | 'right' | 'up' | 'down' | 'up-left';

const LOOK: Record<KodiLook, [number, number]> = {
  center: [0, 0],
  left: [-2.8, 0.4],
  right: [2.8, 0.4],
  up: [0.4, -2.6],
  down: [0, 2.4],
  'up-left': [-2.2, -2.2],
};

// Les couleurs de Kodi (palette du 21/10), fixes en clair comme en sombre.
const BUTTER = '#FEEFB8';
const CHOCO = '#432F2E';
const BLUE = '#C4DAE8';
const BLUSH = '#F4C9A8';

/** Réactions au toucher, jouées tour à tour. */
const REACTIONS: KodiMood[] = ['happy', 'wink', 'love', 'surprised', 'celebrate'];

const AWNING = 'M14 23a9 9 0 0 1 9-9h54a9 9 0 0 1 9 9v14a9 9 0 0 1-18 0 9 9 0 0 1-18 0 9 9 0 0 1-18 0 9 9 0 0 1-18 0Z';

function Eyes({ mood }: { mood: KodiMood }) {
  const arc = (x: number, up = true) => (
    <Path d={up ? `M${x - 5} 64 Q${x} 57 ${x + 5} 64` : `M${x - 5} 61.5 Q${x} 66 ${x + 5} 61.5`} fill="none" stroke={CHOCO} strokeWidth={3.4} strokeLinecap="round" />
  );
  const open = (x: number, rx = 4.6, ry = 6) => (
    <G>
      <Ellipse cx={x} cy={62} rx={rx} ry={ry} fill={CHOCO} />
      <Circle cx={x + 1.6} cy={62 - ry * 0.38} r={rx * 0.36} fill="#FFFFFF" />
    </G>
  );
  const heart = (x: number) => (
    <Path d={`M${x} 67.5c-.3 0-.6-.1-.8-.3-2.4-2-5.7-4.6-5.7-7.9a3.4 3.4 0 0 1 6.5-1.5 3.4 3.4 0 0 1 6.5 1.5c0 3.3-3.3 5.9-5.7 7.9-.2.2-.5.3-.8.3Z`} fill={CHOCO} />
  );
  switch (mood) {
    case 'happy':
    case 'celebrate':
      return <>{arc(39)}{arc(61)}</>;
    case 'wink':
      return <>{arc(39)}{open(61)}</>;
    case 'sleepy':
    case 'shy':
      return <>{arc(39, false)}{arc(61, false)}</>;
    case 'love':
      return <>{heart(39)}{heart(61)}</>;
    case 'surprised':
    case 'listening':
      return <>{open(39, 5.2, 7.2)}{open(61, 5.2, 7.2)}</>;
    case 'sad':
      return (
        <>
          {open(39, 4.2, 5.2)}
          {open(61, 4.2, 5.2)}
          <Path d="M33 54.5 43 51.5M67 54.5 57 51.5" stroke={CHOCO} strokeWidth={2.6} strokeLinecap="round" />
        </>
      );
    default:
      return <>{open(39)}{open(61)}</>;
  }
}

const LINE = { fill: 'none', stroke: CHOCO, strokeWidth: 3.2, strokeLinecap: 'round' as const };
const SMILE = <Path d="M44 75 Q50 81 56 75" {...LINE} />;
// La porte de boutique de l'icône d'origine, devenue bouche.
const DOOR = <Path d="M45.6 81.5V77a4.4 4.4 0 0 1 8.8 0v4.5Z" fill={CHOCO} />;

function Mouth({ mood }: { mood: KodiMood }) {
  switch (mood) {
    case 'happy':
    case 'celebrate':
    case 'love':
      return (
        <G>
          <Path d="M42.5 73.5Q50 86 57.5 73.5Z" fill={CHOCO} />
          <Ellipse cx="50" cy="79.6" rx="3.6" ry="1.9" fill={BLUSH} />
        </G>
      );
    case 'surprised':
      return DOOR;
    case 'thinking':
      return <Path d="M45.5 77.5 Q48 75.8 50.5 77.2 T55 76.4" {...LINE} />;
    case 'sleepy':
      return <Circle cx="50" cy="77.5" r="2.4" fill={CHOCO} />;
    case 'sad':
      return <Path d="M44 80 Q50 73.5 56 80" {...LINE} />;
    case 'wink':
      return <Path d="M44 75 Q51 81.5 57 73.5" {...LINE} />;
    case 'shy':
      return <Path d="M46.5 76.5 Q50 79.5 53.5 76.5" {...LINE} />;
    case 'listening':
      return <Ellipse cx="50" cy="77" rx="2.6" ry="2.2" fill={CHOCO} />;
    default:
      return SMILE;
  }
}

/** Un calque de Kodi : une vue de la taille de Kodi, son SVG dans la grille de 100. */
type AnimatedStyle = ComponentProps<typeof Animated.View>['style'];

function Layer({ size, style, children }: { size: number; style?: AnimatedStyle; children: ReactNode }) {
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {children}
      </Svg>
    </Animated.View>
  );
}

/** Une boucle de clés (t de 0 à 1, valeur), comme une @keyframes du web. */
function loop(keys: [number, number][], duration: number, easing: WithTimingConfig['easing'] = Easing.inOut(Easing.sin), times = -1) {
  const steps = keys.slice(1).map(([t, v], i) => withTiming(v, { duration: Math.max(1, (t - keys[i][0]) * duration), easing }));
  return withRepeat(withSequence(steps[0], ...steps.slice(1)), times, false);
}

/** Une seule fois : la même suite de clés. */
const once = (keys: [number, number][], duration: number, easing: WithTimingConfig['easing'] = motion.easing) => loop(keys, duration, easing, 1);

const SPRING = Easing.bezier(0.34, 1.56, 0.64, 1);

/** Les effets de Kodi : bulles de réflexion, « z », confettis, mains devant les yeux. */
function Effects({ mood, size, k, color, still }: { mood: KodiMood; size: number; k: number; color: string; still: boolean }) {
  if (mood === 'thinking') return <>{[0, 1, 2].map((i) => <ThinkDot key={i} i={i} size={size} k={k} color={color} still={still} />)}</>;
  if (mood === 'sleepy') return <>{[0, 1].map((i) => <Zed key={i} i={i} size={size} k={k} color={color} still={still} />)}</>;
  if (mood === 'celebrate') return <>{BITS.map((b, i) => <Bit key={i} i={i} bit={b} size={size} k={k} color={color} still={still} />)}</>;
  if (mood === 'shy') return <Hands size={size} k={k} still={still} />;
  return null;
}

function ThinkDot({ i, size, k, color, still }: { i: number; size: number; k: number; color: string; still: boolean }) {
  const p = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    p.value = withDelay(i * 160, loop([[0, 0], [0.4, 1], [1, 0]], 1200));
    return () => cancelAnimation(p);
  }, [p, i, still]);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * p.value, transform: [{ translateY: -3 * k * p.value }] }));
  return (
    <Layer size={size} style={style}>
      <Circle cx={80 + i * 7} cy={14 - i * 5} r={2.2 + i * 0.6} fill={color} />
    </Layer>
  );
}

function Zed({ i, size, k, color, still }: { i: number; size: number; k: number; color: string; still: boolean }) {
  const p = useSharedValue(still ? 0.3 : 0);
  useEffect(() => {
    if (still) return;
    p.value = withDelay(i * 1100, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(p);
  }, [p, i, still]);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7,
      transform: [{ translateX: 10 * k * t }, { translateY: -22 * k * t }, { scale: 0.6 + 0.5 * t }],
      transformOrigin: `${80 + i * 4}% 22%`,
    };
  });
  return (
    <Layer size={size} style={style}>
      <SvgText x={80 + i * 4} y={24} fontSize={11 - i * 2} fontWeight="800" fill={color}>
        z
      </SvgText>
    </Layer>
  );
}

const BITS: [number, number, string | null][] = [
  [-34, -38, BLUE], [30, -44, BUTTER], [-44, -6, BUTTER], [42, -12, BLUE],
  [-22, -52, null], [16, -56, BLUE], [-48, -30, BLUE], [46, -34, null],
];

function Bit({ i, bit: [x, y, fill], size, k, color, still }: { i: number; bit: [number, number, string | null]; size: number; k: number; color: string; still: boolean }) {
  const p = useSharedValue(still ? 0.6 : 0);
  useEffect(() => {
    if (still) return;
    p.value = withDelay(i * 90, withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(p);
  }, [p, i, still]);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85,
      transform: [{ translateX: x * k * t }, { translateY: y * k * t }, { rotate: `${220 * t}deg` }],
      transformOrigin: '50% 42%',
    };
  });
  return (
    <Layer size={size} style={style}>
      <Rect x="48" y="40" width={i % 2 ? 4 : 5} height={i % 2 ? 6 : 5} rx="1.2" fill={fill ?? color} />
    </Layer>
  );
}

function Hands({ size, k, still }: { size: number; k: number; still: boolean }) {
  const p = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (!still) p.value = withTiming(1, { duration: 420, easing: SPRING });
  }, [p, still]);
  const style = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: 7 * k * (1 - p.value) }] }));
  return (
    <Layer size={size} style={style}>
      {[37, 63].map((x) => (
        <Ellipse key={x} cx={x} cy="62" rx="9" ry="7.4" fill={BUTTER} stroke={CHOCO} strokeWidth="3.2" />
      ))}
    </Layer>
  );
}

/** La bouche qui parle : le sourire et la porte, tour à tour. */
function TalkingMouth({ size }: { size: number }) {
  const a = useSharedValue(1);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    a.value = withRepeat(withSequence(withDelay(190, withTiming(0, { duration: 0 })), withDelay(190, withTiming(1, { duration: 0 }))), -1, false);
    return () => cancelAnimation(a);
  }, [a, reduced]);
  const smile = useAnimatedStyle(() => ({ opacity: a.value }));
  const door = useAnimatedStyle(() => ({ opacity: 1 - a.value }));
  return (
    <>
      <Layer size={size} style={smile}>{SMILE}</Layer>
      <Layer size={size} style={door}>{DOOR}</Layer>
    </>
  );
}

const set = (v: SharedValue<number>, to: number, d = 260) => {
  cancelAnimation(v);
  v.value = withTiming(to, { duration: d, easing: motion.easing });
};

export function Kodi({
  mood = 'idle',
  size = 96,
  track = false,
  look,
  tap = true,
  enter = false,
  shadow = false,
  label = 'Kodi',
  decorative = false,
  color,
  style,
}: {
  mood?: KodiMood;
  size?: number;
  /** Kodi jette un œil autour de lui de temps en temps (sur le web, ses yeux suivent la souris). */
  track?: boolean;
  /** Regard imposé, prioritaire. */
  look?: KodiLook;
  /** Un toucher le fait réagir. */
  tap?: boolean;
  /** Arrivée en rebond et auvent qui se déroule. */
  enter?: boolean;
  shadow?: boolean;
  label?: string;
  /** Dans un bouton déjà nommé : masqué aux lecteurs d'écran. */
  decorative?: boolean;
  /** Couleur des effets et de l'ombre (l'encre du thème par défaut). */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const ink = color ?? c.ink;
  const reduced = useReducedMotion();
  const k = size / 100;
  const clip = `kodi${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [reaction, setReaction] = useState<KodiMood | null>(null);
  const turn = useRef(0);
  const shown = reaction ?? mood;

  // Les valeurs animées : la silhouette entière, le corps, chaque partie.
  const allY = useSharedValue(0);
  const allR = useSharedValue(0);
  const allSX = useSharedValue(1);
  const allSY = useSharedValue(1);
  const tapSX = useSharedValue(1);
  const tapSY = useSharedValue(1);
  const inP = useSharedValue(enter && !reduced ? 0 : 1);
  const unroll = useSharedValue(enter && !reduced ? 0 : 1);
  const bodySX = useSharedValue(1);
  const bodySY = useSharedValue(1);
  const armL = useSharedValue(0);
  const armR = useSharedValue(0);
  const arms = useSharedValue(1);
  const hook = useSharedValue(0);
  const awning = useSharedValue(0);
  const blink = useSharedValue(1);
  const heart = useSharedValue(1);
  const lookX = useSharedValue(0);
  const lookY = useSharedValue(0);

  // Arrivée : il monte en rebond, l'auvent se déroule.
  useEffect(() => {
    if (!enter || reduced) return;
    inP.value = withTiming(1, { duration: 820, easing: SPRING });
    unroll.value = withDelay(260, withTiming(1, { duration: 620, easing: SPRING }));
  }, [enter, reduced, inP, unroll]);

  // Ce qui ne s'arrête jamais : il respire et cligne des yeux.
  useEffect(() => {
    if (reduced) return;
    const slow = shown === 'sleepy' ? 5000 : 3400;
    bodySX.value = loop([[0, 1], [0.5, 1.012], [1, 1]], slow);
    bodySY.value = loop([[0, 1], [0.5, 1.03], [1, 1]], slow);
    return () => {
      cancelAnimation(bodySX);
      cancelAnimation(bodySY);
    };
  }, [reduced, shown === 'sleepy', bodySX, bodySY]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (reduced) return;
    blink.value = withDelay(Math.random() * 4000, loop([[0, 1], [0.93, 1], [0.95, 0.1], [0.97, 1], [1, 1]], 4800, Easing.linear));
    return () => cancelAnimation(blink);
  }, [reduced, blink]);

  // L'humeur : chaque partie prend son mouvement, ou revient au repos.
  useEffect(() => {
    for (const v of [allY, allR, armL, armR, hook, awning]) set(v, 0);
    for (const v of [allSX, allSY, heart, arms]) set(v, 1);
    if (shown === 'shy') set(arms, 0, 200);
    if (shown === 'listening') {
      cancelAnimation(allR);
      allR.value = withTiming(-7, { duration: 420, easing: SPRING });
    }
    if (reduced) return;
    switch (shown) {
      case 'happy':
      case 'love':
        allY.value = loop([[0, 0], [0.18, 0], [0.45, -8.1], [0.7, 0], [1, 0]], 1100, motion.easing);
        allSX.value = loop([[0, 1], [0.18, 1.06], [0.45, 0.96], [0.7, 1.04], [1, 1]], 1100, motion.easing);
        allSY.value = loop([[0, 1], [0.18, 0.92], [0.45, 1.05], [0.7, 0.96], [1, 1]], 1100, motion.easing);
        break;
      case 'celebrate':
      case 'surprised': {
        const n = shown === 'surprised' ? 1 : -1;
        allY.value = loop([[0, 0], [0.15, 0], [0.4, -14.4], [0.62, 0], [0.8, -2.7], [1, 0]], 1000, motion.easing, n);
        allSX.value = loop([[0, 1], [0.15, 1.1], [0.4, 0.94], [0.62, 1.08], [0.8, 1], [1, 1]], 1000, motion.easing, n);
        allSY.value = loop([[0, 1], [0.15, 0.88], [0.4, 1.08], [0.62, 0.92], [0.8, 1], [1, 1]], 1000, motion.easing, n);
        break;
      }
      case 'wave':
        armR.value = loop([[0, 0], [0.2, -50], [0.4, -20], [0.6, -50], [0.8, -20], [1, 0]], 1600);
        allR.value = loop([[0, 0], [0.5, -5], [1, 0]], 1600);
        break;
      case 'thinking':
        awning.value = withSequence(withTiming(-4, { duration: 300 }), loop([[0, -4], [0.5, 4], [1, -4]], 2400));
        hook.value = withSequence(withTiming(-4, { duration: 300 }), loop([[0, -4], [0.5, 4], [1, -4]], 2400));
        break;
      case 'sad':
        allY.value = loop([[0, 1.8], [0.5, 2.7], [1, 1.8]], 3000);
        allSX.value = loop([[0, 1.02], [0.5, 1.03], [1, 1.02]], 3000);
        allSY.value = loop([[0, 0.97], [0.5, 0.95], [1, 0.97]], 3000);
        break;
    }
    if (shown === 'happy' || shown === 'celebrate' || shown === 'wave') hook.value = loop([[0, 0], [0.3, -18], [0.65, 12], [1, 0]], 1100);
    if (shown === 'celebrate') {
      armL.value = loop([[0, 0], [0.5, 70], [1, 0]], 500);
      armR.value = loop([[0, 0], [0.5, -70], [1, 0]], 500);
    }
    if (shown === 'love') heart.value = loop([[0, 1], [0.4, 1.25], [1, 1]], 900);
  }, [shown, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // Le regard : imposé, ou qui fait le tour de temps en temps.
  useEffect(() => {
    const to = ([x, y]: [number, number]) => {
      lookX.value = withTiming(x, { duration: 260, easing: motion.easing });
      lookY.value = withTiming(y, { duration: 260, easing: motion.easing });
    };
    if (look) return to(LOOK[look]);
    to(LOOK.center);
    if (!track || reduced) return;
    const glances: KodiLook[] = ['center', 'left', 'right', 'up', 'center', 'down'];
    let g = 0;
    const timer = setInterval(() => {
      g = (g + 1) % glances.length;
      to(LOOK[glances[g]]);
    }, 2600);
    return () => clearInterval(timer);
  }, [look, track, reduced, lookX, lookY]);

  // Une réaction ne dure qu'un instant, puis l'humeur du moment revient.
  useEffect(() => {
    if (!reaction) return;
    const t = setTimeout(() => setReaction(null), 1400);
    return () => clearTimeout(t);
  }, [reaction]);

  const poke = () => {
    if (!reduced) {
      tapSX.value = once([[0, 1], [0.25, 1.14], [0.55, 0.92], [0.8, 1.03], [1, 1]], 560);
      tapSY.value = once([[0, 1], [0.25, 0.84], [0.55, 1.1], [0.8, 0.98], [1, 1]], 560);
    }
    setReaction(REACTIONS[turn.current++ % REACTIONS.length]);
    haptic('light');
  };

  const enterStyle = useAnimatedStyle(() => {
    const t = inP.value;
    return { opacity: Math.min(1, t * 1.6), transform: [{ translateY: 27 * k * (1 - t) }, { scale: 0.5 + 0.5 * t }] };
  });
  const tapStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: tapSX.value }, { scaleY: tapSY.value }] }));
  const allStyle = useAnimatedStyle(() => ({ transform: [{ translateY: allY.value * k }, { rotate: `${allR.value}deg` }, { scaleX: allSX.value }, { scaleY: allSY.value }] }));
  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: bodySX.value }, { scaleY: bodySY.value }] }));
  const armLStyle = useAnimatedStyle(() => ({ opacity: arms.value, transform: [{ rotate: `${armL.value}deg` }] }));
  const armRStyle = useAnimatedStyle(() => ({ opacity: arms.value, transform: [{ rotate: `${armR.value}deg` }] }));
  const hookStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${hook.value}deg` }] }));
  const awningStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${awning.value}deg` }, { scaleY: unroll.value }] }));
  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: heart.value }, { scaleY: blink.value * heart.value }] }));
  const lookStyle = useAnimatedStyle(() => ({ transform: [{ translateX: lookX.value * k }, { translateY: lookY.value * k }] }));

  const full = { position: 'absolute' as const, left: 0, top: 0, width: size, height: size };
  const stripes = Array.from({ length: 8 }, (_, i) => i);

  const body = (
    <Animated.View style={[{ width: size, height: size }, enterStyle]}>
      {shadow && (
        <Layer size={size}>
          <Ellipse cx="50" cy="96" rx="25" ry="3.6" fill={ink} opacity={0.1} />
        </Layer>
      )}
      <Animated.View style={[full, { transformOrigin: '50% 93%' }, tapStyle]}>
        <Animated.View style={[full, { transformOrigin: '50% 93%' }, allStyle]}>
          <Animated.View style={[full, { transformOrigin: '50% 93%' }, bodyStyle]}>
            {/* bras, derrière le corps */}
            <Layer size={size} style={[{ transformOrigin: '21% 65%' }, armLStyle]}>
              <Ellipse cx="14.5" cy="71" rx="5.6" ry="8.6" transform="rotate(24 14.5 71)" fill={BUTTER} stroke={CHOCO} strokeWidth="3.2" />
            </Layer>
            <Layer size={size} style={[{ transformOrigin: '79% 65%' }, armRStyle]}>
              <Ellipse cx="85.5" cy="71" rx="5.6" ry="8.6" transform="rotate(-24 85.5 71)" fill={BUTTER} stroke={CHOCO} strokeWidth="3.2" />
            </Layer>
            {/* corps et joues */}
            <Layer size={size}>
              <Rect x="18" y="33" width="64" height="60" rx="25" fill={BUTTER} stroke={CHOCO} strokeWidth="3.2" />
              <Ellipse cx="28.5" cy="73" rx="5.4" ry="3.2" fill={BLUSH} opacity={0.85} />
              <Ellipse cx="71.5" cy="73" rx="5.4" ry="3.2" fill={BLUSH} opacity={0.85} />
            </Layer>
            {/* crochet de cintre */}
            <Layer size={size} style={[{ transformOrigin: '50% 15%' }, hookStyle]}>
              <Path d="M50 15V10.6a4.6 4.6 0 1 0-4.6-4.6" fill="none" stroke={CHOCO} strokeWidth="3.2" strokeLinecap="round" />
            </Layer>
            {/* auvent rayé */}
            <Layer size={size} style={[{ transformOrigin: '50% 14%' }, awningStyle]}>
              <Defs>
                <ClipPath id={clip}>
                  <Path d={AWNING} />
                </ClipPath>
              </Defs>
              <G clipPath={`url(#${clip})`}>
                {stripes.map((i) => (
                  <Rect key={i} x={14 + i * 9} y="12" width="9" height="40" fill={i % 2 ? '#FFFFFF' : BLUE} />
                ))}
              </G>
              <Path d={AWNING} fill="none" stroke={CHOCO} strokeWidth="3.2" strokeLinejoin="round" />
            </Layer>
            {/* visage */}
            <Animated.View style={[full, { transformOrigin: '50% 62%' }, eyesStyle]}>
              <Animated.View style={[full, lookStyle]}>
                <Layer size={size}>
                  <Eyes mood={shown} />
                </Layer>
              </Animated.View>
            </Animated.View>
            {shown === 'talking' ? (
              <TalkingMouth size={size} />
            ) : (
              <Layer size={size}>
                <Mouth mood={shown} />
              </Layer>
            )}
          </Animated.View>
          <Effects mood={shown} size={size} k={k} color={ink} still={reduced} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );

  const a11y = decorative
    ? ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const)
    : ({ accessible: true, accessibilityRole: 'image', accessibilityLabel: label } as const);

  if (!tap)
    return (
      <View pointerEvents="none" style={[{ width: size, height: size }, style]} {...a11y}>
        {body}
      </View>
    );
  return (
    <Pressable onPress={poke} style={[{ width: size, height: size }, style]} {...a11y} accessibilityHint={decorative ? undefined : 'Le faire réagir'}>
      {body}
    </Pressable>
  );
}

/** Kodi qui parle : la mascotte et sa bulle beurre, texte noir en clair comme en sombre. */
export function KodiSay({ mood = 'idle', size = 52, children, track, style }: { mood?: KodiMood; size?: number; children: ReactNode; track?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }, style]}>
      <Kodi mood={mood} size={size} track={track} />
      <LightScope style={{ flex: 1, backgroundColor: c.butter, borderRadius: 20, borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 11 }}>{children}</LightScope>
    </View>
  );
}
