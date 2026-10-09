import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useStore } from '../state/store';
import { TabBar } from '../ui/TabBar';
import { TabChromeProvider } from '../ui/layout';
import { Home } from '../screens/Home';
import { Dressing } from '../screens/Dressing';
import { Kode } from '../screens/Kode';
import { Agenda } from '../screens/Agenda';
import { Me } from '../screens/Me';
import { Welcome } from '../screens/Welcome';
import { Affiner, Onboarding } from '../screens/Onboarding';
import { PieceScreen } from '../screens/Piece';
import { AddPiece } from '../screens/AddPiece';
import { Compose } from '../screens/Compose';
import { EventScreen } from '../screens/Event';
import { Planning } from '../screens/Planning';
import { EventEdit } from '../screens/EventEdit';
import { TripScreen } from '../screens/TripScreen';
import { SilhouetteScreen } from '../screens/Silhouette';
import { Customize } from '../screens/Customize';
import { ProfileEdit } from '../screens/ProfileEdit';
import { Settings } from '../screens/Settings';
import { Bilan } from '../screens/Bilan';
import { TesDonnees } from '../screens/TesDonnees';
import { Confidentialite } from '../screens/Confidentialite';
import { ShareScreen } from '../screens/Share';
import { Offers } from '../screens/Offers';
import { Shop } from '../screens/Shop';
import { States } from '../screens/States';
import { createStack, cardOptions, fadeOptions, modalOptions } from './stack';
import type { RootParams, TabParams } from './types';

const Tab = createBottomTabNavigator<TabParams>();
const Stack = createStack<RootParams>();

function Tabs() {
  return (
    <TabChromeProvider>
      <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: 'transparent' } }}>
        <Tab.Screen name="Home" component={Home} />
        <Tab.Screen name="Dressing" component={Dressing} />
        <Tab.Screen name="Kode" component={Kode} />
        <Tab.Screen name="Agenda" component={Agenda} />
        <Tab.Screen name="Me" component={Me} />
      </Tab.Navigator>
    </TabChromeProvider>
  );
}

/**
 * Tant que la bienvenue n'est pas passée, seules Bienvenue et Onboarding
 * existent ; ensuite, l'app. React Navigation bascule d'un groupe à
 * l'autre sans qu'on puisse « revenir » à l'onboarding par erreur.
 */
export function RootNavigator() {
  const { s } = useStore();
  // Le temps de relire la session : un fond uni plutôt qu'un éclair de l'accueil.
  if (s.booting) return <View className="bg-paper" style={{ flex: 1 }} testID="booting" />;
  return (
    <Stack.Navigator screenOptions={cardOptions}>
      {!s.onboarded ? (
        <Stack.Group>
          <Stack.Screen name="Welcome" component={Welcome} options={fadeOptions} />
          <Stack.Screen name="Onboarding" component={Onboarding} />
        </Stack.Group>
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={fadeOptions} />
          {/* Ouverte depuis une vignette, la fiche grandit d'elle : un fondu plutôt qu'un glissement. */}
          <Stack.Screen name="Piece" component={PieceScreen} options={({ route }) => (route.params?.from ? fadeOptions : cardOptions)} />
          <Stack.Screen name="Compose" component={Compose} />
          <Stack.Screen name="Event" component={EventScreen} />
          <Stack.Screen name="Planning" component={Planning} />
          <Stack.Screen name="EventEdit" component={EventEdit} />
          <Stack.Screen name="Trip" component={TripScreen} />
          <Stack.Screen name="Silhouette" component={SilhouetteScreen} />
          <Stack.Screen name="Customize" component={Customize} />
          <Stack.Screen name="Settings" component={Settings} />
          <Stack.Screen name="Bilan" component={Bilan} />
          <Stack.Screen name="TesDonnees" component={TesDonnees} />
          <Stack.Screen name="ProfileEdit" component={ProfileEdit} />
          <Stack.Screen name="Affiner" component={Affiner} />
          <Stack.Screen name="Offers" component={Offers} />
          <Stack.Screen name="Shop" component={Shop} />
          <Stack.Screen name="States" component={States} />
          <Stack.Group screenOptions={modalOptions}>
            <Stack.Screen name="AddPiece" component={AddPiece} />
            <Stack.Screen name="Share" component={ShareScreen} />
          </Stack.Group>
        </>
      )}
      {/* La politique de confidentialité se lit avant comme après l'inscription. */}
      <Stack.Screen name="Confidentialite" component={Confidentialite} />
    </Stack.Navigator>
  );
}
