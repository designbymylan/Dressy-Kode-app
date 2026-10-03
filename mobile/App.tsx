import './global.css';
import './src/ui/interop';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useState } from 'react';
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

export default function App() {
  // Les trois polices de la charte (assets/fonts) : l'app attend leur
  // chargement, une fraction de seconde. En cas d'échec, elle s'ouvre quand
  // même avec la police du système plutôt que de rester bloquée.
  const [loaded, error] = useFonts(FONT_FILES);
  if (!loaded && !error) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <ThemeProvider>
            <Shell />
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
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </PhoneFrame>
  );
}
