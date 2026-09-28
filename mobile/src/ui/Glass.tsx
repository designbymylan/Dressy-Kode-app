import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../theme/ThemeProvider';
import { material } from '../theme/tokens';

const FILL = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;
const NATIVE_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

type Props = { style?: StyleProp<ViewStyle>; radius: number; children?: ReactNode; shadow?: boolean; strong?: boolean };

/**
 * Le verre de la couche de navigation (onglets, boutons flottants, bandeaux,
 * messages). Sur iOS 26, le vrai Liquid Glass, teinté pour la lisibilité ;
 * ailleurs, un flou recouvert de la teinte du verre, bordé d'un filet clair
 * (globals.css : `.glass`). « Verre plus opaque » remplace tout par une
 * surface pleine.
 */
export function Glass({ style, radius, children, shadow = true, strong }: Props) {
  const { scheme, c, solidGlass } = useTheme();
  const tint = strong ? c['glass-strong'] : c.glass;
  const outer: StyleProp<ViewStyle> = [{ borderRadius: radius }, shadow && material.shadow[scheme], style];
  const clip: ViewStyle = { ...FILL, borderRadius: radius, overflow: 'hidden' };
  const border: ViewStyle = { ...FILL, borderRadius: radius, borderWidth: 1, borderColor: c['glass-border'] };

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
 * blanc translucide sur les halos, filet clair, ombre douce, sans flou, il
 * n'y a que l'ambiance dessous, et un flou par carte coûterait cher en
 * défilement.
 */
export function glassSurface(c: Record<string, string>, scheme: 'light' | 'dark', solid = false): ViewStyle {
  return {
    backgroundColor: solid ? c.raised : c.card,
    borderWidth: 1,
    borderColor: c['card-edge'],
    ...material.card[scheme],
  };
}
