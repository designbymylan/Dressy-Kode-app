import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { material } from '../theme/tokens';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { Tap } from './Tap';
import { useTabCompact } from './layout';

const TABS: Record<string, { label: string; icon: IconName }> = {
  Home: { label: 'Accueil', icon: 'home' },
  Dressing: { label: 'Dressing', icon: 'hanger' },
  Kode: { label: 'Kode', icon: 'kode' },
  Agenda: { label: 'Agenda', icon: 'calendar' },
  Me: { label: 'Moi', icon: 'person' },
};

/**
 * Barre d'onglets flottante en verre : cinq destinations, toujours
 * libellées (HIG), qui se replie quand on descend dans une page et revient
 * dès qu'on remonte. Elle ne porte que de la navigation, aucune action.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const compact = useTabCompact();
  const bottom = insets.bottom > 0 ? material.tabBottom : 12;

  useEffect(() => {
    if (compact) compact.value = withTiming(0, { duration: 200 });
  }, [state.index, compact]);

  const bar = useAnimatedStyle(() => {
    const k = compact?.value ?? 0;
    return { height: interpolate(k, [0, 1], [material.tabHeight, 50]), marginHorizontal: interpolate(k, [0, 1], [16, 40]) };
  });
  const label = useAnimatedStyle(() => ({ opacity: interpolate(compact?.value ?? 0, [0, 0.6], [1, 0], 'clamp'), height: interpolate(compact?.value ?? 0, [0, 1], [13, 0]) }));

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom }}>
      <Animated.View style={bar}>
        <Glass radius={32} style={{ flex: 1 }}>
          <View accessibilityRole="tablist" className="flex-row" style={{ flex: 1, padding: 6 }}>
            {state.routes.map((route, i) => {
              const on = state.index === i;
              const tab = TABS[route.name];
              return (
                <Tap
                  key={route.key}
                  testID={`tab-${route.name}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={tab.label}
                  feedback="select"
                  scaleTo={0.94}
                  onPress={() => {
                    if (compact) compact.value = withTiming(0, { duration: 200 });
                    const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!on && !e.defaultPrevented) navigation.navigate(route.name, route.params);
                  }}
                  outerStyle={{ flex: 1 }}
                  style={{ flex: 1, borderRadius: 26, backgroundColor: on ? c.pill : 'transparent' }}
                  className="items-center justify-center"
                >
                  <Icon name={tab.icon} size={24} color={on ? c.ink : c['tab-off']} strokeWidth={on ? 1.8 : 1.6} />
                  <Animated.Text
                    style={[{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 10.5, lineHeight: 13, marginTop: 2, color: on ? c.ink : c['tab-off'] }, label]}
                    maxFontSizeMultiplier={1.3}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Animated.Text>
                </Tap>
              );
            })}
          </View>
        </Glass>
      </Animated.View>
    </View>
  );
}
