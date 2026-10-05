import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, withSpring, withTiming, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { material, motion } from '../theme/tokens';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { Tap } from './Tap';
import { useTabCompact } from './layout';
import { useScreen } from './screen';

const TABS: Record<string, { label: string; icon: IconName }> = {
  Home: { label: 'Accueil', icon: 'home' },
  Dressing: { label: 'Dressing', icon: 'hanger' },
  Kode: { label: 'Kode', icon: 'kode' },
  Agenda: { label: 'Agenda', icon: 'calendar' },
  Me: { label: 'Moi', icon: 'person' },
};

/**
 * Barre d'onglets flottante en verre (web : components/TabBar.tsx), revenue
 * au dessin du 02/10 à la demande de l'utilisateur (04/10) : une capsule,
 * cinq icônes ; Kode au centre en pastille encre, l'onglet actif marqué par
 * son icône encre et un point dessous. Les libellés restent pour les
 * lecteurs d'écran. Elle se resserre quand on descend dans une page
 * et revient dès qu'on remonte ; elle ne porte que de la navigation.
 *
 * Le point est liquide : quand on change d'onglet, il s'étire vers l'onglet
 * visé puis se resserre, comme une goutte ; sous la pastille de Kode, il
 * s'y fond.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const compact = useTabCompact();
  const { width } = useScreen();
  const full = Math.min(width - 40, 390);
  const bottom = (insets.bottom > 0 ? insets.bottom - 8 : 0) + material.tabBottom;
  const [centers, setCenters] = useState<number[]>([]);

  useEffect(() => {
    if (compact) compact.value = withTiming(0, { duration: 200 });
  }, [state.index, compact]);

  const bar = useAnimatedStyle(() => {
    const k = compact?.value ?? 0;
    return { height: interpolate(k, [0, 1], [material.tabHeight, 56]), width: interpolate(k, [0, 1], [full, full - 48]) };
  });

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom, alignItems: 'center' }}>
      <Animated.View style={bar}>
        <Glass radius={999} style={{ flex: 1 }}>
          <View accessibilityRole="tablist" className="flex-row items-center" style={{ flex: 1, paddingHorizontal: 12, justifyContent: 'space-around' }}>
            <Drop index={state.index} centers={centers} color={c.ink} compact={compact} />
            {state.routes.map((route, i) => {
              const on = state.index === i;
              const tab = TABS[route.name];
              const pill = route.name === 'Kode';
              return (
                <Tap
                  key={route.key}
                  onLayout={(e) => {
                    const { x, width: w } = e.nativeEvent.layout;
                    setCenters((prev) => {
                      const next = [...prev];
                      next[i] = x + w / 2;
                      return next;
                    });
                  }}
                  testID={`tab-${route.name}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={tab.label}
                  feedback="select"
                  scaleTo={0.92}
                  onPress={() => {
                    if (compact) compact.value = withTiming(0, { duration: 200 });
                    const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!on && !e.defaultPrevented) navigation.navigate(route.name, route.params);
                  }}
                  style={[
                    { width: pill ? 54 : 46, height: pill ? 54 : 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
                    pill && { backgroundColor: c['primary-bg'], ...material.press[scheme] },
                  ]}
                >
                  <TabIcon icon={tab.icon} on={on} color={pill ? c['primary-fg'] : on ? c.ink : c['tab-off']} />
                </Tap>
              );
            })}
          </View>
        </Glass>
      </Animated.View>
    </View>
  );
}

/** L'icône grossit d'un rien quand l'onglet devient actif. */
function TabIcon({ icon, on, color }: { icon: IconName; on: boolean; color: string }) {
  const k = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    k.value = withSpring(on ? 1 : 0, motion.spring);
  }, [on, k]);
  const grow = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.08 * k.value }] }));
  return (
    <Animated.View style={grow}>
      <Icon name={icon} size={23} color={color} strokeWidth={on ? 1.9 : 1.7} />
    </Animated.View>
  );
}

const DOT = 4;
/** Le bord qui mène file vite, celui qui suit traîne : la goutte s'étire puis se resserre. */
const LEAD = { damping: 18, stiffness: 420, mass: 0.6 };
const TRAIL = { damping: 20, stiffness: 150, mass: 0.9 };

/** Le point de l'onglet actif, commun à toute la barre. */
function Drop({ index, centers, color, compact }: { index: number; centers: number[]; color: string; compact: SharedValue<number> | null }) {
  const reduced = useReducedMotion();
  const left = useSharedValue(0);
  const right = useSharedValue(0);
  const seen = useSharedValue(0);
  const last = useRef<number | null>(null);
  const cx = centers[index];
  useEffect(() => {
    if (cx === undefined) return;
    const l = cx - DOT / 2;
    const r = cx + DOT / 2;
    const from = last.current;
    last.current = index;
    // Premier placement, barre qui se resserre, ou animations réduites : le point se pose sans voyager.
    if (from === null || from === index || reduced) {
      left.value = l;
      right.value = r;
      seen.value = withTiming(1, { duration: 200 });
      return;
    }
    const goingRight = index > from;
    left.value = withSpring(l, goingRight ? TRAIL : LEAD);
    right.value = withSpring(r, goingRight ? LEAD : TRAIL);
  }, [cx, index, reduced, left, right, seen]);
  // Barre resserrée : les onglets se rapprochent, le point s'efface le temps qu'elle revienne.
  const style = useAnimatedStyle(() => ({ opacity: seen.value * (1 - (compact?.value ?? 0)), left: left.value, width: Math.max(DOT, right.value - left.value) }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: '50%', marginTop: 15, height: DOT, borderRadius: DOT / 2, backgroundColor: color }, style]} />;
}
