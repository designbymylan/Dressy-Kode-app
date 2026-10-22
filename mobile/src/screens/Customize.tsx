import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MODULE_LABELS, useStore, type HomeModule } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Card, Tag } from '../ui/bits';
import { IconButton } from '../ui/Button';
import { Toggle } from '../ui/controls';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { Ambient } from '../ui/Ambient';
import type { Nav } from '../navigation/types';
import type { IconName } from '../ui/Icon';

export function Customize() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const shown = s.modules.filter((m) => m.on).length;

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-customize">
      <Ambient />
      <StackHeader title="Personnaliser" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 26 }}>
        <View style={{ gap: 12 }}>
          <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 4 }}>
            <Tag label="Ton accueil" />
            <T v="kicker" tone="ink2">{`${shown} sur ${s.modules.length}`}</T>
          </View>
          {/* Les sections affichées d'abord, dans l'ordre de l'accueil ; les masquées ensuite. */}
          <Card style={{ paddingVertical: 2, paddingLeft: 12, paddingRight: 10 }} testID="customize-modules">
            {s.modules.map((m, i) => {
              const title = MODULE_LABELS[m.id].title;
              return (
                <Animated.View key={m.id} layout={LinearTransition.springify().damping(22)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60, gap: 8, borderBottomWidth: i === s.modules.length - 1 ? 0 : 1, borderColor: c.rule }}>
                  <ModuleGlyph id={m.id} dim={!m.on} />
                  <T v="bodyStrong" numberOfLines={1} style={{ flex: 1, opacity: m.on ? 1 : 0.5, marginLeft: 4 }}>
                    {title}
                  </T>
                  {m.on ? (
                    <>
                      <Arrow testID={`module-up-${m.id}`} icon="up" label={`Monter ${title}`} off={i === 0} onPress={() => a.moveModule(m.id, -1)} />
                      <Arrow testID={`module-down-${m.id}`} icon="down" label={`Descendre ${title}`} off={i === shown - 1} onPress={() => a.moveModule(m.id, 1)} />
                    </>
                  ) : (
                    <View style={{ width: 88 }} />
                  )}
                  <Toggle testID={`module-toggle-${m.id}`} value={m.on} onChange={() => a.toggleModule(m.id)} label={`Afficher ${title}`} />
                </Animated.View>
              );
            })}
          </Card>
          <T testID="modules-reset" v="caption" tone="ink2" onPress={a.resetModules} accessibilityRole="button" suppressHighlighting style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 12 }}>
            Ordre d’origine
          </T>
        </View>

        <T testID="customize-settings" v="caption" tone="ink2" onPress={() => nav.navigate('Settings')} accessibilityRole="link" suppressHighlighting style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 12 }}>
          Thème, grille et verre : dans Réglages
        </T>
      </Animated.ScrollView>
    </View>
  );
}

/** Une flèche de rangement ; au bout du groupe, elle s'efface sans disparaître. */
function Arrow({ icon, label, off, onPress, testID }: { icon: IconName; label: string; off: boolean; onPress: () => void; testID: string }) {
  return (
    <View style={{ opacity: off ? 0.25 : 1 }} pointerEvents={off ? 'none' : 'auto'} accessibilityState={{ disabled: off }}>
      <IconButton testID={testID} icon={icon} label={label} variant="plain" size={40} onPress={onPress} />
    </View>
  );
}

/**
 * Le pictogramme d'une section : sa forme à l'accueil, en petit (06/10).
 * Rangées pour la tenue, cartes pour la semaine, bulle pour Kodi, arche,
 * ronds, barres, mosaïque, ticket, bloc plein.
 */
function ModuleGlyph({ id, dim }: { id: HomeModule; dim: boolean }) {
  const { c } = useTheme();
  const ink = c.ink;
  const box = (child: ReactNode) => (
    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.45 : 1 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {child}
    </View>
  );
  const bar = (w: number, h: number, r = 2) => <View style={{ width: w, height: h, borderRadius: r, backgroundColor: ink }} />;
  switch (id) {
    case 'tenue':
      return box(<View style={{ alignItems: 'center', gap: 2 }}>{bar(12, 4)}{bar(18, 9, 3)}{bar(14, 9, 3)}{bar(16, 4)}</View>);
    case 'semaine':
      return box(
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {bar(8, 18, 3)}
          {bar(8, 18, 3)}
          <View style={{ width: 8, height: 18, borderRadius: 3, borderWidth: 1.5, borderStyle: 'dashed', borderColor: ink }} />
        </View>,
      );
    case 'kode':
      return box(<View style={{ width: 24, height: 17, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomRightRadius: 8, borderBottomLeftRadius: 2, backgroundColor: c.butter, borderWidth: 1.5, borderColor: ink }} />);
    case 'oubliees':
      return box(<View style={{ width: 16, height: 22, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderWidth: 1.5, borderColor: ink }} />);
    case 'tendance':
      return box(
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: ink }} />
          <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: ink, backgroundColor: c.stage, marginLeft: -6 }} />
        </View>,
      );
    case 'porte':
      return box(<View style={{ gap: 4 }}>{bar(22, 3)}{bar(16, 3)}{bar(10, 3)}</View>);
    case 'nouveautes':
      return box(
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {bar(10, 22, 3)}
          <View style={{ gap: 2 }}>
            {bar(10, 10, 3)}
            {bar(10, 10, 3)}
          </View>
        </View>,
      );
    case 'prets':
      return box(
        <View style={{ width: 26, height: 15, borderRadius: 4, borderWidth: 1.5, borderColor: ink }}>
          <View style={{ position: 'absolute', left: 6, top: 2, bottom: 2, borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: ink }} />
        </View>,
      );
    default:
      return box(bar(20, 20, 6));
  }
}
