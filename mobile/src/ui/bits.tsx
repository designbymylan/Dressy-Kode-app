import { useEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import type { Piece, Weather } from '../data/wardrobe';
import { isNew, newLabel, wornLabel } from '../data/wardrobe';
import { LightScope, useTheme } from '../theme/ThemeProvider';
import { Garment } from './Garment';
import { glassSurface } from './Glass';
import { Icon, type IconName } from './Icon';
import { T } from './T';
import { Tap } from './Tap';
import { F } from '../theme/fonts';

export function WeatherIcon({ w, size = 18, color }: { w: Weather; size?: number; color: string }) {
  const name: IconName = w.kind === 'soleil' ? 'sun' : w.kind === 'nuages' ? 'cloud' : w.kind === 'pluie' ? 'rain' : 'showers';
  return <Icon name={name} size={size} color={color} />;
}

/** État vide : une illustration, une phrase, une action, jamais une impasse. */
export function EmptyState({ art, title, body, action }: { art?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <View className="items-center" style={{ paddingVertical: 28, paddingHorizontal: 12, gap: 10 }}>
      {art}
      <T v="cardTitle" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T v="body" tone="ink2" style={{ textAlign: 'center', maxWidth: 300 }}>
        {body}
      </T>
      {action && <View style={{ marginTop: 6 }}>{action}</View>}
    </View>
  );
}

/** Squelette de chargement : une pulsation lente, figée si les animations sont réduites. */
export function Skeleton({ w, h, r = 12, style }: { w: number | `${number}%`; h: number; r?: number; style?: object }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(0.55);
  useEffect(() => {
    if (!reduced) o.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [o, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View className="bg-sunk" style={[{ width: w, height: h, borderRadius: r }, anim, style]} />;
}

/** Anneau de progression (précision de Kode, jauge de places). */
export function Ring({ value, size = 96, stroke = 7, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: value }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.rule} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.ink} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${(len * value) / 100} ${len}`} />
      </Svg>
      {children}
    </View>
  );
}

/** Barre de jauge (places du dressing). */
export function Gauge({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max, now: value }} className="bg-rule" style={{ height: 8, borderRadius: 4, overflow: 'hidden' }}>
      <View className={pct >= 90 ? 'bg-caution' : 'bg-ink'} style={{ width: `${pct}%`, height: 8, borderRadius: 4 }} />
    </View>
  );
}

/** Histogramme minimal : les ports des six derniers mois. */
export function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values);
  return (
    <View className="flex-row items-end" style={{ gap: 10, height: 96 }} accessibilityLabel={`Ports par mois : ${values.map((v, i) => `${labels[i]} ${v}`).join(', ')}`}>
      {values.map((v, i) => (
        <View key={i} className="items-center" style={{ flex: 1, gap: 6 }}>
          <View className={i === values.length - 1 ? 'bg-ink' : 'bg-faint'} style={{ width: '70%', height: Math.max(3, (v / max) * 64), borderRadius: 6, opacity: i === values.length - 1 ? 1 : 0.55 }} />
          <T v="small" tone="ink2">
            {labels[i]}
          </T>
        </View>
      ))}
    </View>
  );
}

export function Avatar({ name, size = 44, on }: { name: string; size?: number; on?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2 }, !on && { borderWidth: 1, borderColor: c['card-edge'] }]} className={`items-center justify-center ${on ? 'bg-primary-bg' : 'bg-sunk'}`}>
      <T v="bodyStrong" tone={on ? 'primary-fg' : 'ink'} style={{ fontSize: size * 0.38 }}>
        {name.slice(0, 1)}
      </T>
    </View>
  );
}

export type Origin = { x: number; y: number; w: number; h: number };

/** Où est une vignette à l'écran, pour que la fiche qu'elle ouvre naisse d'elle. */
export function measureOrigin(view: View | null, then: (from?: Origin) => void) {
  if (!view) return then();
  view.measureInWindow((x, y, w, h) => then(w && h ? { x, y, w, h } : undefined));
}

/** Vignette de la grille du dressing. */
export function PieceTile({ piece, width, onPress, dense }: { piece: Piece; width: number; onPress: (from?: Origin) => void; dense?: boolean }) {
  const { scheme, c } = useTheme();
  const art = width * (dense ? 0.62 : 0.56);
  const frame = useRef<View>(null);
  return (
    <Tap testID={`tile-${piece.id}`} onPress={() => measureOrigin(frame.current, onPress)} accessibilityLabel={`${piece.name}, ${wornLabel(piece)}`} accessibilityHint="Ouvre la fiche" style={{ width }} scaleTo={0.97}>
      {/* La pièce sur gris studio, dans une vignette arrondie. */}
      <View ref={frame} className="items-center justify-center" style={{ height: width * (dense ? 1.05 : 1.08), borderRadius: dense ? 18 : 22, backgroundColor: c.stage }}>
        <Garment kind={piece.kind} tint={piece.tint} image={piece.image} size={art} dark={scheme === 'dark'} label={piece.name} />
        {piece.wears === 0 && (
          // Une pastille noire compacte, comme un cartel de galerie.
          <View className="absolute bg-primary-bg" style={{ top: 8, left: 8, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
            <T v="kicker" tone="primary-fg">
              {isNew(piece) ? newLabel(piece) : 'Jamais portée'}
            </T>
          </View>
        )}
      </View>
      {!dense && (
        <View style={{ paddingTop: 8, paddingHorizontal: 2, gap: 1 }}>
          <T v="caption" style={{ ...F.s500 }} numberOfLines={1}>
            {piece.name}
          </T>
          <T v="small" tone="ink2" numberOfLines={1}>
            {wornLabel(piece)}
          </T>
        </View>
      )}
    </Tap>
  );
}

/** Ligne de réglage ou de menu : icône, titre, détail, chevron. */
export function Row({ icon, title, detail, onPress, right, testID, last }: { icon?: IconName; title: string; detail?: string; onPress?: () => void; right?: ReactNode; testID?: string; last?: boolean }) {
  const { c } = useTheme();
  const inner = (
    <View className="flex-row items-center" style={{ minHeight: 58, gap: 14, borderBottomWidth: last ? 0 : 1, borderColor: c.rule }}>
      {icon && (
        <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.pill }}>
          <Icon name={icon} size={19} color={c.ink} />
        </View>
      )}
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <T v="body">{title}</T>
        {detail && (
          <T v="caption" tone="ink2">
            {detail}
          </T>
        )}
      </View>
      {right ?? (onPress && <Icon name="chevron" size={18} color={c.ink2} />)}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Tap testID={testID} onPress={onPress} scaleTo={0.99} accessibilityLabel={detail ? `${title}, ${detail}` : title}>
      {inner}
    </Tap>
  );
}

/** Carte de verre (globals.css : `.glass.card`) : blanc translucide sur les halos, filet fin, ombre douce. */
export function Card({ children, style, className = '', testID }: { children: ReactNode; style?: object; className?: string; testID?: string }) {
  const { c, scheme } = useTheme();
  // Une carte teintée (beurre, encre…) garde sa couleur : on ne lui prend que le filet et l'ombre.
  const { backgroundColor, ...edge } = glassSurface(c, scheme);
  const tinted = /\bbg-/.test(className);
  const s = [{ borderRadius: 28, padding: 18 }, edge, !tinted && { backgroundColor }, tinted && { borderColor: 'transparent' }, style];
  // Le beurre reste clair en mode sombre : texte et boutons noirs dessus.
  if (/\bbg-butter\b/.test(className))
    return (
      <LightScope testID={testID} className={className} style={s}>
        {children}
      </LightScope>
    );
  return (
    <View testID={testID} className={className} style={s}>
      {children}
    </View>
  );
}

/** Groupe de lignes de réglage, posé dans une carte de verre. */
export function Group({ children, testID }: { children: ReactNode; testID?: string }) {
  const { c, scheme } = useTheme();
  return (
    <View testID={testID} style={[{ borderRadius: 28, paddingHorizontal: 16, paddingVertical: 2 }, glassSurface(c, scheme)]}>
      {children}
    </View>
  );
}

/** Pastille d'état (« Portée aujourd'hui », « Ton offre »). */
export function Badge({ label, tone = 'positive', icon }: { label: string; tone?: 'positive' | 'caution' | 'neutral'; icon?: IconName }) {
  const { c } = useTheme();
  // Une pastille noire (état acquis), beurre (à surveiller) ou au filet.
  const bg = tone === 'positive' ? 'bg-primary-bg' : tone === 'caution' ? 'bg-butter' : '';
  const fg = tone === 'positive' ? c['primary-fg'] : tone === 'caution' ? c['butter-ink'] : c.ink;
  return (
    <View className={`flex-row items-center self-start ${bg}`} style={[{ borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, gap: 5 }, tone === 'neutral' && { borderWidth: 1, borderColor: c.ink }]}>
      {icon && <Icon name={icon} size={14} color={fg} strokeWidth={1.8} />}
      <T v="kicker" style={{ color: fg }}>
        {label}
      </T>
    </View>
  );
}
