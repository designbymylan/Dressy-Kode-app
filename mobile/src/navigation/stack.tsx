// Sur téléphone : la vraie pile native (UINavigationController), avec le
// retour par glissement et les feuilles modales du système.
import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';

export const createStack = createNativeStackNavigator;
export const cardOptions: NativeStackNavigationOptions = { headerShown: false, animation: 'default' };
export const modalOptions: NativeStackNavigationOptions = { headerShown: false, presentation: 'modal' };
export const fadeOptions: NativeStackNavigationOptions = { headerShown: false, animation: 'fade' };
