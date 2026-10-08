/**
 * Les patchs des offres et de la boutique (07/10), sur le modèle des pages
 * d'abonnement envoyées par l'utilisatrice : un autocollant penché qui dit
 * l'avantage en deux mots (« -29 % », « 1er mois offert », « Économise
 * 4,96 € »). Rose poudré ou noir, jamais d'autre couleur que la galerie.
 * Un patch se lit, il ne se touche pas : il n'est donc pas en capsule.
 */
import { View, type ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { F } from '../theme/fonts';
import { Icon, type IconName } from './Icon';
import { T } from './T';

type Tone = 'butter' | 'ink';

function colors(tone: Tone, c: ReturnType<typeof useTheme>['c']) {
  return tone === 'ink' ? { bg: c['primary-bg'], fg: c['primary-fg'] } : { bg: c.butter, fg: c['butter-ink'] };
}

/** L'autocollant penché : un ou deux mots, en gras. */
export function Patch({ label, tone = 'butter', tilt = -4, icon, style, testID }: { label: string; tone?: Tone; tilt?: number; icon?: IconName; style?: ViewStyle; testID?: string }) {
  const { c } = useTheme();
  const k = colors(tone, c);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={[
        { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, backgroundColor: k.bg, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5, transform: [{ rotate: `${tilt}deg` }] },
        { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={14} color={k.fg} strokeWidth={2} />}
      <T v="caption" numberOfLines={1} style={{ ...F.s600, fontSize: 13, lineHeight: 17, color: k.fg }}>
        {label}
      </T>
    </View>
  );
}

/** Le sceau dentelé : un grand chiffre en Cormorant et sa ligne d'explication. */
export function Seal({ big, small, size = 104, tone = 'butter', tilt = -10, style }: { big: string; small?: string; size?: number; tone?: Tone; tilt?: number; style?: ViewStyle }) {
  const { c } = useTheme();
  const k = colors(tone, c);
  const n = 22;
  const r = size / 2;
  const pts = Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const d = i % 2 === 0 ? r : r * 0.88;
    return `${(r + d * Math.cos(a)).toFixed(2)},${(r + d * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  return (
    <View accessible accessibilityLabel={small ? `${big} ${small}` : big} style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${tilt}deg` }] }, style]}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Polygon points={pts} fill={k.bg} />
      </Svg>
      <T v="stat" style={{ color: k.fg, fontSize: size * 0.3, lineHeight: size * 0.33 }} numberOfLines={1} adjustsFontSizeToFit>
        {big}
      </T>
      {small ? (
        <T v="kicker" style={{ color: k.fg, fontSize: 11.5, lineHeight: 14, textAlign: 'center', maxWidth: size * 0.7 }} numberOfLines={2}>
          {small}
        </T>
      ) : null}
    </View>
  );
}

/** Un prix barré, à côté du vrai : ce que la remise fait gagner, d'un coup d'œil. */
export function Struck({ label, tone = 'ink2' }: { label: string; tone?: 'ink2' | 'primary-fg' }) {
  return (
    <T v="caption" tone={tone} style={{ textDecorationLine: 'line-through', opacity: tone === 'primary-fg' ? 0.7 : 1 }} accessibilityLabel={`au lieu de ${label}`}>
      {label}
    </T>
  );
}
