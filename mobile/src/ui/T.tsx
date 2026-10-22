import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { HIT, type as scale } from '../theme/tokens';

export type TextVariant = keyof typeof scale;
type Tone = 'ink' | 'ink2' | 'brass' | 'primary-fg' | 'positive' | 'caution' | 'blue-ink' | 'on-blue' | 'on-panel' | 'on-panel-muted';

/** Classes écrites en entier : Tailwind ne génère que ce qu'il lit tel quel. */
const TONE: Record<Tone, string> = {
  ink: 'text-ink',
  ink2: 'text-ink2',
  brass: 'text-brass',
  'primary-fg': 'text-primary-fg',
  positive: 'text-positive',
  caution: 'text-caution',
  'blue-ink': 'text-blue-ink',
  'on-blue': 'text-on-blue',
  'on-panel': 'text-on-panel',
  'on-panel-muted': 'text-on-panel-muted',
};

/** Les grands titres grossissent avec la taille de texte du système, mais sans casser la page. */
const MAX_SCALE: Partial<Record<TextVariant, number>> = { hero: 1.25, title: 1.3, section: 1.4, stat: 1.3, brand: 1.4, masthead: 1.6, tab: 1.3 };

type Props = TextProps & { v?: TextVariant; tone?: Tone; className?: string; upper?: boolean };

/**
 * Un texte qui se touche (lien « Modifier », « Tout voir »…) garde sa place à
 * l'écran mais reçoit une zone de toucher de 44 pt : la marge intérieure
 * grandit, une marge extérieure négative la compense. Le composant Text n'a
 * pas de `hitSlop`.
 */
function touchArea(flat: TextStyle): TextStyle | null {
  const line = flat.lineHeight ?? (flat.fontSize ?? 15) * 1.3;
  const top = Number(flat.paddingTop ?? flat.paddingVertical ?? flat.padding ?? 0);
  const bottom = Number(flat.paddingBottom ?? flat.paddingVertical ?? flat.padding ?? 0);
  const extra = Math.ceil(Math.max(0, HIT - (line + top + bottom)) / 2);
  if (!extra) return null;
  const mTop = Number(flat.marginTop ?? flat.marginVertical ?? flat.margin ?? 0);
  const mBottom = Number(flat.marginBottom ?? flat.marginVertical ?? flat.margin ?? 0);
  return { paddingTop: top + extra, paddingBottom: bottom + extra, marginTop: mTop - extra, marginBottom: mBottom - extra };
}

export function T({ v = 'body', tone = 'ink', className = '', style, upper, children, ...rest }: Props) {
  const flat = StyleSheet.flatten([scale[v], style]) as TextStyle;
  const touch = rest.onPress ? touchArea(flat) : null;
  return (
    <Text
      className={`${TONE[tone]} ${className}`}
      style={[flat, upper && { textTransform: 'uppercase' }, touch]}
      maxFontSizeMultiplier={MAX_SCALE[v] ?? 2}
      {...rest}
    >
      {children}
    </Text>
  );
}
