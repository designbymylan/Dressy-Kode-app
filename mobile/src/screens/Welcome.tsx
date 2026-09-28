import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { motion, space } from '../theme/tokens';
import { T } from '../ui/T';
import { Button } from '../ui/Button';
import { Masthead } from '../ui/layout';
import { AccountSheet } from '../ui/account';
import { Garment, type GarmentKind } from '../ui/Garment';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import type { Nav } from '../navigation/types';

const RAIL: { kind: GarmentKind; tint?: string }[] = [
  { kind: 'trench' },
  { kind: 'mariniere' },
  { kind: 'robe', tint: '#B5603A' },
  { kind: 'pull' },
  { kind: 'jean' },
];

export function Welcome() {
  const { a } = useStore();
  const nav = useNavigation<Nav>();
  const [login, setLogin] = useState(false);
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { width } = useScreen();
  const size = Math.round(width * 0.27);

  return (
    <View className="bg-paper" style={{ flex: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }} testID="screen-welcome">
      <Ambient />
      <View style={{ paddingHorizontal: space.gutter }}>
        <Masthead kicker="DRESSKODE" meta="Ta garde-robe, mieux portée" />
      </View>

      <View style={{ flex: 1, justifyContent: 'center', overflow: 'hidden' }}>
        <View style={{ height: size * 1.25 + 20 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 2, height: 1.5, backgroundColor: c.rod }} />
        <View className="flex-row" style={{ paddingHorizontal: space.gutter, gap: 2, width: size * RAIL.length + 60 }}>
          {RAIL.map((g, i) => (
            <Drop key={g.kind + i} i={i}>
              <Garment kind={g.kind} tint={g.tint} size={size} hanger hangerColor={c.rod} dark={scheme === 'dark'} />
            </Drop>
          ))}
        </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: space.gutter, gap: 16 }}>
        <Animated.View entering={FadeInDown.delay(500).duration(500)} style={{ gap: 14 }}>
          <T v="hero" style={{ fontSize: 54, lineHeight: 52 }} accessibilityRole="header">
            Porte mieux,{'\n'}achète{' '}
            <T v="hero" style={{ fontSize: 54, lineHeight: 52, fontFamily: 'Accent' }}>
              moins.
            </T>
          </T>
          <T v="bodyL" tone="ink2">
            Ton dressing en illustrations, et Kode, un styliste qui compose avec ce que tu as déjà, selon la météo et ton agenda.
          </T>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(700).duration(500)} style={{ gap: 6, marginTop: 8 }}>
          <Button testID="welcome-start" label="Commencer" onPress={() => nav.navigate('Onboarding')} />
          <Button
            testID="welcome-login"
            label="J’ai déjà un compte"
            variant="plain"
            onPress={() => setLogin(true)}
          />
          <T v="small" tone="ink2" style={{ textAlign: 'center' }}>
            Environ deux minutes. Seuls ton prénom et ton rayon sont demandés.
          </T>
        </Animated.View>
      </View>

      <AccountSheet
        visible={login}
        onClose={() => setLogin(false)}
        onDone={(next) => {
          setLogin(false);
          // Compte vierge (questionnaire jamais rempli) : on le remplit maintenant.
          if (next !== 'app') nav.navigate('Onboarding');
        }}
        onDemo={a.loginDemo}
      />
    </View>
  );
}

/** Les cintres tombent sur la tringle et se balancent un instant. */
function Drop({ i, children }: { i: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(reduced ? 0 : -80);
  const r = useSharedValue(reduced ? 0 : i % 2 ? 10 : -10);
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    const d = 120 + i * 90;
    o.value = withDelay(d, withSpring(1));
    y.value = withDelay(d, withSpring(0, { damping: 14, stiffness: 180 }));
    r.value = withDelay(d, withSequence(withSpring(i % 2 ? -6 : 6, { damping: 10, stiffness: 120 }), withSpring(0, motion.swing)));
  }, [i, o, r, y, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }, { rotate: `${r.value}deg` }] }));
  return <Animated.View style={[{ transformOrigin: 'top' }, style]}>{children}</Animated.View>;
}
