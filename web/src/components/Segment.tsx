'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';

type Option = { value: string; label: string; href?: string };

/**
 * Sélecteur en pilule dont le curseur noir glisse sous l'option choisie.
 * Avec `href`, chaque option est un lien (l'état vit dans l'URL) ;
 * sinon `onChange` reçoit la valeur.
 */
export function Segment({
  options,
  value,
  onChange,
  label,
}: {
  options: Option[];
  value: string;
  onChange?: (value: string) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const place = () => {
      const el = root.querySelector<HTMLElement>('[data-on="true"]');
      if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(root);
    return () => ro.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="segment" role="group" aria-label={label} data-ready={thumb ? '' : undefined}>
      {thumb ? <span className="segment-thumb" style={{ left: thumb.left, width: thumb.width }} aria-hidden="true" /> : null}
      {options.map((o) => {
        const on = o.value === value;
        return o.href ? (
          <Link key={o.value} href={o.href} data-on={on} aria-current={on ? 'page' : undefined} scroll={false}>
            {o.label}
          </Link>
        ) : (
          <button key={o.value} type="button" data-on={on} aria-pressed={on} onClick={() => onChange?.(o.value)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
