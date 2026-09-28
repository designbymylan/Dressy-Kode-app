import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, withSpring, withTiming, useSharedValue } from 'react-native-reanimated';
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
 * Barre d'onglets flottante en verre (web : components/TabBar.tsx) : une
 * capsule, cinq icônes ; Kode au centre en pastille encre, l'onglet actif
 * marqué par son icône pleine encre et un point dessous. Les libellés restent
 * pour les lecteurs d'écran. Elle se resserre quand on descend dans une page
 * et revient dès qu'on remonte ; elle ne porte que de la navigation.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const compact = useTabCompact();
  const { width } = useScreen();
  const full = Math.min(width - 40, 390);
  const bottom = (insets.bottom > 0 ? insets.bottom - 8 : 0) + material.tabBottom;

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
            {state.routes.map((route, i) => {
              const on = state.index === i;
              const tab = TABS[route.name];
              const pill = route.name === 'Kode';
              return (
                <Tap
                  key={route.key}
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
                    { width: pill ? 54 : 46, height: pill ? 54 : 46, borderRadius: 999 },
                    pill && { backgroundColor: c['primary-bg'], ...material.press[scheme] },
                  ]}
                  className="items-center justify-center"
                >
                  <TabIcon icon={tab.icon} on={on} color={pill ? c['primary-fg'] : on ? c.ink : c['tab-off']} dot={on && !pill ? c.ink : null} />
                </Tap>
              );
            })}
          </View>
        </Glass>
      </Animated.View>
    </View>
  );
}

/** L'icône grossit d'un rien quand l'onglet devient actif, et un point apparaît dessous. */
function TabIcon({ icon, on, color, dot }: { icon: IconName; on: boolean; color: string; dot: string | null }) {
  const k = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    k.value = withSpring(on ? 1 : 0, motion.spring);
  }, [on, k]);
  const grow = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.08 * k.value }] }));
  const point = useAnimatedStyle(() => ({ opacity: k.value, transform: [{ scale: k.value }] }));
  return (
    <>
      <Animated.View style={grow}>
        <Icon name={icon} size={23} color={color} strokeWidth={on ? 1.9 : 1.7} />
      </Animated.View>
      {dot && <Animated.View style={[{ position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: dot }, point]} />}
    </>
  );
}
