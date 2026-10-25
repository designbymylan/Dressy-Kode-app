import { useEffect, useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { CATEGORIES, type Piece } from '../data/wardrobe';
import { useTheme } from '../theme/ThemeProvider';
import { F } from '../theme/fonts';
import { Kodi, type KodiMood } from './Kodi';
import { T } from './T';

/** Fenêtre sur laquelle une pièce compte comme « portée » (web : lib/usage.ts). */
export const WINDOW_DAYS = 90;

type Usage = { total: number; worn: number; pct: number; categories: { id: string; label: string; total: number; worn: number; pct: number }[] };

/** La part de la garde-robe vraiment portée ces 90 derniers jours, en tout et par catégorie. */
export function usageOf(pieces: Piece[]): Usage {
  const worn = (p: Piece) => p.lastWorn !== null && p.lastWorn <= WINDOW_DAYS;
  const pct = (n: number, of: number) => (of ? (n / of) * 100 : 0);
  const n = pieces.filter(worn).length;
  return {
    total: pieces.length,
    worn: n,
    pct: pct(n, pieces.length),
    categories: CATEGORIES.map((c) => {
      const mine = pieces.filter((p) => p.category === c.id);
      const w = mine.filter(worn).length;
      return { id: c.id, label: c.short, total: mine.length, worn: w, pct: pct(w, mine.length) };
    }).filter((c) => c.total > 0),
  };
}

/** Ce que Kodi dit de la barre, et la tête qu'il fait (mêmes phrases que le web). */
export function usageMood(u: Pick<Usage, 'total' | 'worn' | 'pct'>): { mood: KodiMood; line: string } {
  if (!u.total) return { mood: 'wave', line: 'Ajoute tes pièces, je m’occupe du reste.' };
  if (!u.worn) return { mood: 'thinking', line: 'Dis-moi ce que tu portes : « Je la porte » dans la fiche d’une pièce, ou sur ta tenue du jour.' };
  if (u.pct < 25) return { mood: 'sleepy', line: 'La plupart de tes pièces dorment. On en réveille une demain ?' };
  if (u.pct < 50) return { mood: 'wink', line: 'Bon début. L’autre moitié de ton dressing t’attend.' };
  if (u.pct < 80) return { mood: 'happy', line: 'Tu fais tourner ton dressing, c’est beau à voir.' };
  return { mood: 'celebrate', line: 'Presque tout ton dressing vit. Bravo !' };
}

/**
 * La barre de progression du 21/10 (« Inspiration progress bar ») : une
 * capsule cerclée, remplie de la part atteinte, le pourcentage dans le
 * remplissage. Elle se remplit à l'arrivée.
 */
export function ProgressBar({ value, label, small, color, onColor }: { value: number; label: string; small?: boolean; color: string; onColor: string }) {
  const reduced = useReducedMotion();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const [w, setW] = useState(0);
  const grow = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) grow.value = withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) });
  }, [reduced, grow]);
  const h = small ? 28 : 48;
  const pad = small ? 3 : 4;
  const border = small ? 2.5 : 3;
  const minW = small ? 40 : 56;
  const inner = Math.max(0, w - (pad + border) * 2);
  const target = Math.max(minW, (inner * pct) / 100);
  const fill = useAnimatedStyle(() => ({ width: Math.min(inner, minW + (target - minW) * grow.value) }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: h, padding: pad, borderWidth: border, borderColor: color, borderRadius: 999 }}
    >
      {w > 0 && (
        <Animated.View style={[{ height: '100%', borderRadius: 999, backgroundColor: color, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: small ? 7 : 12 }, fill]}>
          <T v="small" style={{ color: onColor, ...F.s700, fontSize: small ? 11 : 14.5, lineHeight: small ? 14 : 18 }}>
            {pct}%
          </T>
        </Animated.View>
      )}
    </View>
  );
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

/** La garde-robe exploitée (dressing) : Kodi, la barre et les catégories. */
export function UsagePanel({ pieces }: { pieces: Piece[] }) {
  const { c } = useTheme();
  const u = usageOf(pieces);
  const kodi = usageMood(u);
  if (!u.total) return null;
  return (
    <Cut testID="dressing-usage" label="Pièces portées">
      <View className="flex-row items-end justify-between" style={{ gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T v="label" style={{ color: c['on-panel-muted'] }}>
            Pièces portées
          </T>
          <T v="title" style={{ color: c['on-panel'], fontSize: 26, lineHeight: 30 }}>
            {u.worn} sur {u.total} pièce{u.total > 1 ? 's' : ''}
          </T>
          <T v="caption" style={{ color: c['on-panel-muted'] }}>
            portée{u.worn > 1 ? 's' : ''} ces {WINDOW_DAYS} derniers jours
          </T>
        </View>
        <Kodi mood={kodi.mood} size={66} track />
      </View>
      <ProgressBar value={u.pct} label={`Part de ta garde-robe portée ces ${WINDOW_DAYS} derniers jours`} color={c['on-panel']} onColor={c.panel} />
      <T v="caption" style={{ color: c['on-panel'] }}>
        {kodi.line}
      </T>
      {u.categories.length > 1 && (
        <View className="flex-row flex-wrap" style={{ rowGap: 14, columnGap: 12 }}>
          {u.categories.map((cat) => (
            <View key={cat.id} style={{ width: '47%', gap: 6 }}>
              <View className="flex-row justify-between">
                <T v="small" style={{ color: c['on-panel'], ...F.s600 }}>
                  {cat.label}
                </T>
                <T v="small" style={{ color: c['on-panel-muted'] }}>
                  {cat.worn}/{cat.total}
                </T>
              </View>
              <ProgressBar small value={cat.pct} label={`${cat.label} : part portée`} color={c['on-panel']} onColor={c.panel} />
            </View>
          ))}
        </View>
      )}
    </Cut>
  );
}
