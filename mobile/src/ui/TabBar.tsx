import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { material, motion } from '../theme/tokens';
import { F } from '../theme/fonts';
import { Icon, NAV_LINES, type IconName } from './Icon';
import { Kodi, type KodiLook, type KodiMood } from './Kodi';
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
/** La bosse : 132 de large, la même courbe que sur le web (globals.css, `.dk-nav__bump`). */
const HILL = 132;
/** Le rond de verre flouté sous la bosse : il tient dans la colline sans en dépasser. */
const DOME = 30;

/**
 * Le contour de la barre et de sa bosse, pour une largeur donnée (web :
 * components/TabBar.tsx, `silhouette`) : la courbe de la bosse posée au
 * milieu d'un rectangle aux coins de 24.
 */
function silhouette(w: number): string {
  const r = RADIUS;
  const x = w / 2 - HILL / 2;
  return [
    `M${r} 0H${x}`,
    `C${x + 18} 0 ${x + 30} -2.8 ${x + 38} -11.2`,
    `C${x + 46} -20.53 ${x + 54} -26.13 ${x + 66} -26.13`,
    `C${x + 78} -26.13 ${x + 86} -20.53 ${x + 94} -11.2`,
    `C${x + 102} -2.8 ${x + 114} 0 ${x + 132} 0`,
    `H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${HEIGHT - r}A${r} ${r} 0 0 1 ${w - r} ${HEIGHT}`,
    `H${r}A${r} ${r} 0 0 1 0 ${HEIGHT - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`,
  ].join('');
}

