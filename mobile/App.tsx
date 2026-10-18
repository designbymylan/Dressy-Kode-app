import './global.css';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DefaultTheme, DarkTheme, NavigationContainer, type NavigationState } from '@react-navigation/native';
import { StoreProvider } from './src/state/store';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { PortalHost } from './src/ui/Sheet';
import { ToastHost } from './src/ui/Toast';
import { RootNavigator } from './src/navigation/RootNavigator';
import { PhoneFrame } from './src/web/PhoneFrame';
import { FONT_FILES } from './src/theme/fonts';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import { Rappels } from './src/state/useRappels';
import { Intro } from './src/ui/Intro';

export default function App() {
  // Les trois polices de la charte (assets/fonts) : l'app attend leur
  // chargement, une fraction de seconde. En cas d'échec ou d'attente trop
  // longue, elle s'ouvre quand même avec la police du système plutôt que de
  // rester bloquée sur un écran vide.
  const [loaded, error] = useFonts(FONT_FILES);
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!loaded && !error && !late) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <ThemeProvider>
            <ErrorBoundary>
              <Shell />
            </ErrorBoundary>
          </ThemeProvider>
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const { scheme, c } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: c.paper, card: c.paper, text: c.ink, border: c.rule, primary: c.ink } };
  // Le message de confirmation se pose au-dessus de la barre d'onglets, ou en bas quand il n'y en a pas.
  const [onTabs, setOnTabs] = useState(true);
  const track = (state: NavigationState | undefined) => setOnTabs(state?.routes[state.index]?.name === 'Tabs');
  return (
    <PhoneFrame>
      <PortalHost>
        <NavigationContainer theme={theme} onStateChange={track}>
          <RootNavigator />
        </NavigationContainer>
        <ToastHost aboveTabs={onTabs} />
      </PortalHost>
      <Rappels />
      {/* L'intro du K étoilé, une fois par lancement, au-dessus de tout. */}
      <Intro />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </PhoneFrame>
  );
}
