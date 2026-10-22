import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';
import type { Reveal, ScanPiece } from '../state/jobs';
import { useTheme } from '../theme/ThemeProvider';
import { motion, radius } from '../theme/tokens';
import { haptic } from './Tap';
import { Icon } from './Icon';
import { KodeOrb } from './KodeThinking';
import { T } from './T';
import { F } from '../theme/fonts';

/*
 * Les deux moments forts de l'ajout d'une pièce (web : PhotoScan.tsx et
 * RevealCutout.tsx). Les cadres et le faisceau sont posés sur une photo : ils
 * restent blancs sur un voile sombre, quel que soit le thème, pour se lire
 * sur une photo claire comme foncée.
 */
const WHITE = '#FFFFFF';
const FAILED = '#F0907A';
const VEIL = 'rgba(14,15,19,0.12)';
const VEIL_SCANNING = 'rgba(14,15,19,0.24)';

/**
 * Le scan de repérage : la photo confiée, en grand. Tant que Kodi la
 * regarde, un faisceau de lumière la balaie ; dès que les pièces sont
 * repérées, leurs cadres se tracent l'un après l'autre, chacun avec son nom.
 * Une pièce rangée passe en trait plein, avec une coche.
 */
export function PhotoScan({
  width,
  ratio,
  photo,
  art,
  pieces,
  scanning,
  dim,
  maxHeight = width * 1.15,
}: {
  width: number;
  /** Largeur sur hauteur de la photo. */
  ratio: number;
  photo?: string | null;
  /** À la place d'une photo : ce qui est dessiné (galerie de démonstration). */
  art?: ReactNode;
  pieces: ScanPiece[];
  scanning: boolean;
  dim?: boolean;
  maxHeight?: number;
}) {
  const reduced = useReducedMotion();
  // Une photo en hauteur rétrécit plutôt que de pousser tout l'écran vers le bas.
  let w = width;
  let h = width / ratio;
  if (h > maxHeight) {
    h = maxHeight;
    w = h * ratio;
  }
  const framed = pieces.filter((p) => p.box);
  const done = framed.filter((p) => p.state === 'done').length;
  const label = scanning
    ? 'Kodi regarde ta photo et repère chaque pièce'
    : framed.length
      ? `Photo avec ${framed.length} pièce${framed.length > 1 ? 's' : ''} repérée${framed.length > 1 ? 's' : ''}, ${done} rangée${done > 1 ? 's' : ''}`
      : 'Ta photo';

  return (
    <View
      className="bg-stage"
      style={{ width: w, height: h, alignSelf: 'center', borderRadius: radius.tile, overflow: 'hidden', opacity: dim ? 0.6 : 1 }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {photo ? <Image source={{ uri: photo }} style={{ width: w, height: h }} resizeMode="cover" /> : art}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: scanning ? VEIL_SCANNING : VEIL }]} />
      {scanning && !reduced ? <Beam w={w} h={h} /> : null}
      {framed.map((p, i) => (
        <ScanBox key={p.key} piece={p} i={i} w={w} h={h} />
      ))}
    </View>
  );
}

/** Le faisceau : une bande de lumière qui descend en boucle. */
function Beam({ w, h }: { w: number; h: number }) {
  const id = `beam${useId().replace(/[^0-9a-z]/gi, '')}`;
  const band = h * 0.34;
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withTiming(1, { duration: 2200, easing: motion.easing }), -1);
  }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -band + y.value * (h + band) }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: w, height: band }, style]}>
      <Svg width={w} height={band}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={WHITE} stopOpacity={0} />
            <Stop offset="0.8" stopColor={WHITE} stopOpacity={0.28} />
            <Stop offset="1" stopColor={WHITE} stopOpacity={0.95} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={band} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

const clamp01 = (v: number) => {
  'worklet';
  return Math.max(0, Math.min(1, v));
};

/**
 * Un cadre qui se trace depuis son coin haut gauche : le haut, puis la
 * droite, le bas et la gauche. Il respire tant que la pièce se dessine.
 */
