import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { material } from '../theme/tokens';
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

/** Le rond de Kode, seule forme ronde de l'app : il déborde un peu au-dessus de la barre. */
const KODE = 50;

/**
 * Barre d'onglets de la galerie (web : components/TabBar.tsx) : plate, collée
 * en bas, blanche (noire en sombre) sous un filet d'un pixel. Cinq icônes ;
 * l'onglet actif passe en icône pleine et affiche son nom dessous, les autres
 * restent au trait, sans texte. Kode au centre, dans un rond noir. Chaque
 * onglet garde son libellé pour les lecteurs d'écran.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  return (
    <View
      accessibilityRole="tablist"
      className="flex-row"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: material.tabHeight + insets.bottom, paddingBottom: insets.bottom, backgroundColor: c.paper, borderTopWidth: 1, borderColor: c.rule }}
    >
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
            style={{ height: material.tabHeight, alignItems: 'center', justifyContent: kode ? 'flex-end' : 'flex-start', paddingTop: kode ? 0 : 9, paddingBottom: kode ? 5 : 0 }}
          >
            {kode ? (
              <View
                style={{ position: 'absolute', top: -KODE / 2 + 6, width: KODE, height: KODE, borderRadius: KODE / 2, backgroundColor: c['primary-bg'], borderWidth: 3, borderColor: c.paper }}
                className="items-center justify-center"
              >
                <Icon name="kode" size={24} color={c['primary-fg']} filled={on} />
              </View>
            ) : (
              <Icon name={tab.icon} size={24} color={on ? c.ink : c['tab-off']} filled={on} />
            )}
            {/* Le nom ne s'affiche que sous l'onglet actif. */}
            <View style={{ height: 16, marginTop: kode ? 0 : 3, justifyContent: 'center' }}>
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
  );
}
