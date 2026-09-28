'use client';

import { useEffect, useState, type CSSProperties } from 'react';

/**
 * « Kode réfléchit » : l'orbe qui respire et une phrase qui change toutes
 * les deux secondes environ, comme si Kode commentait ce qu'il fait. Aucun
 * nom de modèle ni de service n'apparaît jamais à l'écran.
 */
export function KodeThinking({
  phrases,
  every = 2200,
  size = 28,
  style,
  center,
}: {
  phrases: readonly string[];
  every?: number;
  size?: number;
  style?: CSSProperties;
  center?: boolean;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (phrases.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % phrases.length), every);
    return () => clearInterval(t);
  }, [phrases, every]);

  return (
    <div
      className="kode-thinking"
      role="status"
      style={{ justifyContent: center ? 'center' : undefined, ...style }}
    >
      <span className="kode-orb" style={{ '--orb': `${size}px` } as CSSProperties} aria-hidden="true" />
      <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>
        <span key={i} className="kode-phrase">{phrases[i % phrases.length]}</span>
        <span className="dots" aria-hidden="true"><i /><i /><i /></span>
      </span>
    </div>
  );
}
