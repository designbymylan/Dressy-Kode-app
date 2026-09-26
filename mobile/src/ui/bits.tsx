import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import type { Piece, Weather } from '../data/wardrobe';
import { wornLabel } from '../data/wardrobe';
import { useTheme } from '../theme/ThemeProvider';
import { Garment } from './Garment';
import { Icon, type IconName } from './Icon';
import { T } from './T';
import { Tap } from './Tap';

export function WeatherIcon({ w, size = 18, color }: { w: Weather; size?: number; color: string }) {
  const name: IconName = w.kind === 'soleil' ? 'sun' : w.kind === 'nuages' ? 'cloud' : w.kind === 'pluie' ? 'rain' : 'showers';
  return <Icon name={name} size={size} color={color} />;
}

/** État vide : une illustration, une phrase, une action — jamais une impasse. */
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
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.brass} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${(len * value) / 100} ${len}`} />
      </Svg>
      {children}
    </View>
  );
}

/** Barre de jauge (places du dressing). */
export function Gauge({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max, now: value }} className="bg-sunk" style={{ height: 8, borderRadius: 4, overflow: 'hidden' }}>
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
          <View className={i === values.length - 1 ? 'bg-brass' : 'bg-ink'} style={{ width: '70%', height: Math.max(3, (v / max) * 64), borderRadius: 4, opacity: i === values.length - 1 ? 1 : 0.82 }} />
          <T v="small" tone="ink2">
            {labels[i]}
          </T>
        </View>
      ))}
    </View>
  );
}

export function Avatar({ name, size = 44, on }: { name: string; size?: number; on?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2 }} className={`items-center justify-center ${on ? 'bg-primary-bg' : 'bg-sunk'}`}>
      <T v="bodyStrong" tone={on ? 'primary-fg' : 'ink'} style={{ fontSize: size * 0.38 }}>
        {name.slice(0, 1)}
      </T>
    </View>
  );
}

/** Vignette de la grille du dressing. */
export function PieceTile({ piece, width, onPress, dense }: { piece: Piece; width: number; onPress: () => void; dense?: boolean }) {
  const { scheme } = useTheme();
  const art = width * (dense ? 0.62 : 0.56);
  return (
    <Tap testID={`tile-${piece.id}`} onPress={onPress} accessibilityLabel={`${piece.name}, ${wornLabel(piece)}`} accessibilityHint="Ouvre la fiche" style={{ width }} scaleTo={0.97}>
      <View className="bg-raised items-center justify-center" style={{ height: width * (dense ? 1.05 : 1.08), borderRadius: dense ? 16 : 22 }}>
        <Garment kind={piece.kind} tint={piece.tint} size={art} dark={scheme === 'dark'} label={piece.name} />
        {piece.wears === 0 && (
          <View className="absolute bg-caution-soft" style={{ top: 8, left: 8, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
            <T v="small" tone="caution" style={{ fontFamily: 'HankenGrotesk_600SemiBold' }}>
              Jamais
            </T>
          </View>
        )}
      </View>
      {!dense && (
        <View style={{ paddingTop: 8, paddingHorizontal: 2, gap: 1 }}>
          <T v="caption" style={{ fontFamily: 'HankenGrotesk_600SemiBold' }} numberOfLines={1}>
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
    <View className="flex-row items-center" style={{ minHeight: 56, gap: 14, borderBottomWidth: last ? 0 : 1, borderColor: c.rule }}>
      {icon && <Icon name={icon} size={22} color={c.ink} />}
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <T v="body" style={{ fontFamily: 'HankenGrotesk_500Medium' }}>
          {title}
        </T>
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

/** Carte posée sur le papier (contenu, jamais en verre). */
export function Card({ children, style, className = '', testID }: { children: ReactNode; style?: object; className?: string; testID?: string }) {
  return (
    <View testID={testID} className={`${/\bbg-/.test(className) ? '' : 'bg-raised '}${className}`} style={[{ borderRadius: 24, padding: 16 }, style]}>
      {children}
    </View>
  );
}

/** Pastille d'état (« Portée aujourd'hui », « Ton offre »). */
export function Badge({ label, tone = 'positive', icon }: { label: string; tone?: 'positive' | 'caution' | 'neutral'; icon?: IconName }) {
  const { c } = useTheme();
  const bg = tone === 'positive' ? 'bg-positive-soft' : tone === 'caution' ? 'bg-caution-soft' : 'bg-pill';
  const fg = tone === 'positive' ? c.positive : tone === 'caution' ? c.caution : c.ink;
  return (
    <View className={`flex-row items-center self-start ${bg}`} style={{ borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, gap: 5 }}>
      {icon && <Icon name={icon} size={14} color={fg} strokeWidth={2} />}
      <T v="small" tone={tone === 'neutral' ? 'ink' : tone} style={{ fontFamily: 'HankenGrotesk_600SemiBold' }}>
        {label}
      </T>
    </View>
  );
}
