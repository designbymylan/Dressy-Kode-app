'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { OrbStep } from '@/lib/jobs';

/**
 * « Kode réfléchit » : l'anneau noir qui tourne et une phrase qui change
 * toutes les deux secondes environ, comme si Kode commentait ce qu'il fait.
 * Aucun nom de modèle ni de service n'apparaît jamais à l'écran. `step`
 * (repérage, dessin, contrôle, rangement) reste posé sur l'anneau pour les
 * styles, la galerie ne le colore plus.
 */
export function KodeThinking({
  phrases,
  every = 2200,
  size = 28,
  style,
  center,
  step,
}: {
  phrases: readonly string[];
  every?: number;
  size?: number;
  style?: CSSProperties;
  center?: boolean;
  step?: OrbStep;
}) {
  const [i, setI] = useState(0);
  const list = useRef(phrases);
  list.current = phrases;
  const key = phrases.join('|');
  // Nouvelle étape : on repart de sa première phrase, l'anneau, lui, continue de tourner.
  useEffect(() => {
    setI(0);
    if (list.current.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % list.current.length), every);
    return () => clearInterval(t);
  }, [key, every]);

  return (
    <div
      className="kode-thinking"
      role="status"
      style={{ justifyContent: center ? 'center' : undefined, ...style }}
    >
      <span className="kode-orb" data-step={step} style={{ '--orb': `${size}px` } as CSSProperties} aria-hidden="true" />
      <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
        <span key={i} className="kode-phrase">{phrases[i % phrases.length]}</span>
        <span className="dots" aria-hidden="true"><i /><i /><i /></span>
      </span>
    </div>
  );
}
