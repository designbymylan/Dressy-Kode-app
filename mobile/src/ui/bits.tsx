import { useEffect, useRef, type ReactNode } from 'react';
import { Image, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import type { Piece, Weather } from '../data/wardrobe';
import { agree, isNew, newLabel, wornLabel } from '../data/wardrobe';
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
  const { c } = useTheme();
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: c.sunk }, anim, style]} />;
}

/** Anneau de progression (précision de Kodi, jauge de places). */
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

/** L'avatar : la photo de profil quand il y en a une, sinon l'initiale. */
export function Avatar({ name, size = 44, on, uri }: { name: string; size?: number; on?: boolean; uri?: string | null }) {
  const { c } = useTheme();
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (uri)
    return (
      <View style={[round, { overflow: 'hidden', backgroundColor: c.stage, borderWidth: 1, borderColor: c['card-edge'] }]}>
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
    );
  return (
    <View style={[round, !on && { borderWidth: 1, borderColor: c['card-edge'] }]} className={`items-center justify-center ${on ? 'bg-primary-bg' : 'bg-sunk'}`}>
      <T v={size >= 64 ? 'stat' : 'bodyStrong'} tone={on ? 'primary-fg' : 'ink'} style={{ fontSize: size * 0.4, lineHeight: size * 0.48 }}>
        {(name.trim().slice(0, 1) || '?').toUpperCase()}
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

/**
 * Vignette de la grille du dressing (05/10, 09/10) : la pièce sur gris
 * studio, une pastille en haut à gauche quand elle est neuve ou jamais
 * portée, puis son nom en capitales espacées et ses ports en gris, comme
 * une fiche produit de grande enseigne.
 */
export function PieceTile({ piece, width, onPress, dense }: { piece: Piece; width: number; onPress: (from?: Origin) => void; dense?: boolean }) {
  const { scheme, c } = useTheme();
  const art = width * (dense ? 0.62 : 0.56);
  const frame = useRef<View>(null);
  const tag = piece.wears === 0 ? (isNew(piece) ? newLabel(piece)[0].toUpperCase() + newLabel(piece).slice(1) : `Jamais porté${agree(piece)}`) : null;
  return (
    <Tap testID={`tile-${piece.id}`} onPress={() => measureOrigin(frame.current, onPress)} accessibilityLabel={`${piece.name}, ${wornLabel(piece)}`} accessibilityHint="Ouvre la fiche" style={{ width }} scaleTo={0.97}>
      <View ref={frame} className="items-center justify-center" style={{ height: width * (dense ? 1.05 : 1.12), borderRadius: dense ? 18 : 22, backgroundColor: c.stage }}>
        <Garment kind={piece.kind} tint={piece.tint} image={piece.image} size={art} dark={scheme === 'dark'} label={piece.name} />
        {tag && !dense && (
          <View style={{ position: 'absolute', top: 10, left: 10, right: 10 }}>
            <Tag label={tag} tone="glass" />
          </View>
        )}
      </View>
      {!dense && (
        <View style={{ paddingTop: 8, paddingHorizontal: 4, gap: 2 }}>
          <T v="label" numberOfLines={1}>
            {piece.name}
          </T>
          <T v="small" tone="ink2" numberOfLines={1}>
            {piece.wears ? `${wornLabel(piece)[0].toUpperCase()}${wornLabel(piece).slice(1)}` : piece.color}
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
        <T v="body" style={F.s500}>
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
  const bg = tone === 'positive' ? 'bg-positive-soft' : tone === 'caution' ? 'bg-caution-soft' : 'bg-pill';
  const fg = tone === 'positive' ? c.positive : tone === 'caution' ? c.caution : c.ink;
  return (
    <View className={`flex-row items-center self-start ${bg}`} style={{ borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, gap: 5 }}>
      {icon && <Icon name={icon} size={14} color={fg} strokeWidth={2} />}
      <T v="small" style={[F.s600, { color: fg }]}>
        {label}
      </T>
    </View>
  );
}

/**
 * Étiquette (09/10, codes des grandes enseignes de mode) : un ou deux mots en
 * capitales espacées, sans fond, qui ouvrent une carte (« TENUE DU JOUR »).
 * Posée sur une image (`glass`) ou en service de Kodi (`butter`), elle
 * devient une petite pastille en casse normale (« Nouveau », « 12× »).
 * `icon` ou `swatch` (pastille de couleur) peuvent la précéder.
 */
export function Tag({ label, tone = 'sunk', icon, swatch, testID }: { label: string; tone?: 'sunk' | 'glass' | 'butter'; icon?: IconName; swatch?: string; dot?: boolean; testID?: string }) {
  const { c } = useTheme();
  const fg = tone === 'butter' ? c['butter-ink'] : c.ink;
  const lead = icon ? (
    <Icon name={icon} size={13} color={fg} strokeWidth={2} />
  ) : swatch ? (
    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: swatch, borderWidth: 1, borderColor: c.rule }} />
  ) : null;
  if (tone === 'sunk')
    return (
      <View testID={testID} className="flex-row items-center self-start" style={{ gap: 6, minHeight: 18 }}>
        {lead}
        <T v="label" style={{ color: fg }} numberOfLines={1}>
          {label}
        </T>
      </View>
    );
  return (
    <View testID={testID} className="flex-row items-center self-start" style={{ backgroundColor: tone === 'butter' ? c.butter : c['glass-strong'], borderRadius: 999, paddingHorizontal: 10, height: 24, gap: 5 }}>
      {lead}
      <T v="small" style={{ color: fg, fontSize: 11.5, lineHeight: 14 }} numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}

/** Un prix barré, à côté du vrai : ce que l'année ou le lot fait gagner. */
export function Struck({ label, tone = 'ink2' }: { label: string; tone?: 'ink2' | 'primary-fg' }) {
  return (
    <T v="small" tone={tone} style={{ fontSize: 11.5, lineHeight: 14, textDecorationLine: 'line-through' }} accessibilityLabel={`au lieu de ${label}`}>
      {label}
    </T>
  );
}

/**
 * Puce (09/10) : un mot ou deux sur gris studio, précédés d'une pastille de
 * couleur quand il s'agit d'une teinte. Sans `onPress`, elle se lit
 * (l'étiquette d'une pièce) ; avec, elle se touche (les suggestions de Kodi).
 */
export function DotChip({ label, onPress, swatch, testID, disabled }: { label: string; onPress?: () => void; swatch?: string; testID?: string; disabled?: boolean }) {
  const { c } = useTheme();
  const body = (
    <>
      {swatch ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: swatch, borderWidth: 1, borderColor: c.rule }} /> : null}
      <T v="small" numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </T>
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: c.pill, opacity: disabled ? 0.5 : 1 };
  if (!onPress)
    return (
      <View testID={testID} style={style} accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  return (
    <Tap testID={testID} onPress={onPress} disabled={disabled} feedback="select" hitSlop={6} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.97} style={style}>
      {body}
    </Tap>
  );
}
