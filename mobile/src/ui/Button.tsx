import { ActivityIndicator, View } from 'react-native';
import { Tap, type Feedback } from './Tap';
import { T } from './T';
import { Icon, type IconName } from './Icon';
import { BlueGlassFill, Glass } from './Glass';
import { useTheme } from '../theme/ThemeProvider';
import { HIT } from '../theme/tokens';
import { F } from '../theme/fonts';

type Variant = 'primary' | 'dark' | 'secondary' | 'quiet' | 'plain';
type Size = 'l' | 'm' | 's';
const HEIGHT: Record<Size, number> = { l: 54, m: 46, s: 40 };

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
 * Les boutons « verre » du 21/10, façon Apple : toujours en capsule, libellé
 * en casse normale (Inter 600). Principal en verre bleu, texte noir, une
 * seule action par écran ; « dark » en noir plein pour une action forte posée
 * sur du verre ; secondaire en verre clair bordé d'un filet ; discret en
 * pastille ; simple en texte gris. Toujours ≥ 44 pt de zone tactile.
 */
export function Button({ label, onPress, variant = 'primary', size = 'l', icon, iconRight, grow, disabled, loading, hint, feedback, testID }: Props) {
  const { c } = useTheme();
  const h = HEIGHT[size];
  const fg = variant === 'primary' ? c['primary-fg'] : variant === 'dark' ? c.paper : variant === 'plain' ? c.ink2 : c.ink;
  // Aucun bouton n'a d'ombre (décision du 24/10) : seuls les aplats et les filets.
  const surface =
    variant === 'primary'
      ? { backgroundColor: c.blue }
      : variant === 'dark'
        ? { backgroundColor: c.ink }
        : variant === 'secondary'
        ? { backgroundColor: c['glass-strong'], borderWidth: 1, borderColor: c['glass-border'] }
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
      feedback={feedback ?? (variant === 'primary' || variant === 'dark' ? 'medium' : 'light')}
      outerStyle={grow ? { flexGrow: 1, flexBasis: 0 } : undefined}
      style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: variant === 'plain' ? 4 : size === 's' ? 16 : 24, height: h, borderRadius: h / 2, opacity: disabled ? 0.45 : 1 }, surface]}
    >
      {variant === 'primary' && <BlueGlassFill radius={h / 2} />}
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View className="flex-row items-center" style={{ gap: 9 }}>
          {icon && <Icon name={icon} size={size === 's' ? 17 : 19} color={fg} strokeWidth={1.9} />}
          <T
            v={size === 's' ? 'caption' : 'button'}
            tone={variant === 'primary' ? 'primary-fg' : variant === 'plain' ? 'ink2' : 'ink'}
            style={[size === 's' && { ...F.s600, fontSize: 13.5 }, variant === 'plain' && F.s500, variant === 'dark' && { color: fg }]}
            numberOfLines={1}
          >
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

/**
 * Bouton icône, toujours rond. « solid » : verre bleu (21/10) ; « glass » : rond de
 * verre flouté, pour flotter au-dessus d'une image ou d'un contenu ;
 * « outline » : rond de verre clair ; « quiet » : pastille grise ; « plain » :
 * l'icône seule. Le libellé reste pour les lecteurs d'écran.
 */
export function IconButton({ icon, label, onPress, variant = 'outline', size = HIT, testID, badge }: IconButtonProps) {
  const { c } = useTheme();
  const fg = variant === 'solid' ? c['primary-fg'] : c.ink;
  const body = (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Icon name={icon} size={Math.round(size * 0.44)} color={fg} strokeWidth={variant === 'solid' ? 2.1 : 1.8} />
      {badge && <View className="absolute bg-brass" style={{ top: size * 0.2, right: size * 0.2, width: 8, height: 8, borderRadius: 4 }} />}
    </View>
  );
  const surface =
    variant === 'solid'
      ? { backgroundColor: c.blue }
      : variant === 'outline'
        ? { backgroundColor: c['glass-strong'], borderWidth: 1, borderColor: c['glass-border'] }
        : variant === 'quiet'
          ? { backgroundColor: c.pill }
          : null;
  const slop = Math.max(0, (HIT - size) / 2);
  return (
    <Tap testID={testID} onPress={onPress} accessibilityLabel={label} hitSlop={slop} style={[{ borderRadius: size / 2 }, surface]}>
      {variant === 'solid' && <BlueGlassFill radius={size / 2} />}
      {variant === 'glass' ? <Glass radius={size / 2} shadow={false}>{body}</Glass> : body}
    </Tap>
  );
}
