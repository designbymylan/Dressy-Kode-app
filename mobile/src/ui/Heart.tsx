/**
 * Le cœur des favoris (05/11), comme sur les apps de mode : un rond de verre
 * dans le coin d'une vignette, le contour au repos, plein et bleu une fois la
 * pièce aimée. Un petit ressort à l'appui, un retour haptique léger (par
 * `Tap`), coupé par « Réduire les animations ». Zone tactile de 44 pt au
 * moins, même sur un petit rond.
 */
import { useEffect, useRef } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { HIT, motion } from '../theme/tokens';
import { Icon } from './Icon';
import { Tap } from './Tap';

type Props = {
  liked: boolean;
  onToggle: () => void;
  /** Le nom de la pièce, pour le lecteur d'écran. */
  name?: string;
  size?: number;
  testID?: string;
  /** Pour poser le cœur dans un coin (position absolue). */
  outerStyle?: StyleProp<ViewStyle>;
};

export function HeartButton({ liked, onToggle, name, size = 34, testID, outerStyle }: Props) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);
  const first = useRef(true);
  // Le petit rebond n'est joué que quand l'état change, pas au premier rendu.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    pop.value = withSequence(withSpring(liked ? 1.28 : 0.86, motion.press), withSpring(1, motion.spring));
  }, [liked]); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const verb = liked ? 'Retirer des favoris' : 'Ajouter aux favoris';
  return (
    <Tap
      testID={testID}
      onPress={onToggle}
      feedback={liked ? 'select' : 'light'}
      scaleTo={0.9}
      hitSlop={Math.max(0, (HIT - size) / 2)}
      outerStyle={outerStyle}
      accessibilityLabel={name ? `${verb}, ${name}` : verb}
      accessibilityState={{ selected: liked }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: c['glass-strong'], borderWidth: 1, borderColor: c['glass-border'] }}
    >
      <Animated.View style={anim}>
        <Icon name="heart" size={Math.round(size * 0.52)} color={liked ? c['blue-ink'] : c.ink} line={!liked} strokeWidth={1.9} />
      </Animated.View>
    </Tap>
  );
}
