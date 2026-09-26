import { memo } from 'react';
import { View } from 'react-native';
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

type Props = { pieces: Piece[]; width: number; numbered?: boolean; onPiece?: (p: Piece) => void };

/** La planche d'une tenue : les pièces posées, numérotées dans l'ordre de la légende. */
function OutfitBoardBase({ pieces, width, numbered = true, onPiece }: Props) {
  const { scheme } = useTheme();
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
    <View style={{ width, height: boardHeight(width) }} accessibilityElementsHidden={!onPiece}>
      {placed.map(({ p, x, y, s, r }) => {
        const art = <Garment kind={p.kind} tint={p.tint} size={s} dark={scheme === 'dark'} label={p.name} />;
        return (
          <View key={p.id} style={{ position: 'absolute', left: x, top: y, transform: [{ rotate: `${r}deg` }] }}>
            {onPiece ? (
              <Tap onPress={() => onPiece(p)} accessibilityLabel={`${String(order(p)).padStart(2, '0')}, ${p.name}`} accessibilityHint="Ouvre la fiche de la pièce" scaleTo={0.96}>
                {art}
              </Tap>
            ) : (
              art
            )}
          </View>
        );
      })}
      {/* Les numéros passent au-dessus de toutes les pièces, jamais dessous. */}
      {numbered &&
        placed.map(({ p, x, y }) => (
          <T key={`n-${p.id}`} v="numeral" tone="brass" pointerEvents="none" style={{ position: 'absolute', left: x - 2, top: y - 8, fontSize: Math.max(14, width * 0.054) }} accessibilityElementsHidden importantForAccessibility="no">
            {String(order(p)).padStart(2, '0')}
          </T>
        ))}
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
