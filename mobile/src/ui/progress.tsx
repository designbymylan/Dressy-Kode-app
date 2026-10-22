import { useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { motion, space } from '../theme/tokens';
import { F } from '../theme/fonts';
import { T } from './T';

/**
 * Barre de progression (21/10, référence « Inspiration progress bar » ; web :
 * `.dk-pbar`) : une gélule cernée d'un trait épais, et une gélule pleine qui
 * porte le pourcentage. Elle pousse depuis zéro à l'apparition. `on` :
 * la couleur du trait et du plein (l'encre, ou le blanc sur la section
 * découpée) ; `under` : celle du chiffre posé sur le plein.
 */
export function ProgressBar({ value, label, small, on, under }: { value: number; label: string; small?: boolean; on: string; under: string }) {
  const reduced = useReducedMotion();
  const v = Math.max(0, Math.min(100, value));
  const k = useSharedValue(reduced ? v : 0);
  useEffect(() => {
    k.value = reduced ? v : withDelay(120, withTiming(v, { duration: 1300, easing: motion.easing }));
  }, [v, k, reduced]);
  const h = small ? 28 : 48;
  const pad = small ? 3 : 4;
  const min = small ? 38 : 58;
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(k.value, 0)}%` as `${number}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v) }}
      style={{ height: h, padding: pad, borderWidth: small ? 2.5 : 3, borderColor: on, borderRadius: h / 2 }}
    >
      <Animated.View style={[{ height: '100%', minWidth: min, maxWidth: '100%', borderRadius: h, backgroundColor: on, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: small ? 7 : 12 }, fill]}>
        <T v="small" style={[F.s600, { color: under, fontSize: small ? 11 : 14.5, lineHeight: small ? 14 : 18, fontVariant: ['tabular-nums'] }]}>
          {`${Math.round(v)} %`}
        </T>
      </Animated.View>
    </View>
  );
}

const R = 40;

/**
 * Section découpée (21/10, référence « découpage de section » ; web : `Cut`,
 * `.dk-cut`) : un panneau noir qui coule dans la page. Le coin haut gauche
 * remonte en congé creux, le coin haut droit est bombé : la ligne fait un S.
 * `close` referme le bas de la même façon, à l'envers. Pleine largeur : elle
 * déborde des marges de la page.
 */
export function Cut({ children, close, style }: { children: ReactNode; close?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ marginTop: R, marginHorizontal: -space.gutter, marginBottom: close ? R : 0 }, style]}>
      {/* Le congé creux, en haut à gauche. */}
      <Svg width={R} height={R} style={{ position: 'absolute', left: 0, top: -R + 1 }}>
        <Path d={`M0 0A${R} ${R} 0 0 0 ${R} ${R}H0Z`} fill={c.panel} />
      </Svg>
      <View style={{ backgroundColor: c.panel, borderTopRightRadius: R, borderBottomLeftRadius: close ? R : 0, paddingHorizontal: space.gutter, paddingTop: 26, paddingBottom: 28, gap: 18 }}>
        {children}
      </View>
      {close && (
        <Svg width={R} height={R} style={{ position: 'absolute', right: 0, bottom: -R + 1 }}>
          <Path d={`M${R} 0V${R}A${R} ${R} 0 0 0 0 0Z`} fill={c.panel} />
        </Svg>
      )}
    </View>
  );
}

