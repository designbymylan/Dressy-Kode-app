import './global.css';
import './src/ui/interop';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DefaultTheme, DarkTheme, NavigationContainer, type NavigationState } from '@react-navigation/native';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif/400Regular_Italic';
import { StoreProvider } from './src/state/store';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { PortalHost } from './src/ui/Sheet';
import { ToastHost } from './src/ui/Toast';
import { RootNavigator } from './src/navigation/RootNavigator';
import { PhoneFrame } from './src/web/PhoneFrame';

export default function App() {
  // Les polices sont chargées sous leur rôle (Sans400…, Accent) : changer de
  // famille ne touche que ces lignes. La direction « vitrine de verre » est
  // dessinée en Satoshi ; DM Sans, libre et très proche, la remplace tant que
  // les fichiers Satoshi ne sont pas dans assets/fonts (voir mobile/README.md).
  const [loaded] = useFonts({
    Sans400: DMSans_400Regular,
    Sans500: DMSans_500Medium,
    Sans600: DMSans_600SemiBold,
    Sans700: DMSans_700Bold,
    Accent: InstrumentSerif_400Regular_Italic,
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
