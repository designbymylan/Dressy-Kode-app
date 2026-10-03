import type { CSSProperties, ReactNode } from 'react';
import type { OutfitView } from '@/lib/kode';
import { Garment, SHAPE_BY_CATEGORY } from '@/components/garments';

/**
 * Pose des pièces, légèrement basculées, comme dans design/_projet/Kode.dc.html.
 * Les grandes d'abord, les petites devant : l'ordre vient de lib/kode.ts.
 */
const SPOTS = [
  { left: '5%', top: 12, r: -4, size: 112 },
  { left: '37%', top: 34, r: 4, size: 104 },
  { left: '58%', top: 104, r: 0, size: 78 },
  { left: '10%', top: 112, r: 5, size: 66 },
  { left: '71%', top: 10, r: -3, size: 64 },
  { left: '42%', top: 124, r: -6, size: 56 },
];

/**
 * `assemble` : la tenue qui s'assemble. Les pièces arrivent de l'extérieur de
 * la planche, chacune de son côté, se posent l'une après l'autre, puis le
 * titre s'écrit. À réserver au moment où la tenue apparaît (tenue du jour,
 * nouvelle réponse de Kode), pas aux tenues qu'on relit.
 */
export function OutfitCard({ outfit, children, assemble }: { outfit: OutfitView; children?: ReactNode; assemble?: boolean }) {
  const shown = outfit.pieces.slice(0, SPOTS.length);
  return (
    <article className={`glass${assemble ? ' assemble' : ''}`} style={{ width: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, '--n': shown.length } as CSSProperties}>
      <div
        role="img"
        aria-label={`Tenue : ${outfit.pieces.map((p) => p.name).join(', ')}`}
        style={{ background: 'var(--stage)', borderRadius: 0, height: 196, position: 'relative', overflow: 'hidden' }}
      >
        {shown.map((p, i) => {
          const s = SPOTS[i];
          // Chaque pièce vient de son côté de la planche.
          const fromLeft = parseFloat(s.left) < 40;
          const fromTop = s.top < 60;
          return (
            <div
              key={p.id}
              className="outfit-spot"
              style={{
                position: 'absolute', left: s.left, top: s.top, width: s.size, height: s.size,
                transform: `rotate(${s.r}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                '--r': `${s.r}deg`, '--i': i, '--fx': fromLeft ? '-140px' : '140px', '--fy': fromTop ? '-90px' : '90px',
              } as CSSProperties}
            >
              {p.url ? (
                <img
                  src={p.url}
                  alt=""
                  style={{
                    maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                    filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.14))',
                  }}
                />
              ) : (
                <Garment
                  shape={SHAPE_BY_CATEGORY[p.category] ?? 'tshirt'}
                  size={s.size}
                  fill={p.colour ?? 'var(--tile-2)'}
                  stroke="var(--stage-line)"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="outfit-words" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <h3 style={{ fontSize: 19 }}>{outfit.title}</h3>
        {outfit.why ? (
          <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--muted)' }}>{outfit.why}</p>
        ) : null}
        <p style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--muted)' }}>
          {outfit.pieces.map((p) => p.name).join(' · ')}
        </p>
      </div>

      {children}
    </article>
  );
}
