import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from './T';
import { IconButton } from './Button';
import { Glass } from './Glass';
import type { IconName } from './Icon';

/** Filet éditorial. */
export function Rule({ strong, style }: { strong?: boolean; style?: object }) {
  return <View style={[{ height: 1 }, style]} className={strong ? 'bg-rule-strong' : 'bg-rule'} />;
}

/** L'ours d'une page : le mot de la page en capitales espacées à gauche, le contexte à droite. */
export function Masthead({ kicker, meta, right }: { kicker: string; meta?: string; right?: ReactNode }) {
  return (
    <View style={{ gap: 10, paddingBottom: 2 }}>
      <View className="flex-row items-center justify-between" style={{ minHeight: 20, gap: 12 }}>
        <T v="masthead" accessibilityRole="header">
          {kicker}
        </T>
        {meta ? (
          <T v="caption" tone="ink2" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>
            {meta}
          </T>
        ) : (
          right
        )}
      </View>
    </View>
  );
}

/** Titre de section numéroté : « 01 Manteaux … 9 pièces ». */
export function SectionHead({ n, title, action, onAction, testID }: { n?: string; title: string; action?: string; onAction?: () => void; testID?: string }) {
  return (
    <View className="flex-row items-baseline" style={{ gap: 10 }}>
      {n && (
        <T v="numeral" tone="ink2" style={{ fontSize: 20 }} accessibilityElementsHidden importantForAccessibility="no">
          {n}
        </T>
      )}
      <T v="section" style={{ flex: 1 }} accessibilityRole="header">
        {title}
      </T>
      {action && onAction && (
        <T testID={testID} v="caption" tone="ink2" onPress={onAction} accessibilityRole="link" suppressHighlighting style={{ paddingVertical: 13, paddingLeft: 8 }}>
          {action}
        </T>
      )}
    </View>
  );
}

/* ——— Barre d'onglets qui se replie au défilement (iOS 26) ——— */

const TabChrome = createContext<SharedValue<number> | null>(null);

export function TabChromeProvider({ children }: { children: ReactNode }) {
  const compact = useSharedValue(0);
  return <TabChrome.Provider value={compact}>{children}</TabChrome.Provider>;
}

export function useTabCompact() {
  return useContext(TabChrome);
}

/**
 * À brancher sur le défilement d'un écran à onglets : on descend, la barre se
 * replie ; on remonte, elle revient. `edge` reçoit la position, pour le voile du haut.
 */
export function useTabScroll(edge?: SharedValue<number>) {
  const compact = useContext(TabChrome);
  const last = useSharedValue(0);
  return useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      if (edge) edge.value = y;
      const dy = y - last.value;
      last.value = y;
      if (!compact) return;
      if (y < 40) {
        if (compact.value !== 0) compact.value = withTiming(0, { duration: 200 });
      } else if (dy > 6 && compact.value === 0) compact.value = withTiming(1, { duration: 220 });
      else if (dy < -6 && compact.value === 1) compact.value = withTiming(0, { duration: 220 });
    },
  });
}

/** Le voile de verre sous la barre d'état, qui n'apparaît qu'au défilement (effet de bord d'iOS 26). */
export function ScrollEdge({ y }: { y: SharedValue<number> }) {
  const insets = useSafeAreaInsets();
  const style = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 28], [0, 1], 'clamp') }));
  if (!insets.top) return null;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 4, zIndex: 5 }, style]}>
      <Glass radius={0} shadow={false} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/* ——— En-tête des écrans empilés ——— */

export function useHeaderScroll() {
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({ onScroll: (e) => (y.value = e.contentOffset.y) });
  return { y, onScroll };
}

type HeaderProps = {
  title: string;
  y?: SharedValue<number>;
  right?: { icon: IconName; label: string; onPress: () => void; testID?: string }[];
  /** Pour une feuille modale : une croix plutôt qu'une flèche. */
  close?: boolean;
  onBack?: () => void;
};

/**
 * Bouton retour flottant en verre ; le titre et un bandeau de verre
 * n'apparaissent qu'au défilement (l'« effet de bord » d'iOS 26), pour que
 * le haut de page reste éditorial au repos.
 */
export function StackHeader({ title, y, right = [], close, onBack }: HeaderProps) {
  const nav = useNavigation();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const band = useAnimatedStyle(() => ({ opacity: y ? interpolate(y.value, [20, 70], [0, 1], 'clamp') : 0 }));
  const top = close ? 12 : insets.top + 6;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: top + 50 }, band]}>
        <Glass radius={0} shadow={false} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: c.rule }} />
        <View style={{ position: 'absolute', left: 64, right: 64, top, height: 44, justifyContent: 'center' }}>
          <T v="bodyStrong" numberOfLines={1} style={{ textAlign: 'center' }}>
            {title}
          </T>
        </View>
      </Animated.View>
      <View pointerEvents="box-none" className="flex-row items-center justify-between" style={{ paddingTop: top, paddingHorizontal: 12 }}>
        <IconButton
          testID="header-back"
          icon={close ? 'close' : 'back'}
          label={close ? 'Fermer' : 'Retour'}
          variant="glass"
          onPress={onBack ?? (() => nav.goBack())}
        />
        <View className="flex-row" style={{ gap: 8 }}>
          {right.map((r) => (
            <IconButton key={r.label} testID={r.testID} icon={r.icon} label={r.label} variant="glass" onPress={r.onPress} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** Place laissée en haut d'un écran empilé, sous le bouton retour. */
export function useStackTop(close?: boolean) {
  const insets = useSafeAreaInsets();
  return (close ? 12 : insets.top + 6) + 44 + space.lg;
}
