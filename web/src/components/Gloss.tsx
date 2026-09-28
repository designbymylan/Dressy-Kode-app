import type { CSSProperties } from 'react';

/**
 * Icône en relief lumineux (classe .gloss de globals.css) : une pastille
 * bombée aux couleurs des halos, avec son reflet. `tone` (0 à 5) varie la
 * teinte d'une option à l'autre ; `on` la fait ressortir quand elle est choisie.
 */
export function GlossIcon({
  d,
  tone = 0,
  size = 44,
  on,
  stroke = 1.6,
}: {
  d: string;
  tone?: number;
  size?: number;
  on?: boolean;
  stroke?: number;
}) {
  const icon = Math.round(size * 0.5);
  return (
    <span
      className="gloss"
      data-tone={tone % 6}
      data-on={on ? 'true' : undefined}
      style={{ '--gs': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}
