import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { T } from './T';

/**
 * Le logo (piste A validée le 13/10, `../../design/logo/`) : un K fin dont la
 * branche haute s'arrête sur l'étincelle de Kodi. Mêmes tracés que le web
 * (`web/src/components/Logo.tsx`). Il prend la couleur du texte qu'il
 * accompagne : noir en clair, blanc en sombre.
 */
const K = {
  stem: 'M26.75 14H33.25V86H26.75Z',
  upper: 'M32.3 63.3L63.3 32.3L58.7 27.7L27.7 58.7Z',
  lower: 'M41.53 49.11L72.93 86L81.47 86L46.48 44.89Z',
  spark: 'M71 3C72 13 75 16 85 17C75 18 72 21 71 31C70 21 67 18 57 17C67 16 70 13 71 3Z',
};

/** Les deux couleurs du logo : celle du texte, ou celle posée sur un bouton plein (carte de membre). */
type LogoTone = 'ink' | 'primary-fg';

export function Monogram({ size = 22, tone = 'ink' }: { size?: number; tone?: LogoTone }) {
  const { c } = useTheme();
  const fill = c[tone];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessible={false}>
      <Path d={K.stem} fill={fill} />
      <Path d={K.upper} fill={fill} />
      <Path d={K.lower} fill={fill} />
      <Path d={K.spark} fill={fill} />
    </Svg>
  );
}

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
      <Monogram size={size} tone={tone} />
      <T v="brand" tone={tone} numberOfLines={1} style={textStyle}>
        DRESSKODE
      </T>
    </View>
  );
}
