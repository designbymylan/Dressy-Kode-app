import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { type as scale } from '../theme/tokens';

export type TextVariant = keyof typeof scale;
type Tone = 'ink' | 'ink2' | 'brass' | 'primary-fg' | 'positive' | 'caution';

/** Classes écrites en entier : Tailwind ne génère que ce qu'il lit tel quel. */
const TONE: Record<Tone, string> = {
  ink: 'text-ink',
  ink2: 'text-ink2',
  brass: 'text-brass',
  'primary-fg': 'text-primary-fg',
  positive: 'text-positive',
  caution: 'text-caution',
};

/** Les grands titres grossissent avec la taille de texte du système, mais sans casser la page. */
const MAX_SCALE: Partial<Record<TextVariant, number>> = { hero: 1.25, title: 1.3, section: 1.4, masthead: 1.6, tab: 1.3 };

type Props = TextProps & { v?: TextVariant; tone?: Tone; className?: string; upper?: boolean };

/**
 * Le mot qui chante d'un titre (`fontFamily: 'Accent'`) : l'italique serif
 * paraît plus petit que le grotesque à corps égal, et l'approche serrée des
 * titres l'écraserait. On le grossit de 8 % et on lui rend son approche
 * (globals.css : `.hero-title .accent`).
 */
function accentFix(style: TextStyle): TextStyle | null {
  if (style.fontFamily !== 'Accent' || !style.fontSize || (style.letterSpacing ?? 0) >= 0) return null;
  return { fontSize: style.fontSize * 1.08, letterSpacing: -0.2 };
}

export function T({ v = 'body', tone = 'ink', className = '', style, upper, children, ...rest }: Props) {
  const flat = StyleSheet.flatten([scale[v], style]) as TextStyle;
  return (
    <Text
      className={`${TONE[tone]} ${className}`}
      style={[flat, upper && { textTransform: 'uppercase' }, accentFix(flat)]}
      maxFontSizeMultiplier={MAX_SCALE[v] ?? 2}
      {...rest}
    >
      {children}
    </Text>
  );
}
