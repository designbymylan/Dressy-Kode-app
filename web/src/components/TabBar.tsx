'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/accueil', label: 'Accueil', d: 'M3 11.5 12 4l9 7.5M5 10v10h14V10' },
  // Les tenues se composent à partir du dressing : elles en font partie.
  { href: '/dressing', label: 'Dressing', d: 'M4 7h16M4 12h16M4 17h16', also: ['/tenues'] },
  { href: '/kode', label: 'Kode', d: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2Z', pill: true },
  { href: '/calendrier', label: 'Calendrier', d: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { href: '/moi', label: 'Compte', d: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 20c0-4 4-6 8-6s8 2 8 6' },
];

const within = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/');

/**
 * Barre d'onglets flottante en verre : Kode au centre dans sa pastille noire.
 * Chaque onglet porte son libellé d'un mot (tab-bars.md › Include tab labels) ;
 * l'onglet actif passe en encre, trait plus épais et libellé appuyé, pour ne
 * pas reposer sur la seule couleur.
 */
export function TabBar() {
  const pathname = usePathname();
  // L'atelier de tenue a sa propre barre d'action : la navigation s'efface.
  if (pathname.startsWith('/tenues/nouvelle')) return null;

  return (
    <>
      <div className="scroll-edge" aria-hidden="true" />
      <nav
        aria-label="Navigation principale"
        className="material"
        style={{
          position: 'fixed', left: 16, right: 16, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
          maxWidth: 380, margin: '0 auto', height: 64, borderRadius: 999, zIndex: 20,
          display: 'flex', alignItems: 'stretch', padding: '0 6px',
        }}
      >
        {TABS.map((tab) => {
          const active = within(pathname, tab.href) || (tab.also ?? []).some((h) => within(pathname, h));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, borderRadius: 999,
                color: active ? 'var(--ink)' : 'var(--muted)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'grid', placeItems: 'center',
                  width: tab.pill ? 46 : 28, height: tab.pill ? 30 : 28, borderRadius: 999,
                  background: tab.pill ? 'var(--ink)' : 'transparent',
                  color: tab.pill ? 'var(--on-ink)' : 'inherit',
                  boxShadow: tab.pill ? 'var(--shadow-press)' : 'none',
                }}
              >
                <svg
                  width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d={tab.d} />
                </svg>
              </span>
              {/* 11 px : le minimum iOS. Comme la barre système, les libellés ne grandissent pas avec le texte. */}
              <span style={{ fontSize: 11, lineHeight: '13px', fontWeight: active ? 700 : 500, letterSpacing: '0.01em' }}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
