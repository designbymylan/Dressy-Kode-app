import { memo, useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { motion } from '../theme/tokens';
import type { Piece } from '../data/wardrobe';
import { useTheme } from '../theme/ThemeProvider';
import { Garment, type GarmentKind } from './Garment';
import { T } from './T';
import { Tap } from './Tap';
import { Icon } from './Icon';

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

/* ---- La tenue en rangées, de la tête aux pieds (06/10) ---- */

export type RowId = 'tete' | 'veste' | 'haut' | 'bas' | 'pieds' | 'main';
export const ROW_ORDER: RowId[] = ['tete', 'veste', 'haut', 'bas', 'pieds', 'main'];
const ROW_H: Record<RowId, number> = { tete: 62, veste: 126, haut: 126, bas: 148, pieds: 86, main: 82 };
/** Largeur du dessin par rangée : les chaussures et les sacs sont dessinés dans le bas de leur cadre, on les agrandit et on les recentre. */
const ROW_ART: Record<RowId, number> = { tete: 88, veste: 100, haut: 100, bas: 116, pieds: 116, main: 100 };
/** Où se trouve le dessin dans son cadre (0 en haut, 1 en bas), pour le centrer dans sa rangée. */
const DRAWN_AT: Partial<Record<GarmentKind, number>> = { baskets: 0.66, mocassins: 0.68, escarpins: 0.68, bottines: 0.55, sac: 0.64, foulard: 0.55, ceinture: 0.6 };
const ROW_NAME: Record<RowId, string> = { tete: 'Visage et cou', veste: 'Veste', haut: 'Haut', bas: 'Bas', pieds: 'Chaussures', main: 'Sac et accessoires' };

const plain = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Ce qui se porte sur la tête, le visage ou le cou : en haut de la tenue. */
const HEAD = /lunette|boucle|oreille|collier|chapeau|bonnet|casquette|beret|foulard|echarpe|bandeau|barrette|serre-tete|pendentif|chaine|ras de cou/;

/** La rangée d'une pièce : la hiérarchie se lit de la tête aux pieds. */
export function rowOf(p: Piece): RowId {
  if (p.category === 'chaussures') return 'pieds';
  if (p.category === 'bas' || p.category === 'robes') return 'bas';
  if (p.category === 'manteaux' || p.kind === 'cardigan') return 'veste';
  if (p.category === 'hauts') return 'haut';
  return p.kind === 'foulard' || HEAD.test(plain(p.name)) ? 'tete' : 'main';
}

/** Les pièces dans l'ordre de la tête aux pieds. */
export function headToToe(pieces: Piece[]) {
  return [...pieces].sort((a, b) => ROW_ORDER.indexOf(rowOf(a)) - ROW_ORDER.indexOf(rowOf(b)));
}

/** Rotation : d'abord ce qui dort le plus longtemps. */
const rest = (a: Piece, b: Piece) => (b.lastWorn ?? 999) - (a.lastWorn ?? 999);

type DressProps = {
  pieces: Piece[];
  /** Tout le dressing : les voisines de chaque rangée viennent de là. */
  pool: Piece[];
  width: number;
  pinned: Set<RowId>;
  onTogglePin: (r: RowId) => void;
  onSwap: (r: RowId, to: Piece) => void;
  onPiece: (p: Piece) => void;
};

/**
 * La tenue du jour en rangées (06/10, sur le modèle « Dress me » des apps de
 * garde-robe) : une rangée par niveau, de la tête aux pieds, la pièce au
 * centre et ses voisines coupées par le bord. Toucher une voisine la prend ;
 * le cadenas garde la pièce quand Kode propose une autre tenue.
 */
export function DressRows({ pieces, pool, width, pinned, onTogglePin, onSwap, onPiece }: DressProps) {
  const { c, scheme } = useTheme();
  const rows = ROW_ORDER.map((r) => ({ r, items: pieces.filter((p) => rowOf(p) === r) })).filter((x) => x.items.length);
  const inOutfit = new Set(pieces.map((p) => p.id));
  /** Une pièce cadrée dans sa rangée : on n'en garde que la hauteur de la rangée, dessin au centre. */
  const framed = (p: Piece, h: number, w: number) => {
    const artH = w * 1.25;
    const at = p.image ? 0.5 : DRAWN_AT[p.kind] ?? 0.5;
    return (
      <View style={{ width: w, height: h, overflow: 'hidden', alignItems: 'center' }}>
        <View style={{ marginTop: h / 2 - at * artH }}>
          <Garment kind={p.kind} tint={p.tint} image={p.image} size={w} dark={scheme === 'dark'} label={p.name} />
        </View>
      </View>
    );
  };
  return (
    <View style={{ gap: 6 }}>
      {rows.map(({ r, items }, i) => {
        const h = ROW_H[r];
        const w = Math.round(ROW_ART[r] * (items.length > 1 ? 0.78 : 1));
        const side = Math.round(ROW_ART[r] * 0.86);
        const alts = pool.filter((p) => rowOf(p) === r && !inOutfit.has(p.id)).sort(rest);
        const keep = pinned.has(r);
        const groupW = items.length * w + (items.length - 1) * 8;
        const neighbour = (p: Piece | undefined, edge: 'left' | 'right') =>
          p ? (
            <View key={edge} style={{ position: 'absolute', top: 0, [edge]: -Math.round(side * 0.38), opacity: 0.38 }}>
              <Tap testID={`row-${r}-${edge}`} onPress={() => onSwap(r, p)} scaleTo={0.95} accessibilityLabel={`${ROW_NAME[r]} : prendre ${p.name}`}>
                {framed(p, h, side)}
              </Tap>
            </View>
          ) : null;
        return (
          <Animated.View key={r} entering={FadeInDown.delay(80 + i * 90).duration(380)} style={{ height: h, width, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={ROW_NAME[r]}>
            {neighbour(alts[0], 'left')}
            {neighbour(alts[1], 'right')}
            <View className="flex-row items-center" style={{ gap: 8 }}>
              {items.map((p) => (
                <Animated.View key={p.id} entering={FadeIn.duration(260)}>
                  <Tap onPress={() => onPiece(p)} scaleTo={0.96} accessibilityLabel={p.name} accessibilityHint="Ouvre la fiche de la pièce">
                    {framed(p, h, w)}
                  </Tap>
                </Animated.View>
              ))}
            </View>
            {alts.length > 0 && (
              <View style={{ position: 'absolute', top: 0, left: width / 2 + groupW / 2 - 6 }}>
                <Tap
                  testID={`row-${r}-pin`}
                  onPress={() => onTogglePin(r)}
                  feedback="select"
                  accessibilityRole="switch"
                  accessibilityState={{ checked: keep }}
                  accessibilityLabel={keep ? `${ROW_NAME[r]} : ne plus garder` : `${ROW_NAME[r]} : garder pour la prochaine tenue`}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: keep ? c['primary-bg'] : c['glass-strong'] }}>
                    <Icon name="lock" size={13} color={keep ? c['primary-fg'] : c.ink} strokeWidth={2} />
                  </View>
                </Tap>
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}
