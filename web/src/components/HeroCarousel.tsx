'use client';

import { useRef, useState, type ReactNode } from 'react';

/** Bannières qui défilent au doigt, avec les points de la référence. */
export function HeroCarousel({ slides, label }: { slides: ReactNode[]; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const go = (i: number) => {
    const el = ref.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (el && slide) el.scrollTo({ left: slide.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft), behavior: 'smooth' });
  };

  return (
    <section aria-roledescription="carrousel" aria-label={label} style={{ position: 'relative' }}>
      <div
        ref={ref}
        className="dk-snap"
        onScroll={(e) => {
          const el = e.currentTarget;
          const first = el.children[0] as HTMLElement | undefined;
          if (!first) return;
          setIndex(Math.round(el.scrollLeft / (first.offsetWidth + 12)));
        }}
      >
        {slides.map((s, i) => (
          <div key={i} style={{ width: '100%' }} aria-roledescription="diapositive" aria-label={`${i + 1} sur ${slides.length}`}>
            {s}
          </div>
        ))}
      </div>
      {slides.length > 1 ? (
        <div className="dk-dots" style={{ position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)' }}>
          {slides.map((_, i) => (
            <button key={i} type="button" aria-label={`Bannière ${i + 1}`} aria-current={i === index} onClick={() => go(i)} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
