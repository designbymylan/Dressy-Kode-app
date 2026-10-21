'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon, NAV_LINES } from '@/components/icons';
import { Kodi, type KodiLook, type KodiMood } from '@/components/Kodi';

const TABS = [
  { href: '/accueil', label: 'Accueil', icon: 'home' },
  { href: '/dressing', label: 'Dressing', icon: 'hanger' },
  { href: '/kodi', label: 'Kodi', icon: null },
  { href: '/calendrier', label: 'Calendrier', icon: 'calendar' },
  { href: '/moi', label: 'Profil', icon: 'user' },
] as const;

/**
 * La barre de la référence, élément par élément : barre arrondie, bosse
 * centrale qui porte le rond, trait au-dessus de l'onglet actif qui glisse
 * d'un onglet à l'autre, icône au trait qui devient pleine et bleue.
 * Au centre, Kodi regarde l'onglet choisi et sautille quand on change.
 */
const PREVIEW: Record<string, string> = {
  '/accueil': 'accueil', '/dressing': 'dressing', '/kodi': 'kodi', '/calendrier': 'calendrier', '/moi': 'profil',
};

export function TabBar({ active, preview = false }: { active?: string; preview?: boolean }) {
  const pathname = usePathname();
  const current = active ?? pathname;
  const to = (href: string) => (preview ? `/apercu?ecran=${PREVIEW[href]}` : href);
  const index = TABS.findIndex((t) => current === t.href || current.startsWith(t.href + '/'));
  const onKodi = index === 2;

  const [mood, setMood] = useState<KodiMood>('idle');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setMood(index === 2 ? 'happy' : 'surprised');
    const t = window.setTimeout(() => setMood('idle'), 900);
    return () => window.clearTimeout(t);
  }, [index]);

  const look: KodiLook = index < 0 ? 'center' : index < 2 ? 'left' : index > 2 ? 'right' : 'up';

  return (
    <nav aria-label="Navigation principale" className="dk-nav">
      <svg className="dk-nav__bump" viewBox="0 0 132 30" aria-hidden="true">
        <path d="M0 30C18 30 30 27 38 18 46 8 54 2 66 2s20 6 28 16c8 9 20 12 38 12Z" />
      </svg>
      <div className="dk-nav__bar" style={{ '--i': Math.max(index, 0) } as CSSProperties}>
        <span className="dk-nav__ind" data-hidden={index < 0 || onKodi ? 'true' : 'false'} aria-hidden="true" />
        {TABS.map((tab, i) => {
          const on = i === index;
          if (!tab.icon) {
            return (
              <Link
                key={tab.href}
                href={to(tab.href)}
                className="dk-nav__center"
                aria-current={on ? 'page' : undefined}
                aria-label="Kodi, ton styliste"
              >
                <span className="dk-nav__orb">
                  <Kodi size={44} mood={on && mood === 'idle' ? 'wink' : mood} look={look} decorative tap={false} />
                </span>
                <span className="dk-nav__label">{tab.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={tab.href}
              href={to(tab.href)}
              className="dk-nav__item"
              aria-current={on ? 'page' : undefined}
            >
              <span className="dk-nav__icon" aria-hidden="true">
                <svg className="is-line" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={NAV_LINES[tab.icon]} />
                </svg>
                <span className="is-solid" style={{ position: 'absolute', inset: 0, display: 'grid' }}>
                  <Icon name={tab.icon} size={24} />
                </span>
              </span>
              <span className="dk-nav__label">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
