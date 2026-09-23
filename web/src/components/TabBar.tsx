'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/accueil', label: 'Accueil', d: 'M3 11.5 12 4l9 7.5M5 10v10h14V10' },
  { href: '/dressing', label: 'Dressing', d: 'M4 7h16M4 12h16M4 17h16' },
  { href: '/kode', label: 'Kode', d: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2Z', pill: true },
  { href: '/calendrier', label: 'Calendrier', d: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { href: '/moi', label: 'Mon compte', d: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 20c0-4 4-6 8-6s8 2 8 6' },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      style={{
        position: 'fixed', left: 20, right: 20, bottom: 12, maxWidth: 350, margin: '0 auto',
        height: 62, borderRadius: 999, background: 'var(--nav-glass)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center',
        justifyContent: 'space-around', padding: '0 12px', zIndex: 10,
      }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex', width: tab.pill ? 56 : 44, height: tab.pill ? 56 : 44,
              alignItems: 'center', justifyContent: 'center',
              borderRadius: 999,
              background: tab.pill ? 'var(--ink)' : 'transparent',
              boxShadow: tab.pill ? '0 10px 24px rgba(13,13,14,.35)' : undefined,
            }}
          >
            <svg
              width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke={tab.pill ? 'var(--ground)' : active ? 'var(--ink)' : 'var(--muted)'}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            >
              <path d={tab.d} />
            </svg>
          </Link>
        );
      })}
    </nav>
  );
}
