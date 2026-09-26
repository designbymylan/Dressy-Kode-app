/**
 * Illustrations de vêtements : originales, à plat, sans marque, dessinées
 * pour Dresskode (grille 120 × 150). Chaque tracé porte un rôle (base,
 * ombre, détail…) résolu dans la palette de la pièce ; une teinte (tint)
 * remplace la couleur de base et en dérive les ombres, pour décliner une
 * même coupe dans une autre couleur.
 */
import { memo, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';

type Role =
  | 'base' | 'shade' | 'deep' | 'light' | 'shirt' | 'collar' | 'stripe' | 'sole' | 'accent'
  | 'line' | 'rib' | 'fold' | 'stitch' | 'strap' | 'handle' | 'metal' | 'border';
type Spec = [Role, string, 'body'?];
type Kind = { label: string; hang: 'hook' | 'clip' | 'none'; pal: Partial<Record<'base' | 'stripe' | 'stitch' | 'sole' | 'accent', string>>; paths: Spec[] };

function mix(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return '#' + [f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(n >> 16) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

function circles(list: [number, number][], r: number): string {
  return list.map(([x, y]) => `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`).join(' ');
}

/** Décale un tracé fait uniquement de commandes absolues (M, L, Q, Z) : la chaussure de derrière. */
function shift(d: string, dx: number, dy: number): string {
  let i = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (m) => String(+m + (i++ % 2 === 0 ? dx : dy)));
}

const PUMP = 'M22 80 Q22 75 28 76 L42 79 Q58 96 82 103 Q102 109 110 117 Q112 123 105 123 L72 123 Q50 117 34 104 L31 128 L26 128 L24 103 Z';
const BOOT = 'M34 40 L60 40 L62 92 Q80 94 98 100 Q110 104 110 114 L110 118 L32 118 Z';

const KINDS = {
  trench: { label: 'Trench', hang: 'hook', pal: { base: '#C49A6C' }, paths: [
    ['shade', 'M36 22 L22 30 L14 96 L16 104 L28 104 L32 60 Z'],
    ['shade', 'M84 22 L98 30 L106 96 L104 104 L92 104 L88 60 Z'],
    ['base', 'M36 22 L50 16 L60 34 L70 16 L84 22 L92 146 L28 146 Z', 'body'],
    ['shade', 'M50 16 L60 34 L56 54 L44 30 Z'],
    ['shade', 'M70 16 L60 34 L64 54 L76 30 Z'],
    ['deep', 'M31 84 L89 84 L89.6 91 L30.4 91 Z'],
    ['line', 'M62 54 L64 146'],
    ['deep', circles([[53, 62], [68, 62], [53, 72], [68, 72]], 2)],
    ['line', 'M16 92 L30 94 M104 92 L90 94'],
  ] },
  blazer: { label: 'Blazer', hang: 'hook', pal: { base: '#3A3C41' }, paths: [
    ['shade', 'M38 22 L24 30 L17 100 L20 106 L31 106 L34 58 Z'],
    ['shade', 'M82 22 L96 30 L103 100 L100 106 L89 106 L86 58 Z'],
    ['base', 'M38 22 L50 16 L60 40 L70 16 L82 22 L88 112 L32 112 Z', 'body'],
    ['shirt', 'M53 18 L60 40 L67 18 Z'],
    ['light', 'M50 16 L60 40 L57 66 L43 30 Z'],
    ['light', 'M70 16 L60 40 L63 66 L77 30 Z'],
    ['line', 'M60 66 L60 112'],
    ['deep', circles([[60, 78]], 2.4)],
    ['shade', 'M38 88 L50 88 L50 92 L38 92 Z M70 88 L82 88 L82 92 L70 92 Z'],
  ] },
  veste: { label: 'Veste matelassée', hang: 'hook', pal: { base: '#5D6147' }, paths: [
    ['shade', 'M38 24 L22 32 L14 104 L18 112 L32 112 L34 62 Z'],
    ['shade', 'M82 24 L98 32 L106 104 L102 112 L88 112 L86 62 Z'],
    ['base', 'M38 24 L50 18 Q60 24 70 18 L82 24 L88 124 L32 124 Z', 'body'],
    ['deep', 'M48 18 Q60 26 72 18 L72 26 Q60 32 48 26 Z'],
    ['line', 'M33 44 L87 44 M33.7 64 L86.3 64 M34.5 84 L85.5 84 M35.2 104 L84.8 104'],
    ['line', 'M18 60 L33 62 M16 82 L33 84 M102 60 L87 62 M104 82 L87 84'],
    ['stitch', 'M60 30 L60 124'],
  ] },
  pull: { label: 'Pull', hang: 'hook', pal: { base: '#EDE3D1' }, paths: [
    ['shade', 'M40 22 L24 30 L16 110 L20 118 L32 118 L36 64 Z'],
    ['shade', 'M80 22 L96 30 L104 110 L100 118 L88 118 L84 64 Z'],
    ['base', 'M40 22 Q60 32 80 22 L86 122 L34 122 Z', 'body'],
    ['deep', 'M42 21 Q60 34 78 21 L74 19 Q60 28 46 19 Z'],
    ['deep', 'M34.6 112 L85.4 112 L86 122 L34 122 Z'],
    ['deep', 'M16.5 108 L32.4 108 L32 118 L20 118 Z M103.5 108 L87.6 108 L88 118 L100 118 Z'],
    ['rib', 'M46 36 L44 108 M53 38 L52 108 M60 38 L60 108 M67 38 L68 108 M74 36 L76 108'],
  ] },
  cardigan: { label: 'Cardigan', hang: 'hook', pal: { base: '#EDE3D1' }, paths: [
    ['shade', 'M40 22 L24 30 L16 110 L20 118 L32 118 L36 64 Z'],
    ['shade', 'M80 22 L96 30 L104 110 L100 118 L88 118 L84 64 Z'],
    ['base', 'M40 22 L52 20 L60 52 L68 20 L80 22 L86 122 L34 122 Z', 'body'],
    ['shirt', 'M52 20 L60 52 L68 20 Q60 24 52 20 Z'],
    ['deep', 'M34.5 114 L85.5 114 L86 122 L34 122 Z'],
    ['deep', 'M16.4 110 L32.4 110 L32 118 L20 118 Z M103.6 110 L87.6 110 L88 118 L100 118 Z'],
    ['line', 'M60 52 L60 122'],
    ['deep', circles([[60, 64], [60, 80], [60, 96]], 2)],
    ['line', 'M42 92 L54 92 L54 104 L42 104 Z M66 92 L78 92 L78 104 L66 104 Z'],
  ] },
  chemise: { label: 'Chemise', hang: 'hook', pal: { base: '#C9DAEA' }, paths: [
    ['shade', 'M40 22 L26 28 L18 108 L22 114 L32 114 L36 60 Z'],
    ['shade', 'M80 22 L94 28 L102 108 L98 114 L88 114 L84 60 Z'],
    ['base', 'M40 22 L50 18 L60 26 L70 18 L80 22 L84 124 Q60 118 36 124 Z', 'body'],
    ['collar', 'M50 18 L60 26 L55 34 L46 24 Z'],
    ['collar', 'M70 18 L60 26 L65 34 L74 24 Z'],
    ['line', 'M60 30 L60 120'],
    ['deep', circles([[60, 42], [60, 58], [60, 74], [60, 90], [60, 106]], 1.6)],
    ['deep', 'M18.6 102 L32.6 102 L32 114 L22 114 Z M101.4 102 L87.4 102 L88 114 L98 114 Z'],
    ['line', 'M66 44 L76 44 L76 56 L66 56 Z'],
  ] },
  mariniere: { label: 'Marinière', hang: 'hook', pal: { base: '#F7F5F0', stripe: '#2B3A5C' }, paths: [
    ['base', 'M42 22 L24 32 L16 58 L30 64 L38 46 Z'],
    ['base', 'M78 22 L96 32 L104 58 L90 64 L82 46 Z'],
    ['base', 'M42 22 Q60 30 78 22 L84 122 L36 122 Z', 'body'],
    ['stripe', 'M40.9 40 L79.1 40 L79.4 45 L40.6 45 Z M40.2 52 L79.8 52 L80.1 57 L39.9 57 Z M39.5 64 L80.5 64 L80.8 69 L39.2 69 Z M38.8 76 L81.2 76 L81.5 81 L38.5 81 Z M38 88 L82 88 L82.3 93 L37.7 93 Z M37.3 100 L82.7 100 L83 105 L37 105 Z M36.6 112 L83.4 112 L83.7 117 L36.3 117 Z'],
    ['stripe', 'M21 42 L35 49 L33.2 53 L19.4 46.8 Z M99 42 L85 49 L86.8 53 L100.6 46.8 Z'],
    ['shade', 'M44 21 Q60 31 76 21 L73 20 Q60 26 47 20 Z'],
  ] },
  tshirt: { label: 'T-shirt', hang: 'hook', pal: { base: '#F5F3EE' }, paths: [
    ['base', 'M44 22 L24 30 L16 52 L31 58 L38 42 Z'],
    ['base', 'M76 22 L96 30 L104 52 L89 58 L82 42 Z'],
    ['base', 'M44 22 Q60 30 76 22 L82 118 L38 118 Z', 'body'],
    ['shade', 'M16.8 49 L32.2 55 L31 58 L16 52 Z M103.2 49 L87.8 55 L89 58 L104 52 Z'],
    ['deep', 'M47 21 Q60 32 73 21 L70 20 Q60 27 50 20 Z'],
    ['line', 'M38.4 111 L81.6 111'],
  ] },
  debardeur: { label: 'Débardeur', hang: 'hook', pal: { base: '#2B2B2E' }, paths: [
    ['base', 'M46 22 L50 22 Q60 38 70 22 L74 22 Q76 40 84 48 L86 120 L34 120 L36 48 Q44 40 46 22 Z', 'body'],
    ['rib', 'M44 56 L43 116 M52 50 L52 116 M60 52 L60 116 M68 50 L68 116 M76 56 L77 116'],
  ] },
  jean: { label: 'Jean droit', hang: 'clip', pal: { base: '#3E5A86', stitch: '#D2B37A' }, paths: [
    ['base', 'M33.4 24 L86.6 24 L92 146 L66 146 L60 64 L54 146 L28 146 Z', 'body'],
    ['shade', 'M34 14 L86 14 L86.6 24 L33.4 24 Z'],
    ['shade', 'M28.3 140 L54.3 140 L54 146 L28 146 Z M65.7 140 L91.7 140 L92 146 L66 146 Z'],
    ['stitch', 'M62 24 L62 50 Q62 56 57 58'],
    ['stitch', 'M36 30 Q46 34 50 25 M84 30 Q74 34 70 25'],
  ] },
  pantalon: { label: 'Pantalon', hang: 'clip', pal: { base: '#2B2B2E' }, paths: [
    ['base', 'M33.4 24 L86.6 24 L94 146 L68 146 L60 64 L52 146 L26 146 Z', 'body'],
    ['shade', 'M34 14 L86 14 L86.6 24 L33.4 24 Z'],
    ['line', 'M44 30 L39 146 M76 30 L81 146'],
    ['line', 'M50 24 L51 34 M70 24 L69 34'],
  ] },
  short: { label: 'Short', hang: 'clip', pal: { base: '#E7DCC6' }, paths: [
    ['base', 'M34 24 L86 24 L92 92 L66 96 L60 60 L54 96 L28 92 Z', 'body'],
    ['shade', 'M34.6 14 L85.4 14 L86 24 L34 24 Z'],
    ['deep', 'M28.5 86 L54.7 89 L54 96 L28 92 Z M91.5 86 L65.3 89 L66 96 L92 92 Z'],
    ['line', 'M60 24 L60 50'],
  ] },
  jupe: { label: 'Jupe', hang: 'clip', pal: { base: '#7B7F4F' }, paths: [
    ['base', 'M39.5 29 L80.5 29 L100 140 L20 140 Z', 'body'],
    ['shade', 'M40 20 L80 20 L80.5 29 L39.5 29 Z'],
    ['fold', 'M45 29 L32 140 M52 29 L46 140 M60 29 L60 140 M68 29 L74 140 M75 29 L88 140'],
  ] },
  robe: { label: 'Robe', hang: 'hook', pal: { base: '#26231F' }, paths: [
    ['strap', 'M47 14 L48 34 M73 14 L72 34'],
    ['base', 'M44 34 Q60 42 76 34 L78 66 L96 146 L24 146 L42 66 Z', 'body'],
    ['shade', 'M42 64 L78 64 L78.2 68 L41.8 68 Z'],
    ['fold', 'M52 70 L44 146 M60 70 L60 146 M68 70 L76 146'],
  ] },
  baskets: { label: 'Baskets', hang: 'none', pal: { base: '#F5F3EE', sole: '#DEDAD1' }, paths: [
    ['shade', 'M6 94 L6 78 Q8 68 20 66 L42 62 Q50 52 62 56 L86 72 Q100 76 102 86 L102 94 Z'],
    ['sole', 'M4 94 L104 94 L104 100 L4 100 Z'],
    ['base', 'M12 110 L12 94 Q14 84 26 82 L48 78 Q56 68 68 72 L92 88 Q106 92 108 102 L108 110 Z', 'body'],
    ['shade', 'M12 94 Q14 84 26 82 L26 110 L12 110 Z'],
    ['sole', 'M10 110 L110 110 L110 117 Q60 121 10 117 Z'],
    ['line', 'M56 76 L63 83 M62 73 L69 80 M68 72 L74 78'],
  ] },
  mocassins: { label: 'Mocassins', hang: 'none', pal: { base: '#7E4F2C', sole: '#3E2614' }, paths: [
    ['shade', 'M8 96 Q8 80 26 78 L78 76 Q98 76 104 88 L104 96 Z'],
    ['sole', 'M6 96 L106 96 L106 101 L6 101 Z'],
    ['base', 'M14 110 Q14 92 34 90 L84 88 Q104 88 110 100 L110 110 Z', 'body'],
    ['light', 'M58 92 L82 91 L84 97 L58 98 Z'],
    ['sole', 'M12 110 L112 110 L112 115 L12 115 Z'],
  ] },
  bottines: { label: 'Bottines', hang: 'none', pal: { base: '#2A2624', sole: '#171514' }, paths: [
    ['shade', shift(BOOT, -10, -8)],
    ['sole', 'M20 110 L102 110 L102 115 L20 115 Z'],
    ['base', BOOT, 'body'],
    ['deep', 'M52 48 L56 48 L57 88 L53 88 Z'],
    ['line', 'M40 46 L40 80'],
    ['sole', 'M30 118 L112 118 L112 124 L30 124 Z'],
    ['sole', 'M32 124 L48 124 L47 132 L33 132 Z'],
  ] },
  escarpins: { label: 'Escarpins', hang: 'none', pal: { base: '#26231F', sole: '#141210' }, paths: [
    ['shade', shift(PUMP, -12, -12)],
    ['base', PUMP, 'body'],
    ['deep', 'M28 76 L42 79 Q52 90 62 96 Q44 92 30 85 Z'],
    ['sole', 'M26 104 L34 104 L31 128 L26 128 Z'],
  ] },
  sac: { label: 'Sac', hang: 'none', pal: { base: '#A8703E' }, paths: [
    ['handle', 'M40 62 Q42 28 60 28 Q78 28 80 62'],
    ['base', 'M24 62 L96 62 L102 140 L18 140 Z', 'body'],
    ['shade', 'M24 62 L96 62 L96.6 70 L23.4 70 Z'],
    ['line', 'M22 124 L98 124'],
  ] },
  foulard: { label: 'Foulard', hang: 'none', pal: { base: '#C49A6C' }, paths: [
    ['base', 'M60 22 L104 70 L60 118 L16 70 Z', 'body'],
    ['border', 'M60 32 L94 70 L60 108 L26 70 Z'],
    ['accent', circles([[60, 70]], 8)],
    ['accent', circles([[60, 46], [84, 70], [60, 94], [36, 70]], 3)],
  ] },
  ceinture: { label: 'Ceinture', hang: 'none', pal: { base: '#7E4F2C' }, paths: [
    ['base', 'M8 78 Q60 66 112 78 L112 90 Q60 78 8 90 Z', 'body'],
    ['metal', 'M44 64 L60 64 L60 88 L44 88 Z'],
    ['deep', circles([[76, 76.6], [86, 77.6], [96, 79]], 1.5)],
  ] },
} satisfies Record<string, Kind>;

export type GarmentKind = keyof typeof KINDS;
export const GARMENT_KINDS = Object.keys(KINDS) as GarmentKind[];
export const garmentLabel = (kind: GarmentKind) => KINDS[kind].label;
export const hangOf = (kind: GarmentKind) => KINDS[kind].hang;

type Props = {
  kind: GarmentKind;
  /** Largeur en points ; la hauteur suit (× 1,25). */
  size?: number;
  tint?: string;
  hanger?: boolean;
  hangerColor?: string;
  dark?: boolean;
  label?: string;
};

type Drawn = { d: string; fill: string; stroke: string; sw: number };

function build(kind: GarmentKind, tint: string | undefined, hanger: boolean, hc: string, dark: boolean): Drawn[] {
  const k: Kind = KINDS[kind];
  const raw = tint || k.pal.base || '#999999';
  // En sombre, une pièce presque noire se fondrait dans le fond : on la remonte d'un cran (HIG, couleurs « élevées »).
  const base = dark && luminance(raw) < 0.05 ? mix(raw, 0.16) : raw;
  const pal: Record<string, string> = {
    base,
    shade: mix(base, -0.14),
    deep: mix(base, -0.3),
    light: mix(base, 0.12),
    shirt: '#F2EFE9',
    collar: mix(base, 0.45),
    stripe: k.pal.stripe || mix(base, -0.6),
    sole: k.pal.sole || mix(base, -0.12),
    accent: k.pal.accent || mix(base, 0.6),
  };
  const strokes: Partial<Record<Role, [string, number]>> = {
    line: [mix(base, -0.34), 1.2],
    rib: [mix(base, -0.2), 1],
    fold: [mix(base, -0.22), 1.1],
    stitch: [k.pal.stitch || mix(base, 0.4), 1.3],
    strap: [base, 2.2],
    handle: [mix(base, -0.18), 4],
    metal: ['#C8B27A', 3],
    border: [mix(base, 0.5), 1.4],
  };
  // En sombre, une pièce foncée disparaîtrait sur le fond : un liseré clair la détoure (HIG, Dark Mode).
  const rim = dark ? 'rgba(255,255,255,0.26)' : 'none';
  const out: Drawn[] = [];
  const mode = hanger ? k.hang : 'none';
  if (mode === 'hook') {
    out.push({ d: 'M60 17 L60 9 Q60 3 65 3 Q70 3 70 8', fill: 'none', stroke: hc, sw: 2.4 });
    out.push({ d: 'M60 17 L30 28 M60 17 L90 28', fill: 'none', stroke: hc, sw: 3 });
  }
  if (mode === 'clip') {
    out.push({ d: 'M60 10 L60 5 Q60 0 65 0 Q70 0 70 5', fill: 'none', stroke: hc, sw: 2.4 });
    out.push({ d: 'M34 10 L86 10', fill: 'none', stroke: hc, sw: 3 });
  }
  for (const [role, d, body] of k.paths) {
    const s = strokes[role];
    if (s) out.push({ d, fill: 'none', stroke: s[0], sw: s[1] });
    else out.push({ d, fill: pal[role], stroke: body ? rim : 'none', sw: 1 });
  }
  if (mode === 'clip') out.push({ d: 'M36 8 L41 8 L41 18 L36 18 Z M79 8 L84 8 L84 18 L79 18 Z', fill: hc, stroke: 'none', sw: 0 });
  return out;
}

function GarmentBase({ kind, size = 120, tint, hanger = false, hangerColor = '#9C7A48', dark = false, label }: Props) {
  const paths = useMemo(() => build(kind, tint, hanger, hangerColor, dark), [kind, tint, hanger, hangerColor, dark]);
  return (
    <Svg
      width={size}
      height={Math.round(size * 1.25)}
      viewBox="0 0 120 150"
      accessibilityRole="image"
      accessibilityLabel={label ?? KINDS[kind].label}
      style={{ overflow: 'visible' }}
    >
      {paths.map((p, i) => (
        <Path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

export const Garment = memo(GarmentBase);
