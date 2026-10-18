'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Les icônes de navigation, les mêmes que l'app mobile (mobile/src/ui/Icon.tsx) :
 * une maison, un t-shirt, une bulle, un calendrier, une silhouette. Au trait
 * au repos, pleines (remplissage pair-impair) quand l'onglet est actif.
 */
const TABS = [
  {
    href: '/accueil',
    label: 'Accueil',
    d: 'M3.5 11 12 4l8.5 7M5.5 9.4V20h13V9.4M10 20v-5.5h4V20',
    full: 'M12 3.4 2.9 11h2.6v9.6h13V11h2.6ZM10 20.6v-6.1h4v6.1Z',
  },
  {
    href: '/dressing',
    label: 'Dressing',
    d: 'M8.6 4 3.5 6.6 2.4 11.4l3.4 1.1V20h12.4v-7.5l3.4-1.1-1.1-4.8L15.4 4c-.5 1.7-1.8 2.7-3.4 2.7S9.1 5.7 8.6 4Z',
    full: 'M8.6 4 3.5 6.6 2.4 11.4l3.4 1.1V20h12.4v-7.5l3.4-1.1-1.1-4.8L15.4 4c-.5 1.7-1.8 2.7-3.4 2.7S9.1 5.7 8.6 4Z',
  },
  {
    href: '/kode',
    label: 'Kode',
    d: 'M3.5 4.5h17v12h-10L5.5 20.5v-4h-2ZM12 7.6l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9Z',
    full: 'M3.5 4.5h17v12h-10L5.5 20.5v-4h-2ZM12 7.6l-.9 2.4-2.4.9 2.4.9.9 2.4.9-2.4 2.4-.9-2.4-.9Z',
    kode: true,
  },
  {
    href: '/calendrier',
    label: 'Calendrier',
    d: 'M3.5 6h17v14.5h-17ZM3.5 10.5h17M8 3.5v4.5M16 3.5v4.5M7.5 13.5h3v3h-3Z',
    full: 'M3.5 6h17v14.5h-17ZM5 11.5v7.5h14v-7.5ZM8 3.5h1.7V6H8ZM14.3 3.5H16V6h-1.7ZM7.5 13.5h3v3h-3Z',
  },
  {
    href: '/moi',
    label: 'Mon compte',
    // Seul l'onglet actif écrit son nom : « Compte », contenu dans le libellé lu.
    short: 'Compte',
    d: 'M12 12.2a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8ZM4.5 20.5c.6-3.9 3.6-6 7.5-6s6.9 2.1 7.5 6Z',
    full: 'M12 12.2a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8ZM4.5 20.5c.6-3.9 3.6-6 7.5-6s6.9 2.1 7.5 6Z',
  },
];

function TabIcon({ d, full, on }: { d: string; full: string; on: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      {on ? (
        <path d={full} fill="currentColor" fillRule="evenodd" stroke="currentColor" strokeWidth="0.6" strokeLinejoin="miter" />
      ) : (
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" strokeLinejoin="miter" />
      )}
    </svg>
  );
}

/**
 * Barre d'onglets de la galerie (mobile : src/ui/TabBar.tsx) : plate, collée
 * en bas sous un filet d'un pixel. Cinq icônes qui se comprennent sans leur
 * nom ; l'onglet actif passe en icône pleine et affiche son nom dessous.
 * Kode au centre, dans un rond noir. Chaque onglet garde son libellé pour les
 * lecteurs d'écran.
 */
export function TabBar() {
  const pathname = usePathname();
  // L'atelier de tenue a sa propre barre d'action : la navigation s'efface.
  if (pathname.startsWith('/tenues/nouvelle')) return null;

  return (
    <nav aria-label="Navigation principale" className="tabbar">
      <div className="tabbar-inner">
        {TABS.map((tab) => {
          const on = pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={on ? 'page' : undefined}
              className={tab.kode ? 'tab tab-kode' : 'tab'}
            >
              {tab.kode ? (
                <span className="tab-kode-disc">
                  <TabIcon d={tab.d} full={tab.full} on={on} />
                </span>
              ) : (
                <TabIcon d={tab.d} full={tab.full} on={on} />
              )}
              <span className="tab-name" aria-hidden="true" style={{ visibility: on ? 'visible' : 'hidden' }} key={on ? 'on' : 'off'}>
                {tab.short ?? tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
