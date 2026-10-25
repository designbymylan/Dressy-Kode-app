import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Button } from '../ui/Button';
import { Monogram } from '../ui/Logo';
import { EmailField, FormError, PasswordField, SignupTerms, useAccountForm } from '../ui/account';
import { useScreen } from '../ui/screen';
import { online } from '../state/remote';
import { WELCOME_PHOTOS, nextWelcomePhoto } from '../data/welcome';
import type { Nav } from '../navigation/types';

/**
 * La page de connexion, première chose vue sans compte (sans session, après
 * une déconnexion aussi) : une photo de mode plein écran, tirée au hasard, et
 * par-dessus une carte aux couleurs de l'app. La connexion est dans la carte,
 * pas dans une feuille qui s'ouvrirait toute seule ; « Commencer sans compte »
 * mène au questionnaire. Pas de démonstration ici.
 */
export function Welcome() {
  const nav = useNavigation<Nav>();
  const [idx] = useState(nextWelcomePhoto);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { c } = useTheme();
  const { width, height } = useScreen();

  // La photo avance très lentement, comme un plan fixe qui respire.
  const zoom = useSharedValue(1);
  useEffect(() => {
    if (!reduced) zoom.value = withTiming(1.07, { duration: 16000, easing: Easing.out(Easing.quad) });
  }, [reduced, zoom]);
  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));

  // Une fois le compte créé (ou connecté) sans questionnaire rempli : on le remplit maintenant.
  const f = useAccountForm('login', (next) => {
    if (next !== 'app') nav.dispatch(StackActions.replace('Onboarding'));
  });
  const commencer = () => nav.dispatch(StackActions.replace('Onboarding'));

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} testID="screen-welcome">
      <StatusBar style="light" />
      <Animated.View entering={FadeIn.duration(600)} style={[StyleSheet.absoluteFill, zoomStyle]}>
        <Image source={WELCOME_PHOTOS[idx]} resizeMode="cover" style={{ width, height }} accessible={false} />
      </Animated.View>

      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="0.25">
            <Stop offset="0" stopColor="#000" stopOpacity="0.32" />
            <Stop offset="1" stopColor="#000" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#shade)" />
      </Svg>

      {/* La carte remonte avec le clavier ; défilante si elle ne tient pas sur un petit écran. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View entering={FadeInDown.delay(250).duration(600)} style={{ backgroundColor: c.paper, borderTopLeftRadius: 32, borderTopRightRadius: 32 }}>
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false} style={{ maxHeight: height * 0.82 }} contentContainerStyle={{ paddingTop: 22, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 14, gap: 8 }}>
            <View accessible accessibilityRole="header" accessibilityLabel="Dresskode" style={{ alignItems: 'center', gap: 6, paddingBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Monogram size={30} />
                <T v="brand" numberOfLines={1} style={{ fontSize: 26, lineHeight: 32 }}>
                  DRESSKODE
                </T>
              </View>
              <T v="body" tone="ink2">
                Porte mieux ce que tu as.
              </T>
            </View>

            {!online ? (
              <T v="body" tone="ink2" style={{ textAlign: 'center' }}>
                Cet aperçu tourne sans serveur : la connexion n’y est pas branchée.
              </T>
            ) : f.sent ? (
              <>
                <T v="section">Regarde tes e-mails</T>
                <T v="body" tone="ink2">
                  On vient d’envoyer un lien à {f.sent}. Touche-le pour confirmer ton adresse, puis reviens te connecter ici : ton espace sera enregistré sur ton compte.
                </T>
                <Button testID="signup-sent-ok" label="C’est noté" onPress={() => { f.setSent(null); commencer(); }} />
              </>
            ) : (
              <>
                <EmailField testID="login-email" value={f.email} onChange={f.setEmail} />
                <PasswordField testID="login-password" value={f.password} onChange={f.setPassword} onSubmit={f.submit} isNew={f.mode === 'signup'} />
                {f.mode === 'signup' && <SignupTerms adult={f.adult} onAdult={f.setAdult} onPolicy={() => nav.navigate('Confidentialite')} />}
                <FormError text={f.error} />
                <Button testID="login-send" label={f.mode === 'login' ? 'Me connecter' : 'Créer mon compte'} disabled={!f.ready} loading={f.busy} onPress={f.submit} />
                <Button
                  testID="login-switch"
                  variant="plain"
                  label={f.mode === 'login' ? 'Pas encore de compte ? En créer un' : 'J’ai déjà un compte'}
                  onPress={() => f.switchTo(f.mode === 'login' ? 'signup' : 'login')}
                />

              </>
            )}

            {/* Le questionnaire remplace l'accueil au lieu de s'empiler dessus : sur
                iPhone, la pile native peut figer l'écran quand on retire
                plusieurs écrans d'un coup en entrant dans l'app. */}
            <Button testID="welcome-start" label="Commencer sans compte" variant="plain" onPress={commencer} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
