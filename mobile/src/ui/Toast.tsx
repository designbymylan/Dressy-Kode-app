import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { material } from '../theme/tokens';
import { Glass } from './Glass';
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
  const { c } = useTheme();
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
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 16, right: 16, bottom: aboveTabs ? (insets.bottom > 0 ? insets.bottom - 8 : 0) + material.tabBottom + material.tabHeight + 10 : Math.max(insets.bottom, 12) + 8 }}
    >
      <Glass radius={999} strong>
        <View className="flex-row items-center" style={{ minHeight: 48, paddingLeft: 16, paddingRight: 6, gap: 10 }}>
          <Icon name={toast.warn ? 'alert' : 'check'} size={18} color={toast.warn ? c.caution : c.positive} strokeWidth={2.2} />
          <T v="bodyStrong" style={{ flex: 1 }} numberOfLines={3}>
            {toast.text}
          </T>
          {toast.undo && (
            <Tap testID="toast-undo" onPress={a.undo} accessibilityLabel="Annuler" style={{ alignItems: 'center', justifyContent: 'center', height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: c.pill }}>
              <T v="caption" style={F.s600}>
                Annuler
              </T>
            </Tap>
          )}
        </View>
      </Glass>
    </Animated.View>
  );
}
