import type { CSSProperties } from 'react';
import { iconFor } from '@/lib/wardrobe';

const CARDS = [
  { cat: 'vestes', kind: 'blazer', r: -18, x: -132, y: 30 },
  { cat: 'hauts', kind: 'tshirt', r: -8, x: -68, y: 8 },
  { cat: 'robes', kind: 'robe', r: 0, x: 0, y: 0 },
  { cat: 'bijoux', kind: 'collier', r: 8, x: 68, y: 8 },
  { cat: 'sacs', kind: 'bandouliere', r: 18, x: 132, y: 30 },
];

/**
 * Éventail de cartes en verre, chacune portant une pièce : l'équivalent
 * Dressy des objets 3D qui ouvrent les planches « App design ». Chaque
 * carte entre en cascade puis flotte doucement, à son propre rythme.
 */
export function HeroFan({ scale = 1 }: { scale?: number }) {
  const w = 96 * scale;
  const h = 122 * scale;
  return (
    <div aria-hidden="true" style={{ position: 'relative', height: h + 60 * scale, width: '100%', display: 'grid', placeItems: 'center' }}>
      {CARDS.map((c, i) => (
        <div
          key={c.kind}
          className="pop"
          style={{
            '--i': i + 1,
            position: 'absolute', left: '50%', top: 18 * scale,
            marginLeft: -w / 2 + c.x * scale, marginTop: c.y * scale,
            zIndex: i === 2 ? 3 : i === 1 || i === 3 ? 2 : 1,
          } as CSSProperties}
        >
          <div
            className="float"
            style={{
              '--r': `${c.r}deg`, animationDelay: `${i * -1.4}s`, animationDuration: `${6.5 + i * 0.6}s`,
              width: w, height: h, borderRadius: 0,
              // Gris studio plein, sous un filet : les cartes voisines ne se voient pas au travers.
              background: 'var(--stage)', border: '1px solid var(--bg)', color: 'var(--ink)',
              display: 'grid', placeItems: 'center',
            } as CSSProperties}
          >
            <svg width={52 * scale} height={52 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={1.15} strokeLinecap="square" strokeLinejoin="miter">
              <path d={iconFor(c.cat, c.kind)} />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Wordmark() {
  return (
    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0, textTransform: 'uppercase', color: 'var(--ink)' }}>
      Dresskode
    </span>
  );
}
