import { memo, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { FlatList, View } from 'react-native';
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

/* ---- La tenue en rangées, de la tête aux pieds (06/10, refaite le 23/10) ---- */

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
const rest = (a: Piece, b: Piece) => (b.lastWorn ?? 999) - (a.lastWorn ?? 999) || a.id.localeCompare(b.id);

/** Une pièce détourée, cadrée dans sa rangée : on ne garde que la hauteur de la rangée, le dessin au centre. Sans vignette ni fond. */
export function RowPiece({ p, h, w }: { p: Piece; h: number; w: number }) {
  const { scheme } = useTheme();
  const artH = w * 1.25;
  const at = p.image ? 0.5 : DRAWN_AT[p.kind] ?? 0.5;
  return (
    <View style={{ width: w, height: h, overflow: 'hidden', alignItems: 'center' }}>
      <View style={{ marginTop: h / 2 - at * artH }}>
        <Garment kind={p.kind} tint={p.tint} image={p.image} size={w} dark={scheme === 'dark'} label={p.name} />
      </View>
    </View>
  );
}

/** La rangée où chaque rayon du dressing se range, pour que le dressing et la tenue du jour cadrent les pièces de la même façon. */
const ROW_OF_CATEGORY: Record<Piece['category'], RowId> = { manteaux: 'veste', hauts: 'haut', bas: 'bas', robes: 'bas', chaussures: 'pieds', accessoires: 'main' };
/** La hauteur et la largeur de dessin d'une rangée de pièces d'un rayon (le dressing en rangées). */
export const shelfHeight = (category: Piece['category']) => ROW_H[ROW_OF_CATEGORY[category]];
export const shelfArt = (category: Piece['category']) => ROW_ART[ROW_OF_CATEGORY[category]];

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

/** Le cadenas d'une rangée : il garde la pièce quand Kodi propose une autre tenue. */
function PinButton({ r, keep, left, onPress }: { r: RowId; keep: boolean; left: number; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ position: 'absolute', top: 0, left }}>
      <Tap
        testID={`row-${r}-pin`}
        onPress={onPress}
        feedback="select"
        accessibilityRole="switch"
        accessibilityState={{ checked: keep }}
        accessibilityLabel={keep ? `${ROW_NAME[r]} : ne plus garder` : `${ROW_NAME[r]} : garder pour la prochaine tenue`}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: keep ? c['primary-bg'] : c['glass-strong'], borderWidth: keep ? 0 : 1, borderColor: c['card-edge'] }}>
          <Icon name="lock" size={13} color={keep ? c['primary-fg'] : c.ink} strokeWidth={2} />
        </View>
      </Tap>
    </View>
  );
}

/**
 * Une rangée qui défile (23/10, sur le modèle « Dress me » des apps de
 * garde-robe) : la pièce au centre, ses voisines à pleine opacité, coupées
 * par le bord de l'écran. On fait glisser, la pièce qui s'arrête au centre
 * est prise ; toucher une voisine la prend aussi, toucher la pièce du
 * centre ouvre sa fiche.
 */
function CarouselRow({ r, piece, pool, width, keep, onTogglePin, onSwap, onPiece }: { r: RowId; piece: Piece; pool: Piece[]; width: number; keep: boolean; onTogglePin: () => void; onSwap: (to: Piece) => void; onPiece: (p: Piece) => void }) {
  const h = ROW_H[r];
  const art = ROW_ART[r];
  const step = Math.round(width * 0.4);
  // L'ordre ne dépend pas de la pièce choisie : la rangée ne bouge pas quand on prend une voisine.
  const list = useMemo(() => {
    const all = pool.filter((p) => rowOf(p) === r);
    return [...(all.some((p) => p.id === piece.id) ? all : [...all, piece])].sort(rest);
  }, [pool, r, piece]);
  const idx = Math.max(0, list.findIndex((p) => p.id === piece.id));
  const ref = useRef<FlatList<Piece>>(null);
  // L'index où la rangée est posée : un changement venu d'ailleurs (« Une autre ») la fait glisser jusqu'à la nouvelle pièce.
  const at = useRef(idx);
  useEffect(() => {
    if (idx === at.current) return;
    at.current = idx;
    ref.current?.scrollToIndex({ index: idx, animated: true });
  }, [idx]);
  const take = (i: number, scroll: boolean) => {
    if (i === at.current || !list[i]) return;
    at.current = i;
    if (scroll) ref.current?.scrollToIndex({ index: i, animated: true });
    onSwap(list[i]);
  };
  const settle = (x: number) => take(Math.max(0, Math.min(list.length - 1, Math.round(x / step))), false);
  return (
    <View style={{ height: h, width }} accessibilityLabel={ROW_NAME[r]}>
      <FlatList
        ref={ref}
        horizontal
        data={list}
        extraData={piece.id}
        keyExtractor={(p) => p.id}
        getItemLayout={(_, i) => ({ length: step, offset: step * i, index: i })}
        initialScrollIndex={idx}
        snapToInterval={step}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        scrollEnabled={list.length > 1}
        initialNumToRender={5}
        windowSize={5}
        contentContainerStyle={{ paddingHorizontal: (width - step) / 2 }}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
        onScrollEndDrag={(e) => Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.1 && settle(e.nativeEvent.contentOffset.x)}
        renderItem={({ item, index }) => {
          const chosen = item.id === piece.id;
          return (
            <Tap
              testID={chosen ? `row-${r}-piece` : `row-${r}-${index < idx ? 'left' : 'right'}`}
              onPress={() => (chosen ? onPiece(item) : take(index, true))}
              scaleTo={0.96}
              accessibilityLabel={chosen ? item.name : `${ROW_NAME[r]} : prendre ${item.name}`}
              accessibilityHint={chosen ? 'Ouvre la fiche de la pièce' : undefined}
              style={{ width: step, height: h, alignItems: 'center' }}
            >
              <RowPiece p={item} h={h} w={art} />
            </Tap>
          );
        }}
      />
      {list.length > 1 && <PinButton r={r} keep={keep} left={width / 2 + art / 2 - 6} onPress={onTogglePin} />}
    </View>
  );
}

