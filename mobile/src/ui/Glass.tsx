import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Props = { style?: StyleProp<ViewStyle>; radius?: number; children?: ReactNode; shadow?: boolean; strong?: boolean; edge?: 'all' | 'top' | 'bottom' | 'none' };

/**
 * La surface de la couche de navigation (barre d'onglets, en-têtes, messages).
 * Le nom vient de l'ancienne direction ; dans la galerie, plus de verre :
 * une surface pleine, blanche (noire en sombre), bordée d'un filet d'un
 * pixel, à angles droits et sans ombre. `edge` dit où poser le filet.
 */
export function Glass({ style, children, strong, edge = 'all' }: Props) {
  const { c } = useTheme();
  const line: ViewStyle =
    edge === 'all' ? { borderWidth: 1 } : edge === 'top' ? { borderTopWidth: 1 } : edge === 'bottom' ? { borderBottomWidth: 1 } : {};
  return <View style={[{ backgroundColor: strong ? c['glass-strong'] : c.glass, borderColor: c['glass-border'] }, line, style]}>{children}</View>;
}

/**
 * Surface d'un contenu (cartes, groupes de lignes) : à plat, bordée d'un filet
 * gris d'un pixel, sans ombre. Le blanc suffit à séparer.
 */
export function glassSurface(c: Record<string, string>, _scheme?: 'light' | 'dark', solid = false): ViewStyle {
  return { backgroundColor: solid ? c.raised : c.card, borderWidth: 1, borderColor: c['card-edge'] };
}
