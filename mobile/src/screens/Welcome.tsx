import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions, useNavigation } from '@react-navigation/native';
import { useStore } from '../state/store';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Monogram } from '../ui/Logo';
import { AccountSheet } from '../ui/account';
import { useScreen } from '../ui/screen';
import { WELCOME_PHOTOS, nextWelcomePhoto } from '../data/welcome';
import type { Nav } from '../navigation/types';

// Le texte posé sur la photo reste blanc, en clair comme en sombre : la photo ne suit pas le thème.
const WHITE = '#FFFFFF';

/**
 * L'accueil avant le compte (24/10), sur le modèle des écrans de
 * connexion envoyés : une photo de mode verticale en plein écran, tirée au
 * hasard à chaque arrivée, un voile sombre en bas, DRESSKODE en grand et
 * deux boutons. Rien d'autre : la photo parle.
 */
export function Welcome() {
  const { a } = useStore();
  const nav = useNavigation<Nav>();
  const [login, setLogin] = useState(false);
  const [idx] = useState(nextWelcomePhoto);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width, height } = useScreen();

  // La photo avance très lentement, comme un plan fixe qui respire.
  const zoom = useSharedValue(1);
  useEffect(() => {
    if (!reduced) zoom.value = withTiming(1.07, { duration: 16000, easing: Easing.out(Easing.quad) });
  }, [reduced, zoom]);
  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} testID="screen-welcome">
      <StatusBar style="light" />
      <Animated.View entering={FadeIn.duration(600)} style={[StyleSheet.absoluteFill, zoomStyle]}>
        <Image source={WELCOME_PHOTOS[idx]} resizeMode="cover" style={{ width, height }} accessible={false} />
      </Animated.View>

      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity="0.32" />
            <Stop offset="0.18" stopColor="#000" stopOpacity="0" />
            <Stop offset="0.42" stopColor="#000" stopOpacity="0" />
            <Stop offset="0.78" stopColor="#000" stopOpacity="0.72" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.9" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#shade)" />
      </Svg>

      <Animated.View
        entering={FadeInDown.delay(250).duration(600)}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 20, gap: 8 }}
      >
        <View accessible accessibilityRole="header" accessibilityLabel="Dresskode" style={{ alignItems: 'center', gap: 14, paddingBottom: 18 }}>
          <Monogram size={46} tone="on-panel" />
          <T v="brand" numberOfLines={1} adjustsFontSizeToFit style={{ color: WHITE, fontSize: 30, lineHeight: 36 }}>
            DRESSKODE
          </T>
          <T v="body" style={{ color: 'rgba(255,255,255,0.82)', textAlign: 'center' }}>
            Porte mieux ce que tu as.
          </T>
        </View>

        {/* Le questionnaire remplace l'accueil au lieu de s'empiler dessus : sur
            iPhone, la pile native peut figer l'écran quand on retire
            plusieurs écrans d'un coup en entrant dans l'app. */}
        <Button testID="welcome-start" label="Commencer" onPress={() => nav.dispatch(StackActions.replace('Onboarding'))} />
        <Button testID="welcome-login" label="Se connecter" variant="secondary" onPress={() => setLogin(true)} />
        <Tap
          testID="welcome-demo"
          onPress={a.loginDemo}
          accessibilityRole="button"
          accessibilityLabel="Voir la démo"
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <T v="body" style={{ color: 'rgba(255,255,255,0.82)', textDecorationLine: 'underline' }}>
            Voir la démo
          </T>
        </Tap>
      </Animated.View>

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
