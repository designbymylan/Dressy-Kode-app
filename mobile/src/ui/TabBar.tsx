import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { material, motion } from '../theme/tokens';
import { F } from '../theme/fonts';
import { Icon, type IconName } from './Icon';
import { Orb } from './Orb';
import { T } from './T';
import { Tap } from './Tap';
import { useScreen } from './screen';

const TABS: Record<string, { label: string; icon: IconName | null }> = {
  Home: { label: 'Accueil', icon: 'home' },
  Dressing: { label: 'Dressing', icon: 'hanger' },
  Kode: { label: 'Kodi', icon: null },
  Agenda: { label: 'Calendrier', icon: 'calendar' },
  Me: { label: 'Profil', icon: 'person' },
};

const HEIGHT = material.tabHeight;
const BUMP = 30;
const RADIUS = 24;

/**
 * Le contour de la barre et de sa bosse (même tracé que le web,
 * components/TabBar.tsx) : une bosse de 132 × 26 au milieu d'un rectangle
 * aux coins de 24.
 */
function silhouette(w: number): string {
  const r = RADIUS;
  const x = w / 2 - 66;
  const top = BUMP;
  const y = (v: number) => v + top;
  return [
    `M${r} ${y(0)}H${x}`,
    `C${x + 18} ${y(0)} ${x + 30} ${y(-2.8)} ${x + 38} ${y(-11.2)}`,
    `C${x + 46} ${y(-20.53)} ${x + 54} ${y(-26.13)} ${x + 66} ${y(-26.13)}`,
    `C${x + 78} ${y(-26.13)} ${x + 86} ${y(-20.53)} ${x + 94} ${y(-11.2)}`,
    `C${x + 102} ${y(-2.8)} ${x + 114} ${y(0)} ${x + 132} ${y(0)}`,
    `H${w - r}A${r} ${r} 0 0 1 ${w} ${y(r)}V${y(HEIGHT - r)}A${r} ${r} 0 0 1 ${w - r} ${y(HEIGHT)}`,
    `H${r}A${r} ${r} 0 0 1 0 ${y(HEIGHT - r)}V${y(r)}A${r} ${r} 0 0 1 ${r} ${y(0)}Z`,
  ].join('');
}

/**
 * La barre du 21/10 (« Inspiration Navbar 1 », même dessin que le web) :
 * barre de verre arrondie, bosse au centre qui porte un petit trait
 * au-dessus de l'onglet actif qui glisse d'un onglet à l'autre, icône au
 * trait qui devient pleine et bleue, tous les noms écrits. Au centre,
 * l'orbe de Kodi (25/10) : il tourne, et ouvre la conversation au toucher.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c, scheme, solidGlass } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width } = useScreen();
  const full = Math.min(width - 24, 406);
  const bottom = (insets.bottom > 0 ? insets.bottom - 8 : 0) + material.tabBottom;
  const index = state.index;
  const col = full / state.routes.length;

  // Le petit trait au-dessus de l'onglet actif, qui glisse.
  const centerIndex = state.routes.findIndex((r) => r.name === 'Kode');
  const ind = useSharedValue(index * col + col / 2 - 8);
  const indShown = useSharedValue(index === centerIndex ? 0 : 1);
  useEffect(() => {
    const to = index * col + col / 2 - 8;
    ind.value = reduced ? to : withTiming(to, { duration: motion.duration.base, easing: motion.easing });
    indShown.value = withTiming(index === centerIndex ? 0 : 1, { duration: 200 });
  }, [index, col, centerIndex, reduced, ind, indShown]);
  const indStyle = useAnimatedStyle(() => ({ transform: [{ translateX: ind.value }, { scaleX: 0.2 + 0.8 * indShown.value }], opacity: indShown.value }));

  const fill = solidGlass ? c.raised : scheme === 'dark' ? 'rgba(28,28,30,0.78)' : 'rgba(255,255,255,0.80)';
  const edge = scheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)';

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom, alignItems: 'center' }}>
      <View style={{ width: full, height: HEIGHT + BUMP }}>
        {/* Le verre : flou sous la barre, puis la silhouette teintée et son contour ; l'ombre suit la forme. */}
        {!solidGlass && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: HEIGHT, borderRadius: RADIUS, overflow: 'hidden' }}>
            <BlurView intensity={material.blur * 2} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          </View>
        )}
        {/* Sur iPhone, l'ombre suit la silhouette dessinée ; dans l'aperçu web, une ombre CSS de la même forme. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, Platform.OS === 'web' ? ({ filter: `drop-shadow(0 10px 18px rgba(0,0,0,${scheme === 'dark' ? 0.55 : 0.14}))` } as object) : material.shadow[scheme]]}>
          <Svg width={full} height={HEIGHT + BUMP}>
            <Path d={silhouette(full)} fill={fill} stroke={edge} strokeWidth={1} />
          </Svg>
        </View>

        <View accessibilityRole="tablist" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: HEIGHT, flexDirection: 'row' }}>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 7, left: 0, width: 16, height: 3, borderRadius: 2, backgroundColor: c['nav-ind'] }, indStyle]} />
          {state.routes.map((route, i) => {
            const on = index === i;
            const tab = TABS[route.name] ?? { label: route.name, icon: 'home' as IconName };
            const press = () => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!on && !e.defaultPrevented) navigation.navigate(route.name, route.params);
            };
            if (!tab.icon) {
              return (
                <Tap
                  key={route.key}
                  testID={`tab-${route.name}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel="Kodi, ton styliste"
                  feedback="medium"
                  scaleTo={0.92}
                  onPress={press}
                  outerStyle={{ flex: 1 }}
                  style={{ height: HEIGHT, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12 }}
                >
                  <View style={{ position: 'absolute', top: -24, alignSelf: 'center', width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
                    <Orb size={46} />
                  </View>
                  <T v="tab" style={[{ fontSize: 11.5, color: on ? (scheme === 'dark' ? c.butter : c.choco) : c['nav-idle'] }, on && F.s600]}>
                    {tab.label}
                  </T>
                </Tap>
              );
            }
            return (
              <Tap
                key={route.key}
                testID={`tab-${route.name}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={tab.label}
                feedback="select"
                scaleTo={0.9}
                onPress={press}
                outerStyle={{ flex: 1 }}
                style={{ height: HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 6 }}
              >
                <TabIcon icon={tab.icon} on={on} idle={c['nav-idle-icon']} active={c['nav-active']} />
                <T v="tab" style={[{ fontSize: 11.5, color: on ? c['nav-active'] : c['nav-idle'] }, on && F.s600]} numberOfLines={1}>
                  {tab.label}
                </T>
              </Tap>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** L'icône au trait devient pleine et bleue, en remontant d'un rien. */
function TabIcon({ icon, on, idle, active }: { icon: IconName; on: boolean; idle: string; active: string }) {
  const k = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    k.value = withSpring(on ? 1 : 0, motion.spring);
  }, [on, k]);
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * k.value }] }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: 1 - k.value, transform: [{ scale: 1 + 0.3 * k.value }] }));
  const solidStyle = useAnimatedStyle(() => ({ opacity: k.value, transform: [{ scale: 0.5 + 0.5 * k.value }] }));
  return (
    <Animated.View style={[{ width: 24, height: 24 }, lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, lineStyle]}>
        <Icon name={icon} size={24} color={idle} strokeWidth={1.8} line />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, solidStyle]}>
        <Icon name={icon} size={24} color={active} />
      </Animated.View>
    </Animated.View>
  );
}
