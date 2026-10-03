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

export function T({ v = 'body', tone = 'ink', className = '', style, upper, children, ...rest }: Props) {
  const flat = StyleSheet.flatten([scale[v], style]) as TextStyle;
  return (
    <Text
      className={`${TONE[tone]} ${className}`}
      style={[flat, upper && { textTransform: 'uppercase' }]}
      maxFontSizeMultiplier={MAX_SCALE[v] ?? 2}
      {...rest}
    >
      {children}
    </Text>
  );
}
