'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Une feuille qui monte du bas de l'écran (jamais un pop-up : elle ne
 * s'ouvre que sur un geste). Posée dans le corps de la page : une carte en
 * verre (backdrop-filter) serait sinon le repère de `position: fixed` et la
 * coincerait. Au clavier : le focus entre dans la feuille, Échap la ferme, et
 * le focus revient là où il était.
 */
export function Sheet({
  title,
  kicker,
  onClose,
  children,
}: {
  title: string;
  kicker?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    // Un champ qui a pris le focus de lui-même (autoFocus) le garde.
    if (!box.current?.contains(document.activeElement)) box.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', key);
    // Le fond ne défile pas sous la feuille.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);

  return createPortal(
    <>
      <div className="dk-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={box} className="dk-sheet" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <span className="dk-sheet__grip" aria-hidden="true" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {kicker ? <p className="eyebrow">{kicker}</p> : null}
          <h2 id={id} style={{ fontSize: 24 }}>{title}</h2>
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}
