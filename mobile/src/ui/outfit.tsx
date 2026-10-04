import { memo, useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { motion } from '../theme/tokens';
import type { Piece } from '../data/wardrobe';
import { useTheme } from '../theme/ThemeProvider';
import { Garment } from './Garment';
import { T } from './T';
import { Tap } from './Tap';

type Slot = 'outer' | 'top' | 'bottom' | 'shoes' | 'acc';

/** Chaque pièce trouve sa place sur la planche, comme sur une page de magazine. */
function assign(pieces: Piece[]) {
  const slots: Partial<Record<Slot, Piece>> = {};
  for (const p of pieces) {
    if ((p.category === 'manteaux' || p.kind === 'cardigan') && !slots.outer) slots.outer = p;
    else if (p.category === 'hauts' && !slots.top) slots.top = p;
    else if ((p.category === 'bas' || p.category === 'robes') && !slots.bottom) slots.bottom = p;
    else if (p.category === 'chaussures' && !slots.shoes) slots.shoes = p;
    else if (p.category === 'accessoires' && !slots.acc) slots.acc = p;
    else if (p.category === 'hauts' && !slots.outer) slots.outer = p;
  }
  return slots;
}

const UPPER: Record<number, { x: number; s: number; r: number }[]> = {
  1: [{ x: 0.3, s: 0.4, r: 0 }],
  2: [{ x: 0.1, s: 0.38, r: -3 }, { x: 0.52, s: 0.36, r: 2 }],
  3: [{ x: 0.006, s: 0.377, r: -4 }, { x: 0.314, s: 0.331, r: 3 }, { x: 0.64, s: 0.326, r: 2 }],
};
const LOWER: Record<number, { x: number; s: number; r: number }[]> = {
  1: [{ x: 0.36, s: 0.33, r: 0 }],
  2: [{ x: 0.314, s: 0.337, r: 0 }, { x: 0.714, s: 0.246, r: -3 }],
};

export const boardHeight = (w: number) => Math.round(w * 0.72);

type Props = { pieces: Piece[]; width: number; numbered?: boolean; onPiece?: (p: Piece) => void; assemble?: boolean; frame?: boolean };

/** Le temps que met une tenue à s'assembler : de quoi caler le titre qui s'écrit ensuite. */
export const assembleDelay = (n: number) => 120 + n * 120 + 300;

/**
 * Une pièce posée sur la planche. Quand la tenue s'assemble, elle arrive de
 * son côté de la planche et se pose, l'une après l'autre.
 */
function Placed({ i, x, y, r, s, width, assemble, children }: { i: number; x: number; y: number; r: number; s: number; width: number; assemble: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const k = useSharedValue(assemble && !reduced ? 0 : 1);
  useEffect(() => {
    if (assemble && !reduced) k.value = withDelay(120 + i * 120, withSpring(1, motion.gentle));
  }, [assemble, reduced, k, i]);
  const fx = (x + s / 2 < width / 2 ? -1 : 1) * width * 0.45;
  const fy = (y < width * 0.15 ? -1 : 1) * width * 0.3;
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, k.value * 1.5),
    transform: [{ translateX: (1 - k.value) * fx }, { translateY: (1 - k.value) * fy }, { rotate: `${r * k.value}deg` }, { scale: 0.6 + 0.4 * k.value }],
  }));
  return <Animated.View style={[{ position: 'absolute', left: x, top: y }, style]}>{children}</Animated.View>;
}

