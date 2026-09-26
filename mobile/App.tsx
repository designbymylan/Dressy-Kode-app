import './global.css';
import './src/ui/interop';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DefaultTheme, DarkTheme, NavigationContainer, type NavigationState } from '@react-navigation/native';
import { HankenGrotesk_400Regular } from '@expo-google-fonts/hanken-grotesk/400Regular';
import { HankenGrotesk_500Medium } from '@expo-google-fonts/hanken-grotesk/500Medium';
import { HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk/600SemiBold';
import { HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk/700Bold';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif/400Regular_Italic';
import { StoreProvider } from './src/state/store';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { PortalHost } from './src/ui/Sheet';
import { ToastHost } from './src/ui/Toast';
import { RootNavigator } from './src/navigation/RootNavigator';
import { PhoneFrame } from './src/web/PhoneFrame';

export default function App() {
  const [loaded] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <ThemeProvider>{loaded ? <Shell /> : <View style={{ flex: 1 }} />}</ThemeProvider>
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