function ScanBox({ piece, i, w, h }: { piece: ScanPiece; i: number; w: number; h: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  const breathe = useSharedValue(1);
  const [x0, y0, bw, bh] = piece.box!;
  // Un léger débord : un cadre qui frôle la pièce paraît la couper.
  const pad = 0.012;
  const left = Math.max(0, x0 - pad) * w;
  const top = Math.max(0, y0 - pad) * h;
  const width = Math.min(w - left, (bw + pad * 2) * w);
  const height = Math.min(h - top, (bh + pad * 2) * h);
  const colour = piece.state === 'failed' ? FAILED : WHITE;

  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(120 + i * 280, withTiming(1, { duration: 700, easing: motion.easing }));
  }, [t, i, reduced]);

  useEffect(() => {
    if (reduced || piece.state !== 'working') {
      breathe.value = withTiming(1, { duration: 300 });
      return;
    }
    breathe.value = withDelay(900 + i * 280, withRepeat(withSequence(withTiming(0.5, { duration: 1200 }), withTiming(1, { duration: 1200 })), -1));
  }, [piece.state, reduced, breathe, i]);

  const topEdge = useAnimatedStyle(() => ({ opacity: breathe.value, transform: [{ scaleX: clamp01(t.value * 4) }] }));
  const rightEdge = useAnimatedStyle(() => ({ opacity: breathe.value, transform: [{ scaleY: clamp01(t.value * 4 - 1) }] }));
  const bottomEdge = useAnimatedStyle(() => ({ opacity: breathe.value, transform: [{ scaleX: clamp01(t.value * 4 - 2) }] }));
  const leftEdge = useAnimatedStyle(() => ({ opacity: breathe.value, transform: [{ scaleY: clamp01(t.value * 4 - 3) }] }));
  const fill = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [0.8, 1], [0, 1], 'clamp') }));

  const line = { position: 'absolute' as const, backgroundColor: colour, shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 1.5, shadowOffset: { width: 0, height: 0 } };
  const inside = top < h * 0.07; // pas la place au-dessus : l'étiquette entre dans le cadre

  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', left, top, width, height }}>
        {piece.state === 'done' ? <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4 }, fill]} /> : null}
        <Animated.View style={[line, { left: 0, top: 0, width, height: 2, transformOrigin: 'left' }, topEdge]} />
        <Animated.View style={[line, { right: 0, top: 0, width: 2, height, transformOrigin: 'top' }, rightEdge]} />
        <Animated.View style={[line, { left: 0, bottom: 0, width, height: 2, transformOrigin: 'right' }, bottomEdge]} />
        <Animated.View style={[line, { left: 0, top: 0, width: 2, height, transformOrigin: 'bottom' }, leftEdge]} />
      </View>
      <ScanLabel piece={piece} i={i} left={Math.min(left, w * 0.62) + 8} top={inside ? top + 8 : top - 12} maxWidth={w - Math.min(left, w * 0.62) - 16} />
    </>
  );
}

function ScanLabel({ piece, i, left, top, maxWidth }: { piece: ScanPiece; i: number; left: number; top: number; maxWidth: number }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const k = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) k.value = withDelay(620 + i * 280, withSpring(1, motion.spring));
  }, [k, i, reduced]);
  const pop = useAnimatedStyle(() => ({ opacity: clamp01(k.value * 1.4), transform: [{ scale: 0.6 + 0.4 * k.value }] }));
  const tone = piece.state === 'done' ? c.positive : piece.state === 'failed' ? c.caution : c.ink;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ flexDirection: 'row', alignItems: 'center', position: 'absolute', left, top, maxWidth, height: 24, paddingLeft: 7, paddingRight: 9, gap: 5, borderRadius: 999, backgroundColor: c['glass-strong'], transformOrigin: 'left' }, pop]}
    >
      {piece.state === 'done' ? (
        <Icon name="check" size={12} color={tone} strokeWidth={2.6} />
      ) : piece.state === 'failed' ? (
        <T v="small" style={{ color: tone, ...F.s700 }}>
          !
        </T>
      ) : (
        <KodeOrb size={11} step="draw" />
      )}
      <T v="small" numberOfLines={1} style={{ color: tone, ...F.s600, fontSize: 11.5, flexShrink: 1 }}>
        {piece.name}
      </T>
    </Animated.View>
  );
}

/**
 * Le détourage révélé : la pièce apparaît d'abord avec le fond du dessin,
 * puis une ligne de lumière descend et l'efface, sur un damier de
 * transparence, ne laissant que la pièce posée sur le verre. `onDone` part
 * une fois l'effet joué, ou au plus tard après huit secondes : rien ne doit
 * rester bloqué sur une animation.
 */
