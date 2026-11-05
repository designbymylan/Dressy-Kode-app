import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { CATEGORIES, type Piece } from '../data/wardrobe';
import type { Nav } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { F } from '../theme/fonts';
import { motion } from '../theme/tokens';
import { Garment } from './Garment';
import { Icon } from './Icon';
import { T } from './T';
import { Tap, haptic } from './Tap';

/** Fenêtre sur laquelle une pièce compte comme « portée » (web : lib/usage.ts). */
export const WINDOW_DAYS = 90;

/** Une pièce est « réveillée » si elle a été portée dans la fenêtre. */
const isWorn = (p: Piece) => p.lastWorn !== null && p.lastWorn <= WINDOW_DAYS;

type Cat = { id: string; label: string; total: number; worn: number; pct: number; sleeping: Piece[] };
type Usage = { total: number; worn: number; pct: number; categories: Cat[] };

/** La part de la garde-robe vraiment portée ces 90 derniers jours, en tout et par catégorie. */
export function usageOf(pieces: Piece[]): Usage {
  const pct = (n: number, of: number) => (of ? (n / of) * 100 : 0);
  const n = pieces.filter(isWorn).length;
  return {
    total: pieces.length,
    worn: n,
    pct: pct(n, pieces.length),
    categories: CATEGORIES.map((c) => {
      const mine = pieces.filter((p) => p.category === c.id);
      const w = mine.filter(isWorn).length;
      // La plus endormie d'abord : jamais portée, puis la plus ancienne.
      const sleeping = mine.filter((p) => !isWorn(p)).sort((a, b) => (b.lastWorn ?? 9999) - (a.lastWorn ?? 9999));
      return { id: c.id, label: c.short, total: mine.length, worn: w, pct: pct(w, mine.length), sleeping };
    }).filter((c) => c.total > 0),
  };
}

/**
 * Ce que dit la carte : le geste à faire à zéro, ce qui reste avant le
 * prochain palier (25, 50, 75 %), puis un mot sobre quand tout est porté.
 */
export function usageHint(u: Pick<Usage, 'total' | 'worn'>): { title: string; sub?: string } {
  const left = u.total - u.worn;
  if (!u.worn) return { title: 'Porte ta première pièce', sub: 'Touche une pièce, puis « Je la porte ».' };
  if (!left) return { title: 'Tout ton dressing vit', sub: 'Chaque pièce a été portée ces 90 derniers jours.' };
  const next = [25, 50, 75].find((m) => u.worn * 100 < m * u.total);
  if (next) {
    const need = Math.ceil((next * u.total) / 100) - u.worn;
    return { title: `Plus ${need > 1 ? `que ${need} pièces` : 'qu’une pièce'} pour passer à ${next} %` };
  }
  return { title: `Plus ${left > 1 ? `que ${left} pièces` : 'qu’une pièce'} et tout ton dressing vit` };
}

/**
 * La section découpée (« Image découpage de section 2 ») : un panneau noir
 * qui coule dans la page. Le coin haut gauche remonte en congé creux, le
 * coin haut droit est bombé : la ligne fait un S.
 */
export function Cut({ children, style, testID, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string; label?: string }) {
  const { c } = useTheme();
  const r = 40;
  return (
    <View testID={testID} accessibilityLabel={label} style={[{ marginTop: r }, style]}>
      <Svg width={r} height={r} style={{ position: 'absolute', left: 0, top: -r + 0.5 }}>
        <Path d={`M0 0Q0 ${r} ${r} ${r}H0Z`} fill={c.panel} />
      </Svg>
      <View style={{ backgroundColor: c.panel, borderTopRightRadius: r, borderBottomLeftRadius: r, paddingHorizontal: 20, paddingTop: 26, paddingBottom: 28, gap: 18 }}>{children}</View>
    </View>
  );
}

/** Au-delà, les vignettes ne tiennent plus : les catégories racontent seules. */
const MAX_TILES = 24;
const TILE = 44;

/**
 * Une pièce : éteinte (sombre, dessin pâle) tant qu'elle dort, allumée (gris
 * studio, couleur de la pièce, coche bleue) dès qu'elle est portée. Quand elle
 * vient de l'être, elle s'allume après un court délai et fait un petit saut
 * (une entrée seulement ; « Réduire les animations » l'allume sans mouvement).
 */
