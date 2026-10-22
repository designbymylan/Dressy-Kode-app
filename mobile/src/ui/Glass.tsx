import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { material } from '../theme/tokens';

const FILL = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;
const NATIVE_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

type Props = { style?: StyleProp<ViewStyle>; radius?: number; children?: ReactNode; shadow?: boolean; strong?: boolean; edge?: 'all' | 'none' };

/**
 * Le verre de la couche de navigation (onglets, boutons flottants, en-têtes,
 * messages), décision du 03/10. Sur iOS 26, le vrai Liquid Glass, teinté pour
 * la lisibilité ; ailleurs, un flou recouvert de la teinte du verre, bordé
 * d'un filet clair (globals.css : `.glass`). « Verre plus opaque » remplace
 * tout par une surface pleine. `edge="none"` retire le filet (bandeaux pleine
 * largeur).
 */
export function Glass({ style, radius = 0, children, shadow = true, strong, edge = 'all' }: Props) {
  const { scheme, c, solidGlass } = useTheme();
  const tint = strong ? c['glass-strong'] : c.glass;
  const outer: StyleProp<ViewStyle> = [{ borderRadius: radius }, shadow && material.shadow[scheme], style];
  const clip: ViewStyle = { ...FILL, borderRadius: radius, overflow: 'hidden' };
  const border: ViewStyle = { ...FILL, borderRadius: radius, borderWidth: edge === 'all' ? 1 : 0, borderColor: c['glass-border'] };

  if (solidGlass) {
    return (
      <View style={[outer, { backgroundColor: c.raised }]}>
        <View pointerEvents="none" style={[border, { borderColor: c.rule }]} />
        {children}
      </View>
    );
  }
  if (NATIVE_GLASS) {
    return (
      <View style={outer}>
        <GlassView style={clip} glassEffectStyle="regular" tintColor={tint} colorScheme={scheme} />
        {children}
      </View>
    );
  }
  return (
    <View style={outer}>
      <View pointerEvents="none" style={clip}>
        <BlurView intensity={material.blur * 2} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
      </View>
      <View pointerEvents="none" style={border} />
      {children}
    </View>
  );
}

/**
 * Surface de verre pour le contenu (cartes, vignettes, groupes de lignes) :
 * blanc translucide sur les halos, filet fin, ombre douce, sans flou : il n'y
 * a que l'ambiance dessous, et un flou par carte coûterait cher en défilement.
 */
export function glassSurface(c: Record<string, string>, scheme: 'light' | 'dark', solid = false): ViewStyle {
  return {
    backgroundColor: solid ? c.raised : c.card,
    borderWidth: 1,
    borderColor: c['card-edge'],
    ...material.card[scheme],
  };
}

/**
 * Le verre bleu du 21/10 (boutons principaux, ce qui est choisi) : un
 * dégradé de bleu clair, un reflet en haut et un liseré blanc, comme
 * `--blue-glass` et `--blue-shadow` sur le web. Se pose en fond, sous le
 * contenu, dans une vue arrondie.
 */
export function BlueGlassFill({ radius }: { radius: number }) {
  const { c } = useTheme();
  return (
    <View pointerEvents="none" style={{ ...FILL, borderRadius: radius, overflow: 'hidden' }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="dk-blue-glass" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c['blue-top']} />
            <Stop offset="1" stopColor={c['blue-bottom']} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#dk-blue-glass)" />
      </Svg>
      <View style={{ ...FILL, borderRadius: radius, borderWidth: 1, borderColor: 'rgba(255,255,255,0.75)' }} />
      <View style={{ position: 'absolute', left: radius * 0.6, right: radius * 0.6, top: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.95)' }} />
    </View>
  );
}

/** L'ombre bleutée du verre bleu (--blue-shadow). */
export const blueShadow = {
  light: { shadowColor: '#4B7DA5', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  dark: { shadowColor: '#C4DAE8', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
} as const;
