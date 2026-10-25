'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { OrbStep } from '@/lib/jobs';
import { Orb } from '@/components/Orb';

/**
 * « Kodi réfléchit » : son orbe, qui tourne et change de couleur selon
 * l'étape, et une phrase qui change toutes les deux secondes environ,
 * comme s'il commentait ce qu'il fait. Aucun nom de modèle ni de service
 * n'apparaît jamais à l'écran.
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
      <Orb size={Math.round(size * 1.45)} step={step} />
      <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
        <span key={i} className="kode-phrase">{phrases[i % phrases.length]}</span>
        <span className="dots" aria-hidden="true"><i /><i /><i /></span>
      </span>
    </div>
  );
}
