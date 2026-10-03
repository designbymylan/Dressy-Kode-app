import './global.css';
import './src/ui/interop';
import { StatusBar } from 'expo-status-bar';
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

export default function App() {
  // Rien à charger : la galerie utilise Helvetica Neue, déjà sur l'iPhone, et
  // la pile Helvetica/Arial sur le web (src/theme/fonts.ts).
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
