import { useId, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
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
 * Le verre bleu (21/10, globals.css : `--blue-glass`) : l'action principale
 * et ce qui est choisi. Un dégradé bleu, un reflet en haut, un liseré clair ;
 * à poser en premier enfant d'une surface (bouton, puce, curseur), qui garde
 * sa forme et son ombre (`material.blue`). Le texte dessus est noir
 * (`on-blue`), en clair comme en sombre.
 */
export function BlueGlass({ radius }: { radius: number }) {
  const { c } = useTheme();
  const id = `blue${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View pointerEvents="none" style={[FILL, { borderRadius: radius, overflow: 'hidden', backgroundColor: c.blue }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c['blue-top']} />
            <Stop offset="1" stopColor={c['blue-bottom']} />
          </LinearGradient>
          {/* Le reflet spéculaire, en haut à gauche, comme sur le verre d'Apple. */}
          <RadialGradient id={`${id}h`} cx="0.28" cy="-0.1" rx="1.2" ry="0.9" fx="0.28" fy="-0.1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.8} />
            <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}f)`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}h)`} />
      </Svg>
      <View style={[FILL, { borderRadius: radius, borderWidth: 1, borderColor: c['blue-edge'] }]} />
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
