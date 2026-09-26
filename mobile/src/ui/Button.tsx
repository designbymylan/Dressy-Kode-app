import { ActivityIndicator, View } from 'react-native';
import { Tap, type Feedback } from './Tap';
import { T } from './T';
import { Icon, type IconName } from './Icon';
import { Glass } from './Glass';
import { useTheme } from '../theme/ThemeProvider';
import { HIT } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'quiet' | 'plain';
type Size = 'l' | 'm' | 's';
const HEIGHT: Record<Size, number> = { l: 50, m: 44, s: 36 };

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
 * Trois poids, pas plus : principal (encre pleine, une seule action par
 * écran), secondaire (contour), discret (pastille). Toujours en capsule,
 * toujours ≥ 44 pt de zone tactile, même pour la petite taille.
 */
export function Button({ label, onPress, variant = 'primary', size = 'l', icon, iconRight, grow, disabled, loading, hint, feedback, testID }: Props) {
  const { c } = useTheme();
  const h = HEIGHT[size];
  const fg = variant === 'primary' ? c['primary-fg'] : c.ink;
  const box =
    variant === 'primary' ? 'bg-primary-bg' : variant === 'secondary' ? 'border border-rule-strong' : variant === 'quiet' ? 'bg-pill' : '';
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
      feedback={feedback ?? (variant === 'primary' ? 'medium' : 'light')}
      outerStyle={grow ? { flexGrow: 1, flexBasis: 0 } : undefined}
      style={{ height: h, borderRadius: h / 2, opacity: disabled ? 0.45 : 1 }}
      className={`flex-row items-center justify-center ${variant === 'plain' ? 'px-1' : size === 's' ? 'px-4' : 'px-5'} ${box}`}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {icon && <Icon name={icon} size={size === 's' ? 17 : 19} color={fg} strokeWidth={1.9} />}
          <T v={size === 's' ? 'caption' : 'button'} tone={variant === 'primary' ? 'primary-fg' : 'ink'} style={size === 's' ? { fontFamily: 'HankenGrotesk_600SemiBold' } : undefined} numberOfLines={1}>
            {label}
          </T>
          {iconRight && <Icon name={iconRight} size={17} color={fg} strokeWidth={1.9} />}
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

export function IconButton({ icon, label, onPress, variant = 'outline', size = HIT, testID, badge }: IconButtonProps) {
  const { c } = useTheme();
  const fg = variant === 'solid' ? c['primary-fg'] : c.ink;
  const body = (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Icon name={icon} size={Math.round(size * 0.44)} color={fg} strokeWidth={variant === 'solid' ? 2.1 : 1.8} />
      {badge && <View className="absolute bg-brass" style={{ top: size * 0.2, right: size * 0.2, width: 8, height: 8, borderRadius: 4 }} />}
    </View>
  );
  const box =
    variant === 'solid' ? 'bg-primary-bg' : variant === 'outline' ? 'border border-rule-strong' : variant === 'quiet' ? 'bg-pill' : '';
  const slop = Math.max(0, (HIT - size) / 2);
  return (
    <Tap testID={testID} onPress={onPress} accessibilityLabel={label} hitSlop={slop} style={{ borderRadius: size / 2 }} className={box}>
      {variant === 'glass' ? <Glass radius={size / 2}>{body}</Glass> : body}
    </Tap>
  );
}
