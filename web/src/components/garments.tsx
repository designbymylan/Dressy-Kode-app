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
  // Les suivantes viennent de design/_projet/Kodi.dc.html.
  tshirt: {
    out: 'M22 8 L26 6 Q32 11 38 6 L42 8 L55 16 L50 25 L45 21 V56 H19 V21 L14 25 L9 16 Z',
    det: ['M26 7 Q32 12 38 7'],
  },
  basket: {
    out: 'M9 43 H20 L29 36 L35 38 L40 44 H53 Q59 46 59 51 V54 H9 Z',
    det: ['M20 43 L29 36', 'M9 50 H59'],
  },
  sac: {
    out: 'M17 22 H47 L51 54 H13 Z',
    det: ['M25 22 V18 A7 7 0 0 1 39 18 V22'],
  },
} as const;

export type ShapeName = keyof typeof SHAPES;

/** La silhouette qui représente une pièce sans photo, d'après sa catégorie. */
export const SHAPE_BY_CATEGORY: Record<string, ShapeName> = {
  hauts: 'tshirt',
  bas: 'jean',
  robes: 'robe',
  vestes: 'blazer',
  chaussures: 'basket',
  sacs: 'sac',
  accessoires: 'sac',
};

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
 * Le collage de Bienvenue, « la vitrine d'un magasin de vêtements » du brief :
 * les pièces dessinées par Nano Banana (`Image inspiration outfit/`, 18/10),
 * détourées par `tools/detour-photos.cjs` et réduites dans `public/pieces/`,
 * chacune posée sur sa tuile, qui flotte à son propre rythme.
 */
export function FlatLay() {
  const pieces: { src: string; x: number; y: number; r: number; s: number }[] = [
    { src: 'veste-survetement', x: 0, y: 14, r: -11, s: 92 },
    { src: 'jogging-gris', x: 76, y: 0, r: 5, s: 88 },
    { src: 'sweat-capuche', x: 152, y: 8, r: -6, s: 92 },
    { src: 'jean-gris', x: 232, y: 2, r: 10, s: 84 },
    { src: 'sabots', x: 18, y: 104, r: 7, s: 84 },
    { src: 'sac', x: 96, y: 92, r: -8, s: 90 },
    { src: 'pantalon-noir', x: 176, y: 100, r: 6, s: 86 },
    { src: 'ceinture', x: 246, y: 118, r: -5, s: 72 },
  ];

  return (
    <div aria-hidden="true" style={{ position: 'relative', height: 214, width: 318, maxWidth: '100%', margin: '0 auto' }}>
      {pieces.map((p, i) => (
        <div
          key={p.src}
          className="pop"
          style={{ position: 'absolute', left: p.x, top: p.y, '--i': i + 1 } as React.CSSProperties}
        >
          <div
            className="float"
            style={{
              '--r': `${p.r}deg`, animationDelay: `${i * -1.3}s`, animationDuration: `${6.5 + i * 0.5}s`,
              width: p.s, height: p.s, borderRadius: 26,
              background: 'var(--glass-strong)', border: '1px solid var(--glass-edge)', boxShadow: 'var(--shadow-float)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            } as React.CSSProperties}
          >
            <img
              src={`/pieces/${p.src}.webp`}
              alt=""
              width={Math.round(p.s * 0.78)}
              height={Math.round(p.s * 0.78)}
              decoding="async"
              fetchPriority={i < 3 ? 'high' : 'auto'}
              style={{ objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.12))' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
