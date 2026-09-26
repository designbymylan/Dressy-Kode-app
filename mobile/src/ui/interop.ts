// NativeWind ne lit `className` que sur les composants qu'il connaît :
// on lui présente les composants animés de Reanimated.
import Animated from 'react-native-reanimated';
import { cssInterop } from 'nativewind';

cssInterop(Animated.View, { className: 'style' });
cssInterop(Animated.Text, { className: 'style' });
cssInterop(Animated.ScrollView, { className: 'style', contentContainerClassName: 'contentContainerStyle' });
