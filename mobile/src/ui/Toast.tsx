import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { material } from '../theme/tokens';
import { T } from './T';
import { Tap } from './Tap';
import { Icon } from './Icon';
import { F } from '../theme/fonts';

/**
 * Le retour d'une action (« Notée dans ton journal · Annuler »), posé
 * au-dessus de la barre d'onglets. Ce n'est jamais une offre ni une
 * interruption : il confirme ce que l'utilisatrice vient de faire et
 * disparaît seul après 4 secondes.
 */
export function ToastHost({ aboveTabs }: { aboveTabs: boolean }) {
  const { s, a } = useStore();
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = s.toast;
  useEffect(() => {
    if (!toast) return;
    // Un message d'alerte reste un peu plus longtemps : il se lit, il ne se survole pas.
    const t = setTimeout(a.hideToast, toast.warn ? 6500 : 4000);
    return () => clearTimeout(t);
  }, [toast, a]);
  if (!toast) return null;
  return (
    <Animated.View
      key={toast.id}
      entering={FadeInDown.springify().damping(20)}
      exiting={FadeOutDown.duration(160)}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 16, right: 16, bottom: aboveTabs ? (insets.bottom > 0 ? insets.bottom - 8 : 0) + material.tabBottom + material.tabHeight + 10 : Math.max(insets.bottom, 12) + 8 }}
    >
      {/* Un message de service beurre, en capsule flottante. */}
      <View className="flex-row items-center bg-butter" style={[{ minHeight: 48, borderRadius: 24, paddingLeft: 16, paddingRight: 8, gap: 10 }, material.shadow[scheme]]}>
        <Icon name={toast.warn ? 'alert' : 'check'} size={18} color={c['butter-ink']} strokeWidth={1.8} />
        <T v="caption" style={{ flex: 1, ...F.s500, color: c['butter-ink'] }} numberOfLines={3}>
          {toast.text}
        </T>
        {toast.undo && (
          <Tap testID="toast-undo" onPress={a.undo} accessibilityLabel="Annuler" style={{ height: 44, paddingHorizontal: 10 }} className="items-center justify-center">
            <T v="button" upper style={{ color: c['butter-ink'], textDecorationLine: 'underline' }}>
              Annuler
            </T>
          </Tap>
        )}
      </View>
    </Animated.View>
  );
}
