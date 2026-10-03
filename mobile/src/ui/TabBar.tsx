import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { material } from '../theme/tokens';
import { Glass } from './Glass';
import { useScreen } from './screen';
import { Icon, type IconName } from './Icon';
import { T } from './T';
import { Tap } from './Tap';

const TABS: Record<string, { label: string; icon: IconName }> = {
  Home: { label: 'Accueil', icon: 'home' },
  Dressing: { label: 'Dressing', icon: 'dressing' },
  Kode: { label: 'Kode', icon: 'kode' },
  Agenda: { label: 'Agenda', icon: 'calendar' },
  Me: { label: 'Moi', icon: 'person' },
};

/** Le rond noir de Kode, au centre de la barre. */
const KODE = 42;

/**
 * Barre d'onglets (web : components/TabBar.tsx), décision du 03/10 : une
 * capsule de verre qui flotte au-dessus du contenu, comme sur iOS 26. Cinq
 * icônes ; l'onglet actif passe en icône pleine et affiche son nom dessous,
 * les autres restent au trait, sans texte. Kode au centre, dans un rond noir.
 * Chaque onglet garde son libellé pour les lecteurs d'écran.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width } = useScreen();
  const bottom = (insets.bottom > 0 ? insets.bottom - 8 : 0) + material.tabBottom;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom, alignItems: 'center' }}>
      <Glass radius={999} style={{ width: Math.min(width - 32, 390), height: material.tabHeight }}>
        <View accessibilityRole="tablist" className="flex-row" style={{ flex: 1, paddingHorizontal: 6 }}>
          {state.routes.map((route, i) => {
            const on = state.index === i;
            const tab = TABS[route.name];
            const kode = route.name === 'Kode';
            const press = () => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!on && !e.defaultPrevented) navigation.navigate(route.name, route.params);
            };
            return (
              <Tap
                key={route.key}
                testID={`tab-${route.name}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={tab.label}
                feedback="select"
                scaleTo={0.94}
                onPress={press}
                outerStyle={{ flex: 1 }}
                style={{ height: material.tabHeight, alignItems: 'center', justifyContent: 'center' }}
              >
                {kode ? (
                  <View style={{ width: KODE, height: KODE, borderRadius: KODE / 2, backgroundColor: c['primary-bg'] }} className="items-center justify-center">
                    <Icon name="kode" size={22} color={c['primary-fg']} filled={on} />
                  </View>
                ) : (
                  <Icon name={tab.icon} size={24} color={on ? c.ink : c['tab-off']} filled={on} />
                )}
                {/* Le nom ne s'affiche que sous l'onglet actif. */}
                <View style={{ height: 15, marginTop: kode ? 1 : 3, justifyContent: 'center' }}>
                  {on && (
                    <Animated.View entering={reduced ? undefined : FadeIn.duration(180)} exiting={reduced ? undefined : FadeOut.duration(100)}>
                      <T v="tab" importantForAccessibility="no" accessibilityElementsHidden>
                        {tab.label}
                      </T>
                    </Animated.View>
                  )}
                </View>
              </Tap>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}