/**
 * La barre de la référence « Inspiration Navbar » (21/10, web :
 * components/TabBar.tsx), élément par élément : barre de verre arrondie,
 * bosse centrale qui porte le rond chocopie de Kodi, petit trait au-dessus
 * de l'onglet actif qui glisse d'un onglet à l'autre, icône au trait qui
 * devient pleine et bleue, tous les noms écrits. Kodi regarde l'onglet
 * choisi et sursaute quand on en change. Elle reste en verre (décision du
 * 03/10) : un flou sous la barre et un autre sous la bosse, recouverts de la
 * teinte du verre dense, que le contour dessine d'un seul trait.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c, scheme, solidGlass } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useScreen();
  const w = Math.min(width - 24, 406);
  const bottom = (insets.bottom > 0 ? insets.bottom - 8 : 0) + material.tabBottom;
  const index = state.index;
  const kodiOn = state.routes[index]?.name === 'Kode';

  const [mood, setMood] = useState<KodiMood>('idle');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setMood(kodiOn ? 'happy' : 'surprised');
    const t = setTimeout(() => setMood('idle'), 900);
    return () => clearTimeout(t);
  }, [index, kodiOn]);
  const look: KodiLook = index < 2 ? 'left' : index > 2 ? 'right' : 'up';

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom, alignItems: 'center' }}>
      <View style={[{ width: w, height: HEIGHT + BUMP }, material.shadow[scheme]]}>
        {/* Le verre : un flou sous la barre, un autre sous la bosse (coupé au ras de la barre, pour ne pas doubler). */}
        {!solidGlass && (
          <>
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: BUMP, height: HEIGHT, borderRadius: RADIUS, overflow: 'hidden' }}>
              <BlurView intensity={material.blur * 2} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            </View>
            <View pointerEvents="none" style={{ position: 'absolute', left: w / 2 - DOME, top: 0, width: DOME * 2, height: BUMP, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', left: 0, top: BUMP - 26.13, width: DOME * 2, height: DOME * 2, borderRadius: DOME, overflow: 'hidden' }}>
                <BlurView intensity={material.blur * 2} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              </View>
            </View>
          </>
        )}
        <Svg pointerEvents="none" width={w} height={HEIGHT + BUMP} viewBox={`0 ${-BUMP} ${w} ${HEIGHT + BUMP}`} style={StyleSheet.absoluteFill}>
          <Path d={silhouette(w)} fill={solidGlass ? c.raised : c['glass-strong']} stroke={solidGlass ? c.rule : c['card-edge']} strokeWidth={1} />
        </Svg>

        <View accessibilityRole="tablist" style={{ position: 'absolute', left: 0, right: 0, top: BUMP, height: HEIGHT, flexDirection: 'row' }}>
          <Indicator index={index} width={w} hidden={kodiOn} />
          {state.routes.map((route, i) => {
            const on = index === i;
            const tab = TABS[route.name];
            const press = () => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!on && !e.defaultPrevented) navigation.navigate(route.name, route.params);
            };
            if (!tab.icon)
              return (
                <Tap
                  key={route.key}
                  testID={`tab-${route.name}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel="Kodi, ton styliste"
                  feedback="select"
                  scaleTo={0.92}
                  onPress={press}
                  outerStyle={{ flex: 1 }}
                  style={{ height: HEIGHT, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12 }}
                >
                  <Orb>
                    <Kodi size={44} mood={on && mood === 'idle' ? 'wink' : mood} look={look} decorative tap={false} color={c.butter} />
                  </Orb>
                  <T v="tab" style={[{ fontSize: 11.5, lineHeight: 14, color: c['orb-label'] }, on ? F.s600 : F.s500]} accessibilityElementsHidden importantForAccessibility="no">
                    {tab.label}
                  </T>
                </Tap>
              );
            return (
              <Tap
                key={route.key}
                testID={`tab-${route.name}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={tab.label}
                feedback="select"
                scaleTo={0.88}
                onPress={press}
                outerStyle={{ flex: 1 }}
                style={{ height: HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 6 }}
              >
                <TabIcon icon={tab.icon} on={on} idle={c['tab-off']} active={c['blue-ink']} />
                <T v="tab" style={[{ fontSize: 11.5, lineHeight: 14, color: on ? c['blue-ink'] : c['tab-off'] }, on ? F.s600 : F.s500]} numberOfLines={1}>
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

/** Le rond chocopie de Kodi, posé sur la bosse. */
function Orb({ children }: { children: ReactNode }) {
  const { c, scheme } = useTheme();
  const glow =
    scheme === 'dark'
      ? { shadowColor: c.butter, shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }
      : { shadowColor: c.choco, shadowOpacity: 0.42, shadowRadius: 11, shadowOffset: { width: 0, height: 8 } };
  return (
    <View style={[{ position: 'absolute', top: -24, left: '50%', marginLeft: -28, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }, glow]}>
      <Svg width={56} height={56} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="kodi-orb" cx="35%" cy="25%" r="70%">
            {/* Un reflet en haut à gauche ; le rond reste chocopie en clair comme en sombre. */}
            <Stop offset="0" stopColor="#5B4342" />
            <Stop offset="0.88" stopColor={c.choco} />
          </RadialGradient>
        </Defs>
        <Circle cx={28} cy={28} r={28} fill="url(#kodi-orb)" />
      </Svg>
      {children}
    </View>
  );
}

/** L'icône de l'onglet : au trait au repos, pleine et bleue quand il est choisi. */
function TabIcon({ icon, on, idle, active }: { icon: IconName; on: boolean; idle: string; active: string }) {
  const reduced = useReducedMotion();
  const k = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    k.value = reduced ? withTiming(on ? 1 : 0, { duration: 160 }) : withSpring(on ? 1 : 0, motion.spring);
  }, [on, k, reduced]);
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * k.value }] }));
  const line = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, k.value), transform: [{ scale: 1 + 0.3 * k.value }] }));
  const solid = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, k.value)), transform: [{ scale: 0.5 + 0.5 * k.value }] }));
  const box = { position: 'absolute' as const, left: 0, top: 0, width: 24, height: 24 };
  return (
    <Animated.View style={[{ width: 24, height: 24 }, lift]}>
      <Animated.View style={[box, line]}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d={NAV_LINES[icon]} stroke={idle} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[box, solid]}>
        <Icon name={icon} size={24} color={active} still />
      </Animated.View>
    </Animated.View>
  );
}

/** Le petit trait au-dessus de l'onglet actif, qui glisse ; il s'efface sous Kodi. */
function Indicator({ index, width, hidden }: { index: number; width: number; hidden: boolean }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const x = useSharedValue(index);
  const shown = useSharedValue(hidden ? 0 : 1);
  useEffect(() => {
    x.value = reduced ? index : withSpring(index, { damping: 16, stiffness: 180, mass: 0.8 });
    shown.value = withTiming(hidden ? 0 : 1, { duration: 200 });
  }, [index, hidden, reduced, x, shown]);
  const col = width / 5;
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateX: x.value * col + col / 2 - 8 }, { scaleX: 0.2 + 0.8 * shown.value }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 7, left: 0, width: 16, height: 3, borderRadius: 2, backgroundColor: c['nav-ind'] }, style]} />;
}