export function RevealCutout({
  frame,
  size,
  raw,
  cut,
  ready = true,
  label,
  onDone,
}: {
  /** Largeur et hauteur de la pièce à l'écran. */
  frame: [number, number];
  /** Le carré qui la contient (le cadre y est centré). */
  size: [number, number];
  /** La pièce avec le fond du dessin, exactement superposée à `cut`. */
  raw: ReactNode;
  cut: ReactNode;
  /** Les images sont en mémoire : l'effet peut partir. */
  ready?: boolean;
  label: string;
  onDone?: () => void;
}) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const [fw, fh] = frame;
  const wipe = useSharedValue(reduced ? 1 : 0);
  const checker = useSharedValue(reduced ? 0 : 1);
  const lift = useSharedValue(0);
  const tag = useSharedValue(reduced ? 1 : 0);
  const finished = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;
  const end = () => {
    if (finished.current) return;
    finished.current = true;
    done.current?.();
  };

  useEffect(() => {
    const guard = setTimeout(end, 8000);
    return () => clearTimeout(guard);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    if (reduced) {
      const t = setTimeout(end, 600);
      return () => clearTimeout(t);
    }
    wipe.value = withDelay(350, withTiming(1, { duration: 1500, easing: motion.easing }));
    checker.value = withDelay(350 + 2100, withTiming(0, { duration: 800 }));
    lift.value = withDelay(1750, withSpring(1, motion.spring));
    tag.value = withDelay(1950, withSpring(1, motion.spring));
    // Une vibration légère quand le fond a fini de partir : le moment où la valeur arrive.
    const buzz = setTimeout(() => haptic('success'), 350 + 1500);
    const t = setTimeout(end, 350 + 1500 + 900);
    return () => {
      clearTimeout(buzz);
      clearTimeout(t);
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const window = useAnimatedStyle(() => ({ transform: [{ translateY: wipe.value * fh }] }));
  const counter = useAnimatedStyle(() => ({ transform: [{ translateY: -wipe.value * fh }] }));
  const beam = useAnimatedStyle(() => ({ opacity: wipe.value > 0 && wipe.value < 1 ? 1 : 0, transform: [{ translateY: wipe.value * fh - 1 }] }));
  const board = useAnimatedStyle(() => ({ opacity: checker.value }));
  const lifted = useAnimatedStyle(() => ({ transform: [{ translateY: -3 * lift.value }, { scale: 1 + 0.04 * lift.value }] }));
  const tagged = useAnimatedStyle(() => ({ opacity: clamp01(tag.value * 1.4), transform: [{ scale: 0.6 + 0.4 * tag.value }] }));

  return (
    <View style={{ width: size[0], height: size[1], alignItems: 'center', justifyContent: 'center' }} accessible accessibilityRole="image" accessibilityLabel={`${label}, détourée et rangée sur ton portant`}>
      <View style={{ width: fw, height: fh }}>
        <Animated.View style={[StyleSheet.absoluteFill, board]}>
          <Checker w={fw} h={fh} ink={c.ink} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, lifted]}>{cut}</Animated.View>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: fw, height: fh, overflow: 'hidden' }, window]}>
          <Animated.View style={[{ width: fw, height: fh }, counter]}>{raw}</Animated.View>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: -fw * 0.12, width: fw * 1.24, top: 0, height: 2, backgroundColor: WHITE, shadowColor: WHITE, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }, beam]}
        />
      </View>
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', position: 'absolute', bottom: 6, height: 22, paddingHorizontal: 9, gap: 4, borderRadius: 999, backgroundColor: c['glass-strong'] }, tagged]}>
        <Icon name="check" size={11} color={c.positive} strokeWidth={2.6} />
        <T v="small" style={{ color: c.positive, ...F.s700, fontSize: 11.5 }}>
          Sans fond
        </T>
      </Animated.View>
    </View>
  );
}

/** Le damier de transparence : on voit que le fond a vraiment disparu, même sur un dessin à fond blanc. */
function Checker({ w, h, ink }: { w: number; h: number; ink: string }) {
  const id = `chk${useId().replace(/[^0-9a-z]/gi, '')}`;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <Pattern id={id} x={0} y={0} width={12} height={12} patternUnits="userSpaceOnUse">
          <Rect x={0} y={0} width={6} height={6} fill={ink} fillOpacity={0.1} />
          <Rect x={6} y={6} width={6} height={6} fill={ink} fillOpacity={0.1} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} rx={6} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Le dessin de Kodi, découpé comme la pièce détourée : l'image entière est
 * agrandie et décalée pour que le cadre de découpe remplisse `frame`.
 */
export function RawCrop({ reveal, frame }: { reveal: Reveal; frame: [number, number] }) {
  const [W, H] = reveal.size;
  const [x, y, w, h] = reveal.box;
  const [fw, fh] = frame;
  return (
    <View style={{ width: fw, height: fh, overflow: 'hidden' }}>
      <Image source={{ uri: reveal.raw }} style={{ position: 'absolute', width: (W / w) * fw, height: (H / h) * fh, left: (-x / w) * fw, top: (-y / h) * fh }} />
    </View>
  );
}

/** Le cadre d'une pièce détourée, centré dans un carré de côté `side`, sans la déformer. */
export function frameOf(reveal: Reveal, side: number): [number, number] {
  const [, , w, h] = reveal.box;
  return w >= h ? [side, Math.round((side * h) / w)] : [Math.round((side * w) / h), side];
}

/** Charge les deux images avant de lancer l'effet : un effet qui démarre sur une image à moitié chargée ne révèle rien. */
export function usePreloaded(urls: string[]): boolean {
  const [ready, setReady] = useState(false);
  const key = urls.join('|');
  useEffect(() => {
    let alive = true;
    setReady(false);
    Promise.all(urls.map((u) => Image.prefetch(u)))
      .then(() => alive && setReady(true))
      .catch(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return ready;
}

