import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { material } from '../theme/tokens';
import { Glass } from './Glass';
import { T } from './T';
import { Tap } from './Tap';
import { Icon } from './Icon';

/**
 * Le retour d'une action (« Notée dans ton journal · Annuler »), posé
 * au-dessus de la barre d'onglets. Ce n'est jamais une offre ni une
 * interruption : il confirme ce que l'utilisatrice vient de faire et
 * disparaît seul après 4 secondes.
 */
export function ToastHost({ aboveTabs }: { aboveTabs: boolean }) {
  const { s, a } = useStore();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = s.toast;
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(a.hideToast, 4000);
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
      style={{ position: 'absolute', left: 16, right: 16, bottom: aboveTabs ? (insets.bottom > 0 ? material.tabBottom : 12) + material.tabHeight + 10 : Math.max(insets.bottom, 12) + 8 }}
    >
      <Glass radius={24}>
        <View className="flex-row items-center" style={{ minHeight: 48, paddingLeft: 16, paddingRight: 6, gap: 10 }}>
          <Icon name="check" size={18} color={c.positive} strokeWidth={2.2} />
          <T v="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
            {toast.text}
          </T>
          {toast.undo && (
            <Tap testID="toast-undo" onPress={a.undo} accessibilityLabel="Annuler" style={{ height: 40, paddingHorizontal: 14, borderRadius: 20 }} className="items-center justify-center bg-pill">
              <T v="caption" style={{ fontFamily: 'HankenGrotesk_600SemiBold' }}>
                Annuler
              </T>
            </Tap>
          )}
        </View>
      </Glass>
    </Animated.View>
  );
}
