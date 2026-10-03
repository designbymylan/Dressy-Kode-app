import { ActivityIndicator, View } from 'react-native';
import { Tap, type Feedback } from './Tap';
import { T } from './T';
import { Icon, type IconName } from './Icon';
import { useTheme } from '../theme/ThemeProvider';
import { HIT } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'quiet' | 'plain';
type Size = 'l' | 'm' | 's';
const HEIGHT: Record<Size, number> = { l: 50, m: 44, s: 40 };

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  grow?: boolean;
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
  feedback?: Feedback;
  testID?: string;
};

/**
 * Les boutons de la galerie : angles droits, libellé en capitales (13 pt,
 * graisse moyenne, sans interlettrage). Principal en noir plein, une seule
 * action par écran ; secondaire en simple filet, fond transparent ; discret
 * sur gris studio ; simple en texte. Jamais d'ombre, toujours ≥ 44 pt de
 * zone tactile.
 */
export function Button({ label, onPress, variant = 'primary', size = 'l', icon, iconRight, grow, disabled, loading, hint, feedback, testID }: Props) {
  const { c } = useTheme();
  const h = HEIGHT[size];
  const fg = variant === 'primary' ? c['primary-fg'] : c.ink;
  const surface =
    variant === 'primary'
      ? { backgroundColor: c['primary-bg'] }
      : variant === 'secondary'
        ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.ink }
        : variant === 'quiet'
          ? { backgroundColor: c.pill }
          : null;
  const slop = Math.max(0, (HIT - h) / 2);
  return (
    <Tap
      testID={testID}
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      hitSlop={slop}
      scaleTo={0.98}
      feedback={feedback ?? (variant === 'primary' ? 'medium' : 'light')}
      outerStyle={grow ? { flexGrow: 1, flexBasis: 0 } : undefined}
      style={[{ height: h, borderRadius: 0, opacity: disabled ? 0.4 : 1 }, surface]}
      className={`flex-row items-center justify-center ${variant === 'plain' ? 'px-1' : size === 's' ? 'px-4' : 'px-5'}`}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {icon && <Icon name={icon} size={17} color={fg} strokeWidth={1.8} />}
          <T v="button" tone={variant === 'primary' ? 'primary-fg' : 'ink'} upper numberOfLines={1} style={variant === 'plain' && { textDecorationLine: 'underline' }}>
            {label}
          </T>
          {iconRight && <Icon name={iconRight} size={16} color={fg} strokeWidth={1.8} />}
        </View>
      )}
    </Tap>
  );
}

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: 'outline' | 'solid' | 'glass' | 'plain' | 'quiet';
  size?: number;
  testID?: string;
  badge?: boolean;
};

/**
 * Bouton icône : l'icône seule, noire, sur fond transparent (la charte n'a
 * pas de pastille autour des icônes). « solid » : carré noir ; « glass » :
 * carré blanc à filet, pour flotter au-dessus d'une image ; « quiet » : gris
 * studio. Le libellé reste pour les lecteurs d'écran.
 */
export function IconButton({ icon, label, onPress, variant = 'outline', size = HIT, testID, badge }: IconButtonProps) {
  const { c } = useTheme();
  const fg = variant === 'solid' ? c['primary-fg'] : c.ink;
  const surface =
    variant === 'solid'
      ? { backgroundColor: c['primary-bg'] }
      : variant === 'glass'
        ? { backgroundColor: c.glass, borderWidth: 1, borderColor: c['glass-border'] }
        : variant === 'quiet'
          ? { backgroundColor: c.pill }
          : null;
  const slop = Math.max(0, (HIT - size) / 2);
  return (
    <Tap testID={testID} onPress={onPress} accessibilityLabel={label} hitSlop={slop} style={[{ borderRadius: 0 }, surface]}>
      <View style={{ width: size, height: size }} className="items-center justify-center">
        <Icon name={icon} size={Math.round(size * 0.5)} color={fg} strokeWidth={1.8} />
        {badge && <View className="absolute bg-ink" style={{ top: size * 0.2, right: size * 0.2, width: 7, height: 7 }} />}
      </View>
    </Tap>
  );
}
