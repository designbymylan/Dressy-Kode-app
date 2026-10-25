import { useRef } from 'react';
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { T } from './T';

/**
 * Le logo (25/10) : l'orbe de Kodi, une sphère lavande vers ciel avec son
 * reflet. Il remplace le K étoilé (13/10), retiré à la demande de
 * l'utilisateur. Mêmes couleurs et même reflet que le web
 * (`web/src/components/Logo.tsx`) et que l'orbe au repos (`Orb`).
 */
const ORBE = { from: '#b9adff', to: '#9fd0ff' };

let logoUid = 0;

/** Le monogramme : l'orbe seule. Sa couleur ne suit pas le texte : c'est un dessin, pas une lettre. */
export function Monogram({ size = 22 }: { size?: number }) {
  const gradId = useRef(`logo-orbe-${++logoUid}`).current;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessible={false}>
      <Defs>
        <RadialGradient id={gradId} cx="32%" cy="28%" r="85%">
          <Stop offset="0%" stopColor={ORBE.from} />
          <Stop offset="100%" stopColor={ORBE.to} />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={50} fill={`url(#${gradId})`} />
      <Ellipse cx={42} cy={21} rx={20} ry={13} fill="#ffffff" fillOpacity={0.7} />
    </Svg>
  );
}

type LogoTone = 'ink' | 'primary-fg' | 'on-panel';

/** La marque : le monogramme devant DRESSKODE, lue « Dresskode » par les lecteurs d'écran. */
export function BrandMark({
  tone = 'ink',
  size = 22,
  textStyle,
  style,
}: {
  tone?: LogoTone;
  size?: number;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Dresskode" style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>
      <Monogram size={size} />
      <T v="brand" tone={tone} numberOfLines={1} style={textStyle}>
        DRESSKODE
      </T>
    </View>
  );
}