function PieceDot({ piece, fresh, order, onPress }: { piece: Piece; fresh: boolean; order: number; onPress: () => void }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const worn = isWorn(piece);
  const [lit, setLit] = useState(worn && !fresh);
  const pop = useSharedValue(1);
  useEffect(() => {
    if (!worn) return setLit(false);
    if (!fresh || reduced) return setLit(true);
    const t = setTimeout(() => {
      setLit(true);
      haptic('light');
      pop.value = withSequence(withSpring(1.24, { damping: 11, stiffness: 320, mass: 0.6 }), withSpring(1, motion.spring));
    }, 450 + order * 140);
    return () => clearTimeout(t);
  }, [worn, fresh, reduced, order, pop]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <Animated.View style={style}>
      <Tap
        testID={`usage-tile-${piece.id}`}
        onPress={onPress}
        feedback="select"
        scaleTo={0.94}
        hitSlop={4}
        accessibilityLabel={`${piece.name}, ${worn ? 'portée récemment' : 'pas portée ces 90 derniers jours'}`}
        accessibilityHint="Ouvre la fiche"
        style={{
          width: TILE,
          height: TILE,
          borderRadius: 14,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          // Allumée : gris studio ; éteinte : voile à peine visible sur le panneau.
          backgroundColor: lit ? `${c['on-panel']}E0` : `${c['on-panel']}12`,
          borderColor: lit ? 'transparent' : `${c['on-panel']}26`,
        }}
      >
        <View style={{ opacity: lit ? 1 : 0.38, marginTop: 2 }}>
          <Garment kind={piece.kind} tint={piece.tint} image={piece.image} size={30} dark={!lit} label={piece.name} />
        </View>
        {lit && (
          <View style={{ position: 'absolute', right: 3, bottom: 3, width: 15, height: 15, borderRadius: 8, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={10} color={c['primary-fg']} strokeWidth={2.6} />
          </View>
        )}
      </Tap>
    </Animated.View>
  );
}

/** Un segment par pièce (seize au plus, au-delà ils se partagent la part). */
function Segments({ total, worn, color, track }: { total: number; worn: number; color: string; track: string }) {
  const n = Math.min(total, 16);
  const on = total <= 16 ? worn : worn === 0 ? 0 : Math.max(1, Math.round((worn / total) * n));
  return (
    <View style={{ flexDirection: 'row', gap: 3 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < on ? color : track }} />
      ))}
    </View>
  );
}

/**
 * La garde-robe exploitée (dressing) : le compte en grand, une vignette par
 * pièce qui s'allume quand elle est portée, une phrase qui dit la suite, et
 * les catégories en segments. Toucher une vignette ou une catégorie ouvre la
 * pièce (celle qui dort le plus), où « Je la porte » existe déjà.
 */
export function UsagePanel({ pieces }: { pieces: Piece[] }) {
  const { c } = useTheme();
  const nav = useNavigation<Nav>();
  const u = useMemo(() => usageOf(pieces), [pieces]);
  const hint = usageHint(u);
  const open = (id: string) => nav.navigate('Piece', { id });

  // Les pièces tout juste portées (depuis la dernière fois que l'écran a été vu) s'allument sous les yeux.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const wornKey = pieces.filter(isWorn).map((p) => p.id).join(',');
  useFocusEffect(
    useCallback(() => {
      const now = wornKey ? wornKey.split(',') : [];
      setFresh(seen.current ? now.filter((id) => !seen.current!.has(id)) : []);
      seen.current = new Set(now);
    }, [wornKey]),
  );

  const tiles = useMemo(() => {
    const rank = (p: Piece) => CATEGORIES.findIndex((x) => x.id === p.category);
    return [...pieces].sort((a, b) => rank(a) - rank(b));
  }, [pieces]);

  if (!u.total) return null;
  const track = `${c['on-panel']}26`;
  return (
    <Cut testID="dressing-usage" label="Garde-robe exploitée">
      <View style={{ gap: 2 }}>
        <T v="label" style={{ color: c['on-panel-muted'] }}>
          Garde-robe exploitée
        </T>
        <T v="hero" accessibilityLabel={`${u.worn} sur ${u.total} pièces portées ces ${WINDOW_DAYS} derniers jours`} style={{ color: c['on-panel'], fontSize: 48, lineHeight: 54 }}>
          {u.worn}
          <T v="section" style={{ color: c['on-panel-muted'] }}>{` / ${u.total}`}</T>
        </T>
        <T v="caption" style={{ color: c['on-panel-muted'] }}>
          {`pièce${u.total > 1 ? 's' : ''} portée${u.total > 1 ? 's' : ''} ces ${WINDOW_DAYS} derniers jours`}
        </T>
      </View>
      {u.total <= MAX_TILES && (
        <View testID="usage-tiles" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {tiles.map((p) => {
            const f = fresh.indexOf(p.id);
            return <PieceDot key={p.id} piece={p} fresh={f >= 0} order={Math.max(0, f)} onPress={() => open(p.id)} />;
          })}
        </View>
      )}
      <View style={{ gap: 2 }}>
        <T v="bodyStrong" style={{ color: c['on-panel'] }}>
          {hint.title}
        </T>
        {hint.sub && (
          <T v="caption" style={{ color: c['on-panel-muted'] }}>
            {hint.sub}
          </T>
        )}
      </View>
      {u.categories.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: 12 }}>
          {u.categories.map((cat) => {
            const body = (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T v="small" style={{ color: c['on-panel'], ...F.s600 }}>
                    {cat.label}
                  </T>
                  <T v="small" style={{ color: c['on-panel-muted'] }}>
                    {cat.worn}/{cat.total}
                  </T>
                </View>
                <Segments total={cat.total} worn={cat.worn} color={c['on-panel']} track={track} />
              </>
            );
            const label = `${cat.label}, ${cat.worn} sur ${cat.total} portée${cat.worn > 1 ? 's' : ''}`;
            return cat.sleeping.length ? (
              <Tap
                key={cat.id}
                testID={`usage-cat-${cat.id}`}
                onPress={() => open(cat.sleeping[0].id)}
                feedback="select"
                scaleTo={0.97}
                accessibilityLabel={label}
                accessibilityHint="Ouvre une pièce à réveiller"
                outerStyle={{ width: '47%' }}
                style={{ gap: 6, paddingVertical: 4 }}
              >
                {body}
              </Tap>
            ) : (
              <View key={cat.id} testID={`usage-cat-${cat.id}`} accessible accessibilityLabel={label} style={{ width: '47%', gap: 6, paddingVertical: 4 }}>
                {body}
              </View>
            );
          })}
        </View>
      )}
    </Cut>
  );
}
