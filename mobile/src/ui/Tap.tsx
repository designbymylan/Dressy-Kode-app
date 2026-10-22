import { type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { motion } from '../theme/tokens';
import { PressContext } from './press';

export type Feedback = 'none' | 'light' | 'medium' | 'success' | 'select';

export function haptic(kind: Feedback) {
  if (Platform.OS === 'web' || kind === 'none') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'select') Haptics.selectionAsync();
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
}

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Mise en page du conteneur touchable (flex, largeur) : le style visuel reste sur `style`. */
  outerStyle?: StyleProp<ViewStyle>;
  /** Interdit : voir plus bas. */
  className?: never;
  children: ReactNode;
  /** Ressort à l'appui : 0,97 par défaut, 1 pour ne rien bouger. */
  scaleTo?: number;
  feedback?: Feedback;
};

/**
 * Tout ce qui se touche passe par ici : un ressort court à l'appui (désactivé
 * si « Réduire les animations » est actif), un retour haptique discret, et
 * le rôle d'accessibilité « bouton » par défaut. Les icônes posées dessus
 * jouent leur geste pendant l'appui (`PressContext`, 21/10). Le style passe par `style`
 * (jetons de `useTheme().c`), jamais par des classes NativeWind.
 */
export function Tap({ style, outerStyle, children, scaleTo = motion.pressScale, feedback = 'light', onPressIn, onPressOut, onPress, accessibilityRole = 'button', ...rest }: Props) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const pressed = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      style={outerStyle}
      accessibilityRole={accessibilityRole}
      onPressIn={(e) => {
        if (!reduced && scaleTo !== 1) s.value = withSpring(scaleTo, motion.press);
        if (!reduced) pressed.value = withSpring(1, motion.spring);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, motion.press);
        pressed.value = withSpring(0, motion.spring);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        haptic(feedback);
        onPress?.(e);
      }}
      {...rest}
    >
      {/* Pas de className ici : sur iPhone, NativeWind fusionnerait le style
          fixe et le style animé, et Reanimated ne garderait que l'animé. */}
      <Animated.View style={[style, anim]}>
        <PressContext.Provider value={pressed}>{children}</PressContext.Provider>
      </Animated.View>
    </Pressable>
  );
}
