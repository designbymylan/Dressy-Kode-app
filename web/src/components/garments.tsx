/**
 * Silhouettes de vêtements à plat, reprises telles quelles des maquettes
 * (design/_projet/Calendrier.dc.html). Les réutiliser plutôt que d'en
 * redessiner garde l'application et les planches dans le même vocabulaire.
 *
 * Toutes en viewBox 0 0 64 64.
 */
export const SHAPES = {
  blazer: {
    out: 'M23 9 L32 17 L41 9 L52 13 L56 40 L48 42 V54 H16 V42 L8 40 L12 13 Z',
    det: ['M23 9 L26 12 L32 26 L38 12 L41 9', 'M32 26 V54'],
  },
  jean: {
    out: 'M19 7 H45 L48 30 L44 58 H35 L32 32 L29 58 H20 L16 30 Z',
    det: ['M19 13 H45', 'M32 14 V22'],
  },
  chemise: {
    out: 'M23 8 L32 15 L41 8 L54 15 L49 25 L45 22 V56 H19 V22 L15 25 L10 15 Z',
    det: ['M27 8 L32 15 L37 8', 'M32 15 V56', 'M19 48 H45'],
  },
  robe: {
    out: 'M24 8 L32 14 L40 8 L46 14 L42 24 L50 56 H14 L22 24 L18 14 Z',
    det: ['M32 14 V40'],
  },
  escarpin: {
    out: 'M13 44 Q26 39 38 20 L45 24 L32 46 H45 V54 H13 Z',
    det: [],
  },
  trench: {
    out: 'M22 9 L32 16 L42 9 L54 14 L52 40 L46 41 V56 H18 V41 L12 40 L10 14 Z',
    det: ['M32 16 V56', 'M16 34 H48'],
  },
} as const;

export type ShapeName = keyof typeof SHAPES;

export function Garment({
  shape,
  size = 64,
  fill = 'var(--tile-2)',
  stroke = 'var(--muted)',
}: {
  shape: ShapeName;
  size?: number;
  fill?: string;
  stroke?: string;
}) {
  const g = SHAPES[shape];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d={g.out} fill={fill} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
      {g.det.map((d) => (
        <path key={d} d={d} fill="none" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

/**
 * Collage de vêtements posés à plat, légèrement basculés — l'image de
 * marque du brief : « la vitrine d'un magasin de vêtements ».
 */
export function FlatLay() {
  // Teintes pastel des halos de fond : les tuiles de verre en reprennent la lumière.
  const pieces: { shape: ShapeName; x: number; y: number; r: number; s: number; tint: string }[] = [
    { shape: 'trench', x: 4, y: 10, r: -11, s: 104, tint: '#ffe3d6' },
    { shape: 'chemise', x: 86, y: 0, r: 6, s: 96, tint: '#ffffff' },
    { shape: 'blazer', x: 160, y: 14, r: 13, s: 100, tint: '#e6e2ff' },
    { shape: 'jean', x: 44, y: 86, r: 7, s: 92, tint: '#dcecff' },
    { shape: 'robe', x: 124, y: 92, r: -8, s: 96, tint: '#ffe0ec' },
    { shape: 'escarpin', x: 206, y: 104, r: -4, s: 76, tint: '#ffffff' },
  ];

  return (
    <div aria-hidden="true" style={{ position: 'relative', height: 210, width: 284, margin: '0 auto' }}>
      {pieces.map((p, i) => (
        <div
          key={p.shape}
          className="pop"
          style={{ position: 'absolute', left: p.x, top: p.y, '--i': i + 1 } as React.CSSProperties}
        >
          <div
            className="float"
            style={{
              '--r': `${p.r}deg`, animationDelay: `${i * -1.3}s`, animationDuration: `${6.5 + i * 0.5}s`,
              width: p.s, height: p.s, borderRadius: 26,
              background: `linear-gradient(160deg, ${p.tint}, #fbfbfd 85%)`,
              border: '1px solid var(--glass-edge)', boxShadow: 'var(--shadow-float)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            } as React.CSSProperties}
          >
            <Garment shape={p.shape} size={p.s * 0.72} fill="transparent" stroke="#2b2d35" />
          </div>
        </div>
      ))}
    </div>
  );
}
