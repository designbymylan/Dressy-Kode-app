import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Circle, Defs, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { haptic } from './Tap';
import { T } from './T';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Kodi, le styliste de Dresskode, en personne (refonte du 21/10, même dessin
 * que web/src/components/Kodi.tsx).
 *
 * Une petite boutique vivante : un auvent rayé en guise de chapeau, un
 * crochet de cintre sur le dessus, un corps beurre et des yeux chocopie. Sa
 * bouche « porte de boutique » s'ouvre quand il est surpris ou qu'il parle.
 *
 * Le corps bouge par Reanimated (rebond, saut, balancement, respiration) ;
 * les yeux clignent et regardent autour d'eux ; un toucher le fait réagir.
 * « Réduire les animations » le laisse immobile.
 */

export type KodiMood =
  | 'idle'
  | 'happy'
  | 'wave'
  | 'thinking'
  | 'surprised'
  | 'sleepy'
  | 'love'
  | 'sad'
  | 'celebrate'
  | 'listening'
  | 'wink'
  | 'talking'
  | 'shy';

// Couleurs propres au personnage : elles ne suivent pas le thème (charte du 21/10).
const BUTTER = '#FEEFB8';
const CHOCO = '#432F2E';
const BLUE = '#C4DAE8';
const BLUSH = '#F4C9A8';

const LOOKS: [number, number][] = [[0, 0], [-2.8, 0.4], [2.8, 0.4], [0.4, -2.6], [0, 0], [0, 2.4]];
const REACTIONS: KodiMood[] = ['happy', 'wink', 'love', 'surprised', 'celebrate'];
const AWNING = 'M14 23a9 9 0 0 1 9-9h54a9 9 0 0 1 9 9v14a9 9 0 0 1-18 0 9 9 0 0 1-18 0 9 9 0 0 1-18 0 9 9 0 0 1-18 0Z';

let uid = 0;