/** Les numéros arrivent quand les pièces sont posées. */
function Numeral({ delay, assemble, children }: { delay: number; assemble: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const k = useSharedValue(assemble && !reduced ? 0 : 1);
  useEffect(() => {
    if (assemble && !reduced) k.value = withDelay(delay, withSpring(1, motion.spring));
  }, [assemble, reduced, k, delay]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, k.value), transform: [{ scale: 0.6 + 0.4 * k.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** La planche d'une tenue : les pièces posées, numérotées dans l'ordre de la légende. */
function OutfitBoardBase({ pieces, width: outer, numbered = true, onPiece, assemble = false, frame = false }: Props) {
  const { scheme } = useTheme();
  // La tenue est posée sur le fond (02/10) ; frame la pose sur une scène gris studio.
  const pad = frame ? Math.round(outer * 0.05) : 0;
  const width = outer - pad * 2;
  const slots = assign(pieces);
  const upper = (['outer', 'top', 'bottom'] as Slot[]).filter((k) => slots[k]);
  const lower = (['shoes', 'acc'] as Slot[]).filter((k) => slots[k]);
  const placed: { p: Piece; x: number; y: number; s: number; r: number }[] = [];
  upper.forEach((k, i) => {
    const pos = UPPER[upper.length][i];
    placed.push({ p: slots[k]!, x: pos.x * width, y: (k === 'top' ? 0.057 : k === 'bottom' ? 0.011 : 0.023) * width, s: pos.s * width, r: pos.r });
  });
  lower.forEach((k, i) => {
    const pos = LOWER[lower.length][i];
    placed.push({ p: slots[k]!, x: pos.x * width, y: (k === 'acc' ? 0.354 : 0.3) * width, s: pos.s * width, r: pos.r });
  });
  const order = (p: Piece) => pieces.findIndex((q) => q.id === p.id) + 1;
  return (
    <View className={frame ? 'bg-stage' : ''} style={{ width: outer, padding: pad, borderRadius: frame ? 22 : 0 }} accessibilityElementsHidden={!onPiece}>
      <View style={{ width, height: boardHeight(width) }}>
        {placed.map(({ p, x, y, s, r }, i) => {
          const art = <Garment kind={p.kind} tint={p.tint} image={p.image} size={s} dark={scheme === 'dark'} label={p.name} />;
          return (
            <Placed key={p.id} i={i} x={x} y={y} r={r} s={s} width={width} assemble={assemble}>
              {onPiece ? (
                <Tap onPress={() => onPiece(p)} accessibilityLabel={`${String(order(p)).padStart(2, '0')}, ${p.name}`} accessibilityHint="Ouvre la fiche de la pièce" scaleTo={0.96}>
                  {art}
                </Tap>
              ) : (
                art
              )}
            </Placed>
          );
        })}
        {/* Les numéros passent au-dessus de toutes les pièces, jamais dessous. */}
        {numbered &&
          placed.map(({ p, x, y }) => (
            <View key={`n-${p.id}`} pointerEvents="none" style={{ position: 'absolute', left: x - 2, top: y - 8 }}>
              <Numeral delay={assembleDelay(placed.length) - 200} assemble={assemble}>
                <T v="numeral" tone="ink2" style={{ fontSize: Math.max(13, width * 0.046) }} accessibilityElementsHidden importantForAccessibility="no">
                  {String(order(p)).padStart(2, '0')}
                </T>
              </Numeral>
            </View>
          ))}
      </View>
    </View>
  );
}

export const OutfitBoard = memo(OutfitBoardBase);

/** La légende numérotée, en deux colonnes. */
export function Legend({ pieces, onPiece }: { pieces: Piece[]; onPiece?: (p: Piece) => void }) {
  return (
    <View className="flex-row flex-wrap" style={{ rowGap: 2, columnGap: 16 }}>
      {pieces.map((p, i) => (
        <Tap
          key={p.id}
          onPress={onPiece ? () => onPiece(p) : undefined}
          disabled={!onPiece}
          scaleTo={1}
          feedback="none"
          accessibilityRole={onPiece ? 'link' : 'text'}
          accessibilityLabel={`${String(i + 1).padStart(2, '0')}, ${p.name}`}
          outerStyle={{ width: '47%' }}
          hitSlop={4}
          style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <T v="numeral" tone="brass" style={{ fontSize: 16 }}>
            {String(i + 1).padStart(2, '0')}
          </T>
          <T v="caption" style={{ fontSize: 13.5, flexShrink: 1 }} numberOfLines={1}>
            {p.name}
          </T>
        </Tap>
      ))}
    </View>
  );
}
