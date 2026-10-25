import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
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

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.rule }} />
                  <T v="caption" tone="ink2">
                    ou
                  </T>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.rule }} />
                </View>

                {/* Google et Apple : l'interface seulement, la liaison des comptes n'est pas faite. */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <SocialButton testID="welcome-google" label="Google" glyph={<GoogleG />} />
                  <SocialButton testID="welcome-apple" label="Apple" glyph={<AppleGlyph color={c.ink} />} />
                </View>
                <T v="caption" tone="ink2" style={{ textAlign: 'center' }}>
                  Bientôt disponible
                </T>
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

/** Un bouton de connexion tierce : visible, pas encore branché (désactivé, annoncé comme bientôt disponible). */
function SocialButton({ label, glyph, testID }: { label: string; glyph: ReactNode; testID: string }) {
  const { c } = useTheme();
  return (
    <Tap
      testID={testID}
      disabled
      accessibilityLabel={`Continuer avec ${label}, bientôt disponible`}
      accessibilityState={{ disabled: true }}
      outerStyle={{ flex: 1 }}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: 27, backgroundColor: c.sunk, borderWidth: 1, borderColor: c.rule, opacity: 0.7 }}
    >
      {glyph}
      <T v="button">{label}</T>
    </Tap>
  );
}

function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}>
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.83z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
    </Svg>
  );
}

function AppleGlyph({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}>
      <Path fill={color} d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </Svg>
  );
}
