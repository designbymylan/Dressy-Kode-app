import { View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MODULE_LABELS, useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tag } from '../ui/bits';
import { IconButton, Button } from '../ui/Button';
import { SegmentedPill, Toggle } from '../ui/controls';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { Ambient } from '../ui/Ambient';
import type { Nav } from '../navigation/types';
import { F } from '../theme/fonts';

export function Customize() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c, pref, setPref, solidGlass, setSolidGlass } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-customize">
      <Ambient />
      <StackHeader title="Personnaliser" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 26 }}>
        <View style={{ gap: 8 }}>
          <Tag label="Personnaliser" />
          <T v="title" accessibilityRole="header">
            Ton app,{'\n'}
            <T v="title" style={{ ...F.accent }}>
              à ta façon.
            </T>
          </T>
        </View>

        <View style={{ gap: 6 }}>
          <T v="kicker" tone="ink2">
            Ton accueil
          </T>
          <T v="caption" tone="ink2">
            La tenue du jour reste en haut.
          </T>
          <View style={{ marginTop: 6 }}>
            {s.modules.map((m, i) => (
              <Animated.View key={m.id} layout={LinearTransition.springify().damping(22)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, gap: 10, borderBottomWidth: i === s.modules.length - 1 ? 0 : 1, borderColor: c.rule }}>
                <View style={{ flex: 1, opacity: m.on ? 1 : 0.55 }}>
                  <T v="bodyStrong">{MODULE_LABELS[m.id].title}</T>
                  <T v="caption" tone="ink2">
                    {MODULE_LABELS[m.id].note}
                  </T>
                </View>
                <IconButton testID={`module-up-${m.id}`} icon="up" label={`Monter ${MODULE_LABELS[m.id].title}`} variant="plain" size={36} onPress={() => a.moveModule(m.id, -1)} />
                <IconButton testID={`module-down-${m.id}`} icon="down" label={`Descendre ${MODULE_LABELS[m.id].title}`} variant="plain" size={36} onPress={() => a.moveModule(m.id, 1)} />
                <Toggle testID={`module-toggle-${m.id}`} value={m.on} onChange={() => a.toggleModule(m.id)} label={`Afficher ${MODULE_LABELS[m.id].title}`} />
              </Animated.View>
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <T v="kicker" tone="ink2">
            Thème
          </T>
          <SegmentedPill
            label="Thème"
            value={pref}
            onChange={setPref}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'light', label: 'Clair', icon: 'sun' },
              { value: 'dark', label: 'Sombre', icon: 'moon' },
            ]}
          />
          <T v="caption" tone="ink2">
            Auto suit le réglage de ton téléphone.
          </T>
        </View>

        <View style={{ gap: 10 }}>
          <T v="kicker" tone="ink2">
            Densité de la grille
          </T>
          <SegmentedPill
            label="Densité de la grille"
            value={s.density}
            onChange={a.setDensity}
            options={[
              { value: 'aeree', label: 'Aérée · 2 colonnes' },
              { value: 'dense', label: 'Dense · 3 colonnes' },
            ]}
          />
        </View>

        <View className="flex-row items-center" style={{ gap: 14 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="bodyStrong">Verre plus opaque</T>
            <T v="caption" tone="ink2">
              La barre d’onglets et les boutons flottants deviennent pleins. Plus lisible sur les pièces claires.
            </T>
          </View>
          <Toggle testID="solid-glass" value={solidGlass} onChange={setSolidGlass} label="Verre plus opaque" />
        </View>

        {s.account !== 'connecte' && (
          <>
            <Button testID="replay-welcome" label="Revoir l’accueil de bienvenue" variant="secondary" icon="refresh" onPress={() => { a.restart(); }} />
            <T v="small" tone="ink2" style={{ textAlign: 'center', marginTop: -16 }}>
              Remet l’aperçu à zéro, comme au premier lancement.
            </T>
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}
