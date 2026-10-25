'use client';

import { useEffect, useState } from 'react';

/**
 * Les photos de mode des écrans avant le compte (24/10), les mêmes que sur le
 * mobile (`mobile/src/data/welcome.ts`) : verticales, une tirée au hasard à
 * chaque arrivée, jamais la même deux fois de suite. Le tirage se fait dans le
 * navigateur (la page est statique) : la photo apparaît en fondu.
 */
const PHOTOS = ['rooftop', 'denim', 'studio', 'alley', 'camera', 'river', 'bridge'];
const KEY = 'dk_welcome_photo';

function pick(): number {
  let n = Math.floor(Math.random() * PHOTOS.length);
  try {
    const last = Number(sessionStorage.getItem(KEY));
    if (sessionStorage.getItem(KEY) !== null && n === last) n = (n + 1) % PHOTOS.length;
    sessionStorage.setItem(KEY, String(n));
  } catch {
    /* stockage refusé : tant pis, on garde le tirage */
  }
  return n;
}

export function PhotoBackdrop() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => setN(pick()), []);
  return (
    <div className="photo-backdrop" aria-hidden="true">
      {n !== null ? <img src={`/welcome/${PHOTOS[n]}.jpg`} alt="" className="photo-backdrop__img" /> : null}
      <div className="photo-backdrop__shade" />
    </div>
  );
}