function Eyes({ mood, blink }: { mood: KodiMood; blink: boolean }) {
  const arc = (x: number, up = true) => (
    <Path
      key={`a${x}`}
      d={up ? `M${x - 5} 64 Q${x} 57 ${x + 5} 64` : `M${x - 5} 61.5 Q${x} 66 ${x + 5} 61.5`}
      fill="none"
      stroke={CHOCO}
      strokeWidth={3.4}
      strokeLinecap="round"
    />
  );
  const open = (x: number, rx = 4.6, ry = 6) =>
    blink ? (
      <Path key={`b${x}`} d={`M${x - 4.6} 62.5 L${x + 4.6} 62.5`} stroke={CHOCO} strokeWidth={3} strokeLinecap="round" />
    ) : (
      <G key={`o${x}`}>
        <Ellipse cx={x} cy={62} rx={rx} ry={ry} fill={CHOCO} />
        <Circle cx={x + 1.6} cy={62 - ry * 0.38} r={rx * 0.36} fill="#FFFFFF" />
      </G>
    );
  const heart = (x: number) => (
    <Path
      key={`h${x}`}
      d={`M${x} 67.5c-.3 0-.6-.1-.8-.3-2.4-2-5.7-4.6-5.7-7.9a3.4 3.4 0 0 1 6.5-1.5 3.4 3.4 0 0 1 6.5 1.5c0 3.3-3.3 5.9-5.7 7.9-.2.2-.5.3-.8.3Z`}
      fill={CHOCO}
    />
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

function Mouth({ mood, beat }: { mood: KodiMood; beat: number }) {
  const line = { fill: 'none', stroke: CHOCO, strokeWidth: 3.2, strokeLinecap: 'round' as const };
  const smile = <Path d="M44 75 Q50 81 56 75" {...line} />;
  const door = <Path d="M45.6 81.5V77a4.4 4.4 0 0 1 8.8 0v4.5Z" fill={CHOCO} />;
  switch (mood) {
    case 'happy':
    case 'celebrate':
    case 'love':
      return (
        <G>
          <Path d="M42.5 73.5Q50 86 57.5 73.5Z" fill={CHOCO} />
          <Ellipse cx={50} cy={79.6} rx={3.6} ry={1.9} fill={BLUSH} />
        </G>
      );
    case 'surprised':
      return door;
    case 'thinking':
      return <Path d="M45.5 77.5 Q48 75.8 50.5 77.2 T55 76.4" {...line} />;
    case 'sleepy':
      return <Circle cx={50} cy={77.5} r={2.4} fill={CHOCO} />;
    case 'sad':
      return <Path d="M44 80 Q50 73.5 56 80" {...line} />;
    case 'wink':
      return <Path d="M44 75 Q51 81.5 57 73.5" {...line} />;
    case 'shy':
      return <Path d="M46.5 76.5 Q50 79.5 53.5 76.5" {...line} />;
    case 'listening':
      return <Ellipse cx={50} cy={77} rx={2.6} ry={2.2} fill={CHOCO} />;
    case 'talking':
      return beat % 2 ? door : smile;
    default:
      return smile;
  }
}

function Effects({ mood, beat, ink }: { mood: KodiMood; beat: number; ink: string }) {
  if (mood === 'shy') {
    return (
      <G>
        {[37, 63].map((x) => (
          <Ellipse key={x} cx={x} cy={62} rx={9} ry={7.4} fill={BUTTER} stroke={CHOCO} strokeWidth={3.2} />
        ))}
      </G>
    );
  }
  if (mood === 'thinking') {
    return (
      <G>
        {[0, 1, 2].map((i) => (
          <Circle key={i} cx={80 + i * 7} cy={14 - i * 5 - (beat % 3 === i ? 2 : 0)} r={2.2 + i * 0.6} fill={ink} opacity={beat % 3 === i ? 1 : 0.3} />
        ))}
      </G>
    );
  }
  if (mood === 'sleepy') {
    return (
      <G>
        {[0, 1].map((i) => (
          <SvgText key={i} x={80 + i * 4 + (beat % 2) * 2} y={24 - (beat % 2) * 3} fontSize={11 - i * 2} fontWeight="800" fill={ink} opacity={0.4 + 0.3 * ((beat + i) % 2)}>
            z
          </SvgText>
        ))}
      </G>
    );
  }
  if (mood === 'celebrate') {
    const bits: [number, number, string][] = [[-34, -38, BLUE], [30, -44, BUTTER], [-44, -6, BUTTER], [42, -12, BLUE], [-22, -52, ink], [16, -56, BLUE], [-48, -30, BLUE], [46, -34, ink]];
    const k = 0.45 + (beat % 3) * 0.25;
    return (
      <G>
        {bits.map(([x, y, col], i) => (
          <Rect key={i} x={48 + x * k} y={40 + y * k} width={i % 2 ? 4 : 5} height={i % 2 ? 6 : 5} rx={1.2} fill={col} opacity={1 - k * 0.5} />
        ))}
      </G>
    );
  }
  return null;
}

type Props = {
  mood?: KodiMood;
  size?: number;
  /** Les yeux regardent autour d'eux de temps en temps. */
  track?: boolean;
  /** Un toucher le fait réagir. */
  tap?: boolean;
  /** Arrivée en rebond. */
  enter?: boolean;
  shadow?: boolean;
  label?: string;
  /** Dans un bouton déjà nommé : masqué aux lecteurs d'écran. */
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Kodi({ mood = 'idle', size = 96, track = false, tap = true, enter = false, shadow = false, label = 'Kodi', decorative = false, style, testID }: Props) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const clip = useRef(`kodi-awning-${++uid}`).current;
  const [reaction, setReaction] = useState<KodiMood | null>(null);
  const [blink, setBlink] = useState(false);
  const [look, setLook] = useState(0);
  const [beat, setBeat] = useState(0);
  const turn = useRef(0);
  const shown = reaction ?? mood;

  const y = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const rot = useSharedValue(0);
  const appear = useSharedValue(enter && !reduced ? 0 : 1);

  // Le clignement, chacun à son rythme.
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 4200 + (uid % 7) * 300);
    return () => clearInterval(t);
  }, [reduced]);

  // Le regard qui se promène.
  useEffect(() => {
    if (!track || reduced) return;
    const t = setInterval(() => setLook((g) => (g + 1) % LOOKS.length), 2600);
    return () => clearInterval(t);
  }, [track, reduced]);

  // Le petit temps des effets (points, z, confettis, bouche qui parle).
  const ticking = shown === 'thinking' || shown === 'sleepy' || shown === 'celebrate' || shown === 'talking' || shown === 'wave';
  useEffect(() => {
    if (!ticking || reduced) return;
    const t = setInterval(() => setBeat((b) => b + 1), shown === 'talking' ? 380 : 420);
    return () => clearInterval(t);
  }, [ticking, shown, reduced]);

  useEffect(() => {
    if (enter && !reduced) appear.value = withSpring(1, { damping: 11, stiffness: 160 });
  }, [enter, reduced, appear]);

  // Le corps, selon l'humeur.
  useEffect(() => {
    cancelAnimation(y);
    cancelAnimation(sx);
    cancelAnimation(sy);
    cancelAnimation(rot);
    y.value = 0;
    sx.value = 1;
    sy.value = 1;
    rot.value = shown === 'listening' ? -7 : 0;
    if (reduced) return;
    const ease = Easing.inOut(Easing.quad);
    switch (shown) {
      case 'happy':
      case 'love':
        y.value = withRepeat(withSequence(withTiming(0, { duration: 200 }), withTiming(-0.09 * size, { duration: 300, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) })), -1);
        break;
      case 'celebrate':
      case 'surprised':
        y.value = withRepeat(withSequence(withTiming(-0.16 * size, { duration: 380, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) })), shown === 'surprised' ? 1 : -1);
        break;
      case 'wave':
        rot.value = withRepeat(withSequence(withTiming(-5, { duration: 800, easing: ease }), withTiming(0, { duration: 800, easing: ease })), -1);
        break;
      case 'sad':
        y.value = withRepeat(withSequence(withTiming(0.03 * size, { duration: 1500, easing: ease }), withTiming(0.02 * size, { duration: 1500, easing: ease })), -1);
        break;
      default:
        // La respiration.
        sy.value = withRepeat(withSequence(withTiming(1.03, { duration: shown === 'sleepy' ? 2500 : 1700, easing: ease }), withTiming(1, { duration: shown === 'sleepy' ? 2500 : 1700, easing: ease })), -1);
    }
  }, [shown, reduced, size, y, sx, sy, rot]);

  // Une réaction ne dure qu'un instant.
  useEffect(() => {
    if (!reaction) return;
    const t = setTimeout(() => setReaction(null), 1400);
    return () => clearTimeout(t);
  }, [reaction]);

  function poke() {
    if (!reduced) {
      sx.value = withSequence(withTiming(1.14, { duration: 120 }), withSpring(1, { damping: 8, stiffness: 260 }));
      sy.value = withSequence(withTiming(0.84, { duration: 120 }), withSpring(1, { damping: 8, stiffness: 260 }));
    }
    setReaction(REACTIONS[turn.current++ % REACTIONS.length]);
    haptic('light');
  }

  const body = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [
      { translateY: y.value + (1 - appear.value) * size * 0.3 },
      { rotate: `${rot.value}deg` },
      { scaleX: sx.value * (0.5 + appear.value * 0.5) },
      { scaleY: sy.value * (0.5 + appear.value * 0.5) },
    ],
  }));

  const [lx, ly] = track ? LOOKS[look] : [0, 0];
  const armUp = shown === 'celebrate' ? (beat % 2 ? 60 : 30) : 0;
  const wave = shown === 'wave' ? (beat % 2 ? -50 : -20) : 0;
  const stripes = Array.from({ length: 8 }, (_, i) => i);

  const art = (
    <Animated.View style={[{ width: size, height: size }, body]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
        <Defs>
          <ClipPath id={clip}>
            <Path d={AWNING} />
          </ClipPath>
        </Defs>
        {shadow ? <Ellipse cx={50} cy={96} rx={25} ry={3.6} fill={c.ink} opacity={0.1} /> : null}
        {shown !== 'shy' && (
          <>
            <G rotation={-armUp} origin="20, 64">
              <Ellipse cx={14.5} cy={71} rx={5.6} ry={8.6} rotation={24} origin="14.5, 71" fill={BUTTER} stroke={CHOCO} strokeWidth={3.2} />
            </G>
            <G rotation={armUp + wave} origin="80, 64">
              <Ellipse cx={85.5} cy={71} rx={5.6} ry={8.6} rotation={-24} origin="85.5, 71" fill={BUTTER} stroke={CHOCO} strokeWidth={3.2} />
            </G>
          </>
        )}
        <Rect x={18} y={33} width={64} height={60} rx={25} fill={BUTTER} stroke={CHOCO} strokeWidth={3.2} />
        <Path d="M50 15V10.6a4.6 4.6 0 1 0-4.6-4.6" fill="none" stroke={CHOCO} strokeWidth={3.2} strokeLinecap="round" />
        <G clipPath={`url(#${clip})`}>
          {stripes.map((i) => (
            <Rect key={i} x={14 + i * 9} y={12} width={9} height={40} fill={i % 2 ? '#FFFFFF' : BLUE} />
          ))}
        </G>
        <Path d={AWNING} fill="none" stroke={CHOCO} strokeWidth={3.2} strokeLinejoin="round" />
        <Ellipse cx={28.5} cy={73} rx={5.4} ry={3.2} fill={BLUSH} opacity={0.85} />
        <Ellipse cx={71.5} cy={73} rx={5.4} ry={3.2} fill={BLUSH} opacity={0.85} />
        <G x={lx} y={ly}>
          <Eyes mood={shown} blink={blink} />
        </G>
        <Mouth mood={shown} beat={beat} />
        <Effects mood={shown} beat={beat} ink={c.ink} />
      </Svg>
    </Animated.View>
  );

  if (!tap) {
    return (
      <View testID={testID} style={style} accessible={!decorative} accessibilityRole={decorative ? undefined : 'image'} accessibilityLabel={decorative ? undefined : label} importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}>
        {art}
      </View>
    );
  }
  return (
    <Pressable testID={testID} onPress={poke} style={style} accessibilityRole="image" accessibilityLabel={label} accessibilityHint="Touche-le pour le faire réagir">
      {art}
    </Pressable>
  );
}

/** Kodi qui parle : la mascotte et sa bulle beurre. */
export function KodiSay({ mood = 'idle', size = 52, children, track, style }: { mood?: KodiMood; size?: number; children: ReactNode; track?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }, style]}>
      <Kodi mood={mood} size={size} track={track} />
      <View style={{ flex: 1, backgroundColor: c.butter, borderRadius: 22, borderBottomLeftRadius: 6, paddingHorizontal: 16, paddingVertical: 12 }}>
        <T v="body" style={{ color: c['butter-ink'] }}>
          {children}
        </T>
      </View>
    </View>
  );
}
