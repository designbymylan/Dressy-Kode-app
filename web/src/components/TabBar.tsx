'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DOT = 4;

const TABS = [
  { href: '/accueil', label: 'Accueil', d: 'M3 11.5 12 4l9 7.5M5 10v10h14V10' },
  { href: '/dressing', label: 'Dressing', d: 'M4 7h16M4 12h16M4 17h16' },
  { href: '/kode', label: 'Kode', d: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2Z', pill: true },
  { href: '/calendrier', label: 'Calendrier', d: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { href: '/moi', label: 'Mon compte', d: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 20c0-4 4-6 8-6s8 2 8 6' },
];

/**
 * Barre d'onglets flottante en verre : Kode au centre en pastille noire,
 * l'onglet actif marqué par son icône pleine encre et un point dessous.
 * Le point est liquide : il s'étire vers l'onglet visé puis se resserre,
 * comme une goutte ; sous la pastille de Kode, il s'y fond.
 */
export function TabBar() {
  const pathname = usePathname();
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const [drop, setDrop] = useState<{ left: number; width: number; moving: boolean } | null>(null);
  const last = useRef<number | null>(null);
  const active = TABS.findIndex((t) => pathname === t.href || pathname.startsWith(t.href + '/'));
  const hidden = pathname.startsWith('/tenues/nouvelle');

  // Le point part de l'onglet quitté, couvre les deux, puis se resserre sur le nouveau.
  useLayoutEffect(() => {
    if (hidden) return;
    const center = (i: number) => {
      const el = links.current[i];
      return el ? el.offsetLeft + el.offsetWidth / 2 : null;
    };
    const to = active >= 0 ? center(active) : null;
    if (to === null) return;
    const from = last.current !== null && last.current !== active ? center(last.current) : null;
    last.current = active;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (from === null || still) {
      setDrop({ left: to - DOT / 2, width: DOT, moving: false });
      return;
    }
    setDrop({ left: Math.min(from, to) - DOT / 2, width: Math.abs(to - from) + DOT, moving: true });
    const t = setTimeout(() => setDrop({ left: to - DOT / 2, width: DOT, moving: true }), 180);
    return () => clearTimeout(t);
  }, [active, hidden]);

  // La barre change de largeur avec la fenêtre : le point suit son onglet.
  useEffect(() => {
    const onResize = () => {
      const el = links.current[active];
      if (el) setDrop({ left: el.offsetLeft + el.offsetWidth / 2 - DOT / 2, width: DOT, moving: false });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active]);

  // L'atelier de tenue a sa propre barre d'action : la navigation s'efface.
  if (hidden) return null;

  return (
    <nav
      aria-label="Navigation principale"
      style={{
        position: 'fixed', left: 20, right: 20, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        maxWidth: 350, margin: '0 auto', height: 66, borderRadius: 999, zIndex: 20,
        background: 'var(--nav-glass)', border: '1px solid var(--glass-edge)',
        backdropFilter: 'blur(24px) saturate(1.6)', WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        boxShadow: 'var(--shadow-float)', display: 'flex', alignItems: 'center',
        justifyContent: 'space-around', padding: '0 12px',
      }}
    >
      {drop ? (
        <span
          aria-hidden="true"
          className="tab-drop"
          data-moving={drop.moving || undefined}
          style={{ left: drop.left, width: drop.width }}
        />
      ) : null}
      {TABS.map((tab, i) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
        return (
          <Link
            key={tab.href}
            ref={(el) => {
              links.current[i] = el;
            }}
            href={tab.href}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            className="btn"
            style={{
              position: 'relative', padding: 0, minHeight: 0,
              width: tab.pill ? 56 : 44, height: tab.pill ? 56 : 44, borderRadius: 999,
              background: tab.pill ? 'var(--ink)' : 'transparent',
              boxShadow: tab.pill ? 'var(--shadow-press)' : 'none',
              color: tab.pill ? 'var(--on-ink)' : active ? 'var(--ink)' : 'var(--muted)',
            }}
          >
            <svg
              width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              style={{ transform: active ? 'scale(1.08)' : 'none', transition: 'transform 400ms cubic-bezier(.34,1.56,.64,1)' }}
            >
              <path d={tab.d} />
            </svg>
            {/* Avant la première mesure (rendu serveur), l'onglet actif porte son propre point. */}
            {active && !tab.pill && !drop ? (
              <span
                aria-hidden="true"
                style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 99, background: 'var(--ink)' }}
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
