/**
 * Filet de sécurité : si un écran plante, l'app montre un message et un
 * bouton pour repartir, au lieu de rester figée ou blanche. Le détail
 * technique part dans les journaux ; dans Expo Go (les essais), il s'affiche
 * aussi en petit pour qu'on puisse le relever.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../theme/tokens';
import { Button } from './Button';
import { T } from './T';

type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] écran planté :', error.message, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <Oups error={this.state.error} onRetry={() => this.setState({ error: null })} />;
  }
}

function Oups({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="bg-paper" style={{ flex: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, paddingHorizontal: space.gutter, gap: 16 }} testID="oups">
      <T v="title" accessibilityRole="header">Un souci{'\n'}d’ouverture</T>
      <T v="body" tone="ink2">
        Dresskode n’a pas pu afficher cet écran. Réessaie ; si ça recommence, ferme l’app et rouvre-la.
      </T>
      <Button testID="oups-retry" label="Réessayer" onPress={onRetry} />
      {isRunningInExpoGo() && (
        <ScrollView style={{ flexGrow: 0, maxHeight: 220 }}>
          <T v="caption" tone="ink2" selectable>
            {error.message}
          </T>
        </ScrollView>
      )}
    </View>
  );
}
