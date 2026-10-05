import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { material, space } from '../theme/tokens';
import { T } from './T';
import { IconButton } from './Button';
import { BlurView } from 'expo-blur';
import { Glass } from './Glass';
import type { IconName } from './Icon';

/** Filet éditorial. */
export function Rule({ strong, style }: { strong?: boolean; style?: object }) {
  return <View style={[{ height: 1 }, style]} className={strong ? 'bg-rule-strong' : 'bg-rule'} />;
}

/** L'ours d'une page : la marque (ou le mot de la page) à gauche, le contexte à droite. */
export function Masthead({ kicker, meta, right }: { kicker: string; meta?: string; right?: ReactNode }) {
  return (
    <View style={{ gap: 10, paddingBottom: 2 }}>
      <View className="flex-row items-center justify-between" style={{ minHeight: 20, gap: 12 }}>
        <T v={kicker === 'DRESSKODE' ? 'brand' : 'masthead'} accessibilityRole="header">
          {kicker}
        </T>
        {meta ? (
          <T v="caption" tone="ink2" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>
            {meta}
          </T>
        ) : (
          right
        )}
      </View>
    </View>
  );
}

/** Titre de section numéroté : « 01 Manteaux … Tout voir ». */
export function SectionHead({ n, title, action, onAction, testID }: { n?: string; title: string; action?: string; onAction?: () => void; testID?: string }) {
  return (
    <View className="flex-row items-baseline" style={{ gap: 10 }}>
      {n && (
        <T v="numeral" tone="ink2" accessibilityElementsHidden importantForAccessibility="no">
          {n}
        </T>
      )}
      <T v="section" style={{ flex: 1 }} accessibilityRole="header">
        {title}
      </T>
      {action && onAction && (
        <T testID={testID} v="caption" tone="ink2" onPress={onAction} accessibilityRole="link" suppressHighlighting style={{ paddingVertical: 13, paddingLeft: 8 }}>
          {action}
        </T>
      )}
    </View>
  );
}

/* ---- Barre d'onglets qui se replie au défilement (iOS 26) ---- */

const TabChrome = createContext<SharedValue<number> | null>(null);

export function TabChromeProvider({ children }: { children: ReactNode }) {
  const compact = useSharedValue(0);
  return <TabChrome.Provider value={compact}>{children}</TabChrome.Provider>;
}

export function useTabCompact() {
  return useContext(TabChrome);
}

/**
 * À brancher sur le défilement d'un écran à onglets : on descend, la barre se
 * replie ; on remonte, elle revient. `edge` reçoit la position, pour le voile du haut.
 */
export function useTabScroll(edge?: SharedValue<number>) {
  const compact = useContext(TabChrome);
  const last = useSharedValue(0);
  return useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      if (edge) edge.value = y;
      const dy = y - last.value;
      last.value = y;
      if (!compact) return;
      if (y < 40) {
        if (compact.value !== 0) compact.value = withTiming(0, { duration: 200 });
      } else if (dy > 6 && compact.value === 0) compact.value = withTiming(1, { duration: 220 });
      else if (dy < -6 && compact.value === 1) compact.value = withTiming(0, { duration: 220 });
    },
  });
}

/** Le voile de verre sous la barre d'état, qui n'apparaît qu'au défilement (effet de bord d'iOS 26). */
export function ScrollEdge({ y }: { y: SharedValue<number> }) {
  const insets = useSafeAreaInsets();
  const style = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 28], [0, 1], 'clamp') }));
  if (!insets.top) return null;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 4, zIndex: 5 }, style]}>
      <Glass edge="none" shadow={false} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/* ---- En-têtes en capsule (version cartes, décision du 05/10) ---- */

/** Hauteur de la capsule d'en-tête. */
export const CAPSULE = 56;

const FILL = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;

/**
 * L'encadrant de la capsule (06/10, sur le modèle de celle de Moi) : un verre
 * dense et bien visible au repos, bordé d'un filet clair. Quand on descend,
 * sa teinte s'allège et le flou laisse deviner la page dessous ; en
 * remontant, elle reprend sa couleur. Le flou est toujours là : rien ne
 * se superpose en net sous le titre. « Verre plus opaque » la garde pleine.
 */
export function HeaderShell({ y, children }: { y?: SharedValue<number>; children: ReactNode }) {
  const { c, scheme, solidGlass } = useTheme();
  const fill = useAnimatedStyle(() => ({ opacity: y && !solidGlass ? interpolate(y.value, [0, 90], [1, 0.7], 'clamp') : 1 }));
  return (
    <View style={[{ height: CAPSULE, borderRadius: CAPSULE / 2 }, material.card[scheme]]}>
      <View pointerEvents="none" style={[FILL, { borderRadius: CAPSULE / 2, overflow: 'hidden' }]}>
        {!solidGlass && <BlurView intensity={56} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: solidGlass ? c.raised : c['glass-strong'] }, fill]} />
      </View>
      <View pointerEvents="none" style={[FILL, { borderRadius: CAPSULE / 2, borderWidth: 1, borderColor: solidGlass ? c.rule : c['glass-border'] }]} />
      {children}
    </View>
  );
}