/**
 * La tenue du jour en rangées (06/10, refaite le 23/10 sur le modèle « Dress
 * me ») : une rangée par niveau, de la tête aux pieds, sur le fond de la
 * page, sans cadre. Chaque rangée glisse ; le cadenas garde la pièce quand
 * Kodi propose une autre tenue. Une rangée qui porte plusieurs pièces
 * (deux bijoux, un sac et une ceinture) les pose côte à côte, sans glisser.
 */
export function DressRows({ pieces, pool, width, pinned, onTogglePin, onSwap, onPiece }: DressProps) {
  const rows = ROW_ORDER.map((r) => ({ r, items: pieces.filter((p) => rowOf(p) === r) })).filter((x) => x.items.length);
  return (
    <View style={{ gap: 2 }}>
      {rows.map(({ r, items }, i) => {
        const keep = pinned.has(r);
        const toggle = () => onTogglePin(r);
        return (
          <Animated.View key={r} entering={FadeInDown.delay(80 + i * 90).duration(380)}>
            {items.length === 1 ? (
              <CarouselRow r={r} piece={items[0]} pool={pool} width={width} keep={keep} onTogglePin={toggle} onSwap={(to) => onSwap(r, to)} onPiece={onPiece} />
            ) : (
              <StaticRow r={r} items={items} hasAlt={pool.some((p) => rowOf(p) === r && !items.some((x) => x.id === p.id))} width={width} keep={keep} onTogglePin={toggle} onPiece={onPiece} />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

function StaticRow({ r, items, hasAlt, width, keep, onTogglePin, onPiece }: { r: RowId; items: Piece[]; hasAlt: boolean; width: number; keep: boolean; onTogglePin: () => void; onPiece: (p: Piece) => void }) {
  const h = ROW_H[r];
  const w = Math.round(ROW_ART[r] * 0.78);
  const groupW = items.length * w + (items.length - 1) * 8;
  return (
    <View style={{ height: h, width, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={ROW_NAME[r]}>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {items.map((p) => (
          <Animated.View key={p.id} entering={FadeIn.duration(260)}>
            <Tap onPress={() => onPiece(p)} scaleTo={0.96} accessibilityLabel={p.name} accessibilityHint="Ouvre la fiche de la pièce">
              <RowPiece p={p} h={h} w={w} />
            </Tap>
          </Animated.View>
        ))}
      </View>
      {hasAlt && <PinButton r={r} keep={keep} left={width / 2 + groupW / 2 - 6} onPress={onTogglePin} />}
    </View>
  );
}

/** Une tenue posée à plat : le haut à gauche, le bas qui le chevauche, les chaussures devant. */
export function FlatLay({ pieces, w, h }: { pieces: Piece[]; w: number; h: number }) {
  const { c, scheme } = useTheme();
  const find = (rows: RowId[]) => pieces.find((p) => rows.includes(rowOf(p)));
  const top = find(['haut', 'veste']);
  const bottom = find(['bas']);
  const feet = find(['pieds']);
  const put = (p: Piece | undefined, size: number, at: object) =>
    p ? (
      <View key={p.id} style={[{ position: 'absolute' }, at]}>
        <Garment kind={p.kind} tint={p.tint} image={p.image} size={size} dark={scheme === 'dark'} label={p.name} />
      </View>
    ) : null;
  // Un cadre allongé : les pièces côte à côte, de la tête aux pieds, entières.
  if (w > h * 1.3) {
    const row = [find(['veste']), find(['haut']), bottom, feet].filter((p): p is Piece => !!p).slice(0, 4);
    const size = Math.min((h * 0.86) / 1.25, (w - 16) / Math.max(1, row.length));
    return (
      <View style={{ width: w, height: h, borderRadius: 22, backgroundColor: c.stage, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {row.map((p) => (
          <View key={p.id} style={{ marginHorizontal: -size * 0.04 }}>
            <Garment kind={p.kind} tint={p.tint} image={p.image} size={size} dark={scheme === 'dark'} label={p.name} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ width: w, height: h, borderRadius: 22, backgroundColor: c.stage, overflow: 'hidden' }}>
      {top ? put(bottom, w * 0.64, { right: -2, top: h * 0.18 }) : put(bottom, w * 0.78, { left: w * 0.11, top: 0 })}
      {put(top, w * 0.52, { left: 0, top: 0 })}
      {put(feet, w * 0.56, { left: -2, top: h * 0.42 })}
    </View>
  );
}
