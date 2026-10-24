import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions, useNavigation } from '@react-navigation/native';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { motion, space } from '../theme/tokens';
import { T } from '../ui/T';
import { Button } from '../ui/Button';
import { HeaderShell } from '../ui/layout';
import { BrandMark } from '../ui/Logo';
import { DotChip, Tag } from '../ui/bits';
import { AccountSheet } from '../ui/account';
import { Garment, type GarmentKind } from '../ui/Garment';
import { photo } from '../data/photos';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import { Kodi } from '../ui/Kodi';
import type { Nav } from '../navigation/types';

// De vraies pièces, détourées (07/10) : le portant montre ce que Kodi fera des tiennes.
const RAIL: { kind: GarmentKind; image: string; label: string }[] = [
  { kind: 'veste', image: photo('blouson-noir'), label: 'Blouson zippé noir' },
  { kind: 'pull', image: photo('pull-marine'), label: 'Pull marine en maille' },
  { kind: 'cardigan', image: photo('cardigan-chocolat'), label: 'Cardigan chocolat' },
  { kind: 'jean', image: photo('jean-large'), label: 'Jean large clair' },
];

const CHIPS = ['détourage', 'tenue du jour', 'météo', 'agenda', 'coût par port'];

/**
 * L'accueil avant le compte (version cartes, 05/10) : la capsule en haut, un
 * grand titre, deux boutons empilés, le portant en carte, ce que fait Kodi
 * en puces. Peu de mots : le portant parle.
 */
export function Welcome() {
  const { a } = useStore();
  const nav = useNavigation<Nav>();
  const [login, setLogin] = useState(false);
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { width } = useScreen();
  const size = Math.round((width - space.gutter * 2) * 0.24);

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-welcome">
      <Ambient />
      <View style={{ position: 'absolute', top: insets.top + 6, left: space.lg, right: space.lg, zIndex: 10 }}>
        <HeaderShell>
          <View className="flex-row items-center justify-between" style={{ flex: 1, paddingLeft: 20, paddingRight: 6 }}>
            <BrandMark />
            <Button testID="welcome-login" label="Connexion" variant="quiet" size="m" onPress={() => setLogin(true)} />
          </View>
        </HeaderShell>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6 + 56 + 24, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 24, gap: 16, alignItems: 'center' }}>
        {/* Kodi se présente (refonte du 21/10, comme Bienvenue sur le web). */}
        <View style={{ alignItems: 'center', gap: 12, alignSelf: 'stretch' }}>
          <Kodi mood="wave" size={96} track shadow enter testID="welcome-kodi" />
          <View style={{ backgroundColor: c.butter, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12 }}>
            <T v="body" style={{ color: c['butter-ink'], textAlign: 'center' }}>
              Salut ! Moi c’est <T v="bodyStrong" style={{ color: c['butter-ink'] }}>Kodi</T>, ton styliste de poche.
            </T>
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={{ gap: 12, alignItems: 'center' }}>
          <T v="hero" style={{ fontSize: 40, lineHeight: 44, textAlign: 'center' }} accessibilityRole="header">
            Porte mieux ce que tu as.
          </T>
          <T v="body" tone="ink2" style={{ textAlign: 'center' }}>
            Une photo, et Kodi range ta pièce.
          </T>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).duration(500)} style={{ alignSelf: 'stretch', gap: 8, paddingTop: 6 }}>
          {/* Le questionnaire remplace l'accueil au lieu de s'empiler dessus : sur
              iPhone, la pile native peut figer l'écran quand on retire
              plusieurs écrans d'un coup en entrant dans l'app. */}
          <Button testID="welcome-start" label="Commencer" onPress={() => nav.dispatch(StackActions.replace('Onboarding'))} />
          <Button testID="welcome-demo" label="Voir la démo" variant="secondary" onPress={a.loginDemo} />
        </Animated.View>

        <View style={[{ alignSelf: 'stretch', borderRadius: 28, backgroundColor: c.stage, overflow: 'hidden', paddingTop: 44, paddingBottom: 18, marginTop: 8 }]}>
          <View style={{ position: 'absolute', top: 14, left: 14 }}>
            <Tag label="Ton portant" tone="glass" />
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 46, height: 1.5, backgroundColor: c.rod }} />
          <View className="flex-row justify-center" style={{ gap: 2 }}>
            {RAIL.map((g, i) => (
              <Drop key={g.kind + i} i={i}>
                <Garment kind={g.kind} image={g.image} label={g.label} size={size} hanger hangerColor={c.rod} dark={scheme === 'dark'} />
              </Drop>
            ))}
          </View>
        </View>

        <View className="flex-row flex-wrap justify-center" style={{ gap: 6 }}>
          {CHIPS.map((x) => (
            <DotChip key={x} label={x} />
          ))}
        </View>
      </ScrollView>

      <AccountSheet
        visible={login}
        onClose={() => setLogin(false)}
        onDone={(next) => {
          setLogin(false);
          // Compte vierge (questionnaire jamais rempli) : on le remplit maintenant.
          if (next !== 'app') nav.dispatch(StackActions.replace('Onboarding'));
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
    o.value = withDelay(d, withSpring(1, motion.gentle));
    y.value = withDelay(d, withSpring(0, { damping: 27, stiffness: 180 }));
    r.value = withDelay(d, withSequence(withSpring(i % 2 ? -6 : 6, { damping: 22, stiffness: 120 }), withSpring(0, motion.swing)));
  }, [i, o, r, y, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }, { rotate: `${r.value}deg` }] }));
  return <Animated.View style={[{ transformOrigin: 'top' }, style]}>{children}</Animated.View>;
}
