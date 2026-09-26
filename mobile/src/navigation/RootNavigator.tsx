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
import { Onboarding } from '../screens/Onboarding';
import { PieceScreen } from '../screens/Piece';
import { AddPiece } from '../screens/AddPiece';
import { Compose } from '../screens/Compose';
import { EventScreen } from '../screens/Event';
import { SilhouetteScreen } from '../screens/Silhouette';
import { Customize } from '../screens/Customize';
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
          <Stack.Screen name="Piece" component={PieceScreen} />
          <Stack.Screen name="Compose" component={Compose} />
          <Stack.Screen name="Event" component={EventScreen} />
          <Stack.Screen name="Silhouette" component={SilhouetteScreen} />
          <Stack.Screen name="Customize" component={Customize} />
          <Stack.Screen name="Offers" component={Offers} />
          <Stack.Screen name="Shop" component={Shop} />
          <Stack.Screen name="States" component={States} />
          <Stack.Group screenOptions={modalOptions}>
            <Stack.Screen name="AddPiece" component={AddPiece} />
            <Stack.Screen name="Share" component={ShareScreen} />
          </Stack.Group>
        </>
      )}
    </Stack.Navigator>
  );
}
