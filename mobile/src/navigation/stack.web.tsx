// Dans l'aperçu web, la pile native n'anime rien : on prend la pile JS de
// React Navigation, réglée sur les transitions iOS, pour que la navigation
// ressente comme sur le téléphone.
import { createStackNavigator, TransitionPresets, CardStyleInterpolators, type StackNavigationOptions } from '@react-navigation/stack';

export const createStack = createStackNavigator as unknown as typeof import('@react-navigation/native-stack').createNativeStackNavigator;
const base: StackNavigationOptions = { headerShown: false, cardStyle: { flex: 1 } };
export const cardOptions = { ...base, ...TransitionPresets.SlideFromRightIOS, gestureEnabled: true } as object;
export const modalOptions = { ...base, ...TransitionPresets.ModalPresentationIOS, gestureEnabled: true } as object;
export const fadeOptions = { ...base, cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter } as object;
