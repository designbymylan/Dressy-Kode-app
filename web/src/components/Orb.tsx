'use client';

import type { CSSProperties } from 'react';
import type { OrbStep } from '@/lib/jobs';

/**
 * L'orbe de Kodi (25/10) : une sphère qui tourne, dont la couleur dit
 * l'étape (lavande quand il repère, pêche quand il dessine, ciel quand il
 * compare, menthe quand il range). C'est le seul visage de Kodi qui reste :
 * dans la barre de navigation, et partout où Kodi travaille (`KodeThinking`).
 * La mascotte (ses humeurs, ses bras, ses yeux) a été abandonnée ce jour-là.
 */
const STEP_COLORS: Record<OrbStep, [string, string]> = {
  look: ['#b9adff', '#9fd0ff'],
  draw: ['#ffb89c', '#ffd6e5'],
  check: ['#9fd0ff', '#cfe6ff'],
  store: ['#9fe3c3', '#d4f3e4'],
};

export function Orb({
  size = 44,
  step,
  label,
  style,
}: {
  size?: number;
  step?: OrbStep;
  /** Dans un lien ou un bouton déjà nommé : laisser vide. */
  label?: string;
  style?: CSSProperties;
}) {
  const [c1, c2] = step ? STEP_COLORS[step] : STEP_COLORS.look;
  return (
    <span
      className="orb"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        width: size,
        height: size,
        ['--orb-1' as string]: c1,
        ['--orb-2' as string]: c2,
        ...style,
      }}
    />
  );
}
