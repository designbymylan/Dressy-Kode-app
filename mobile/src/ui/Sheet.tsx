import { createContext, Fragment, useContext, useEffect, useId, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, SlideInDown, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { motion, radius, space } from '../theme/tokens';
import { T } from './T';
import { IconButton } from './Button';

/* ---- Portail : ce qui doit passer au-dessus de tout (feuilles, messages) ---- */

type PortalApi = { mount: (id: string, node: ReactNode) => void; unmount: (id: string) => void };
const PortalContext = createContext<PortalApi | null>(null);

export function PortalHost({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<[string, ReactNode][]>([]);
  const api = useMemo<PortalApi>(
    () => ({
      mount: (id, node) =>
        setNodes((list) => {
          const i = list.findIndex(([k]) => k === id);
          if (i < 0) return [...list, [id, node]];
          const next = [...list];
          next[i] = [id, node];
          return next;
        }),
      unmount: (id) => setNodes((list) => list.filter(([k]) => k !== id)),
    }),
    [],
  );
  return (
    <PortalContext.Provider value={api}>
      {children}
      {nodes.map(([id, node]) => (
        <Fragment key={id}>{node}</Fragment>
      ))}
    </PortalContext.Provider>
  );
}

export function Portal({ children }: { children: ReactNode }) {
  const api = useContext(PortalContext);
  const id = useId();
  useLayoutEffect(() => {
    api?.mount(id, children);
  });
  useEffect(() => () => api?.unmount(id), [api, id]);
  return null;
}

/* ---- Feuille ---- */

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  kicker?: string;
  children: ReactNode;
  /** Pied fixe (le bouton d'action), toujours visible au-dessus du clavier. */
  footer?: ReactNode;
  testID?: string;
};

/**
 * Feuille du bas : toujours ouverte par un geste de l'utilisatrice, jamais
 * par l'app (pas de pop-up). Glisser vers le bas, toucher le voile ou la
 * croix la ferme. Hauteur au contenu, 88 % de l'écran au plus.
 */
export function Sheet({ visible, onClose, title, kicker, children, footer, testID }: SheetProps) {
  // La feuille reste montée le temps de sa sortie, puis disparaît.
  const [shown, setShown] = useState(visible);
  useEffect(() => {
    if (visible) setShown(true);
  }, [visible]);
  return (
    <Portal>
      {shown ? (
        <SheetBody visible={visible} onGone={() => setShown(false)} onClose={onClose} title={title} kicker={kicker} footer={footer} testID={testID}>
          {children}
        </SheetBody>
      ) : null}
    </Portal>
  );
}

/**
 * La sortie est animée à la main, jamais par `exiting` de Reanimated : sur
 * iPhone, une vue en sortie peut rester montée, invisible, et bloquer les
 * touches en dessous (Reanimated #10275). Pendant la sortie, la feuille ne
 * capte déjà plus rien.
 */
function SheetBody({ visible, onGone, onClose, title, kicker, children, footer, testID }: SheetProps & { onGone: () => void }) {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  const y = useSharedValue(0);
  const fade = useSharedValue(1);
  useEffect(() => {
    if (visible) {
      fade.value = 1;
      y.value = 0;
      return;
    }
    if (reduced) return onGone();
    fade.value = withTiming(0, { duration: motion.duration.base });
    y.value = withTiming(height, { duration: motion.duration.base }, (done) => {
      if (done) runOnJS(onGone)();
    });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const scrim = useAnimatedStyle(() => ({ opacity: fade.value }));
  const drag = Gesture.Pan()
    .onChange((e) => {
      y.value = Math.max(0, y.value + e.changeY);
    })
    .onEnd((e) => {
      if (y.value > 120 || e.velocityY > 900) runOnJS(onClose)();
      else y.value = withSpring(0, motion.sheet);
    });
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={StyleSheet.absoluteFill} testID={visible ? testID : undefined} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View entering={FadeIn.duration(motion.duration.base)} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer la feuille" />
      </Animated.View>
      <Animated.View
        entering={reduced ? FadeIn : SlideInDown.springify().damping(motion.sheet.damping).stiffness(motion.sheet.stiffness)}
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end' }}
      >
      <Animated.View
        accessibilityViewIsModal
        style={[
          { maxHeight: '88%', backgroundColor: c.raised, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: Math.max(insets.bottom, 16) },
          scheme === 'light' && { shadowColor: '#111111', shadowOpacity: 0.16, shadowRadius: 30, shadowOffset: { width: 0, height: -8 } },
          { borderTopWidth: 1, borderColor: c['glass-border'] },
          panel,
        ]}
      >
        <GestureDetector gesture={drag}>
          <View style={{ paddingTop: 8, paddingHorizontal: space.gutter }}>
            <View style={{ alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: c['rule-strong'] }} />
            {(title || kicker) && (
              <View className="flex-row items-start" style={{ marginTop: 10, gap: 12 }}>
                <View style={{ flex: 1, paddingTop: 4 }}>
                  {kicker && (
                    <T v="kicker" tone="ink2">
                      {kicker}
                    </T>
                  )}
                  {title && (
                    <T v="section" accessibilityRole="header">
                      {title}
                    </T>
                  )}
                </View>
                <IconButton icon="close" label="Fermer" variant="quiet" size={36} onPress={onClose} testID="sheet-close" />
              </View>
            )}
          </View>
        </GestureDetector>
        <ScrollView bounces={false} contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 14, paddingBottom: footer ? 8 : 12 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer && <View style={{ paddingHorizontal: space.gutter, paddingTop: 8 }}>{footer}</View>}
      </Animated.View>
      </Animated.View>
    </View>
  );
}
