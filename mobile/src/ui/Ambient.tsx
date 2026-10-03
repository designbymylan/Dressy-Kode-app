import { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import type { Weather } from '../data/wardrobe';
import type { ColorName } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useScreen } from './screen';

/**
 * L'ambiance de la direction « vitrine de verre » : quatre halos pastel
 * (pêche, lavande, ciel, rose poudré) qui dérivent très lentement derrière
 * l'écran, comme le calque `.ambient` du web. Des dégradés radiaux plutôt
 * qu'un flou : même douceur, sans coût de rendu. Figés si les animations
 * sont réduites.
 */
const HALOS = [
  { key: 'halo-1', x: 0.1, y: 0.72, duration: 26000, delay: 0 },
  { key: 'halo-2', x: 0.95, y: 0.2, duration: 31000, delay: 8000 },
  { key: 'halo-3', x: 0.45, y: -0.02, duration: 35000, delay: 15000 },
  { key: 'halo-4', x: 0.78, y: 1.02, duration: 29000, delay: 4000 },
] as const;

/**
 * La météo dans les halos (accueil) : chauds et vifs au soleil, plus froids
 * et lents sous la pluie, presque blancs sous un ciel couvert. On sent le
 * temps qu'il fait avant de le lire.
 */
const WEATHER_HALOS: Record<Weather['kind'], { tone: 'sun' | 'rain' | 'cloud'; pace: number }> = {
  soleil: { tone: 'sun', pace: 0.75 },
  averses: { tone: 'rain', pace: 1.4 },
  pluie: { tone: 'rain', pace: 1.4 },
  nuages: { tone: 'cloud', pace: 1.6 },
};

export function Ambient({ weather }: { weather?: Weather['kind'] }) {
  const { c, scheme } = useTheme();
  const { width, height } = useScreen();
  const size = Math.max(width, height) * 0.8;
  const opacity = scheme === 'dark' ? 0.55 : 0.85;
  const w = weather ? WEATHER_HALOS[weather] : null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {HALOS.map((h, i) => (
        <Halo
          key={h.key}
          color={c[(w ? `halo-${w.tone}-${i + 1}` : h.key) as ColorName]}
          size={size}
          left={h.x * width - size / 2}
          top={h.y * height - size / 2}
          opacity={opacity}
          duration={h.duration * (w?.pace ?? 1)}
          delay={h.delay}
          flip={i % 2 === 1}
        />
      ))}
    </View>
  );
}

function Halo({ color, size, left, top, opacity, duration, delay, flip }: { color: string; size: number; left: number; top: number; opacity: number; duration: number; delay: number; flip: boolean }) {
  const reduced = useReducedMotion();
  // Chaque halo part d'une phase différente, pour ne jamais bouger en bloc.
  const t = useSharedValue((delay / duration) % 1);
  useEffect(() => {
    if (!reduced) t.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t, reduced, duration]);
  const drift = useAnimatedStyle(() => {
    const k = t.value;
    const d = size * 0.09;
    return {
      transform: [
        { translateX: (flip ? -1 : 1) * d * Math.sin(k * Math.PI) },
        { translateY: (flip ? 1 : -1) * d * (k - 0.5) },
        { scale: 1 + 0.06 * Math.sin(k * Math.PI) },
      ],
    };
  });
  // Identifiant propre à chaque halo : sur le web, un écran caché qui porterait le
  // même id garderait le dégradé pour lui, et le halo visible resterait vide.
  const id = `halo${useId().replace(/[^0-9a-z]/gi, '')}`;
  return (
    <Animated.View style={[{ position: 'absolute', left, top, width: size, height: size, opacity }, drift]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.55} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}