type Action = { icon: IconName; label: string; onPress: () => void; testID?: string; solid?: boolean };

/** Ce qui s'affiche au centre ou à gauche d'une capsule : la marque, un titre court en Cormorant, ou un titre long en Hanken. */
function CapsuleTitle({ title, brand, center }: { title: string; brand?: boolean; center?: boolean }) {
  if (brand)
    return (
      <T v="brand" accessibilityRole="header" accessibilityLabel={title} numberOfLines={1} style={center ? { textAlign: 'center' } : undefined}>
        DRESSKODE
      </T>
    );
  const short = title.length <= 14;
  return (
    <T v={short ? 'section' : 'bodyStrong'} accessibilityRole="header" numberOfLines={1} style={[{ flexShrink: short ? 0 : 1 }, center && { textAlign: 'center' }]}>
      {title}
    </T>
  );
}

function Actions({ list }: { list: Action[] }) {
  return (
    <View className="flex-row" style={{ gap: 6 }}>
      {list.map((r) => (
        <IconButton key={r.label} testID={r.testID} icon={r.icon} label={r.label} variant={r.solid ? 'solid' : 'quiet'} onPress={r.onPress} />
      ))}
    </View>
  );
}

/**
 * L'en-tête des écrans à onglets : une capsule de verre qui flotte en haut
 * (décision du 05/10, « version cartes »). Le mot de la page ou la marque à
 * gauche, un compteur discret en DM Mono, ses actions rondes à droite ; à
 * gauche, `lead` peut porter un avatar.
 */
export function TabHeader({ title, brand, meta, lead, actions = [], y }: { title: string; brand?: boolean; meta?: string; lead?: ReactNode; actions?: Action[]; y?: SharedValue<number> }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 6, left: space.lg, right: space.lg, zIndex: 10 }}>
      <HeaderShell y={y}>
        <View className="flex-row items-center" style={{ flex: 1, paddingLeft: lead ? 6 : 20, paddingRight: 6, gap: 12 }}>
          {lead}
          <View className="flex-row items-baseline" style={{ flex: 1, gap: 10, minWidth: 0 }}>
            <CapsuleTitle title={title} brand={brand} />
            {meta ? (
              <T v="kicker" numberOfLines={1} style={{ flexShrink: 1 }}>
                {meta}
              </T>
            ) : null}
          </View>
          <Actions list={actions} />
        </View>
      </HeaderShell>
    </View>
  );
}

/** Place laissée en haut d'un écran à onglets, sous la capsule. */
export function useTabTop() {
  const insets = useSafeAreaInsets();
  return insets.top + 6 + CAPSULE + 14;
}

/* ---- En-tête des écrans empilés ---- */

export function useHeaderScroll() {
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({ onScroll: (e) => (y.value = e.contentOffset.y) });
  return { y, onScroll };
}

type HeaderProps = {
  title: string;
  /** Le défilement de l'écran : la capsule s'allège quand on descend. */
  y?: SharedValue<number>;
  right?: Action[];
  /** Pour une feuille modale : une croix plutôt qu'une flèche. */
  close?: boolean;
  /** La marque au centre plutôt que le titre (fiche pièce, offres). */
  brand?: boolean;
  onBack?: () => void;
};

/**
 * La capsule de verre des écrans empilés (05/10) : retour à gauche, le titre
 * (ou la marque) au centre, les actions à droite. Elle flotte au-dessus du
 * contenu, qui défile dessous.
 */
export function StackHeader({ title, right = [], close, brand, onBack, y }: HeaderProps) {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const top = close ? 12 : insets.top + 6;
  const side = Math.max(1, right.length) * 44 + Math.max(0, right.length - 1) * 6;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top, left: space.lg, right: space.lg, zIndex: 10 }}>
      <HeaderShell y={y}>
        <View className="flex-row items-center" style={{ flex: 1, paddingHorizontal: 6, gap: 8 }}>
          <View style={{ width: side, alignItems: 'flex-start' }}>
            <IconButton testID="header-back" icon={close ? 'close' : 'back'} label={close ? 'Fermer' : 'Retour'} variant="quiet" onPress={onBack ?? (() => nav.goBack())} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
            <CapsuleTitle title={title} brand={brand} center />
          </View>
          <View style={{ width: side, alignItems: 'flex-end' }}>
            <Actions list={right} />
          </View>
        </View>
      </HeaderShell>
    </View>
  );
}

/** Place laissée en haut d'un écran empilé, sous la capsule. */
export function useStackTop(close?: boolean) {
  const insets = useSafeAreaInsets();
  return (close ? 12 : insets.top + 6) + CAPSULE + space.lg;
}
