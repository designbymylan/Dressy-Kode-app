'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon, NAV_LINES } from '@/components/icons';
import { Orb } from '@/components/Orb';

const TABS = [
  { href: '/accueil', label: 'Accueil', icon: 'home' },
  // Les tenues se composent à partir du dressing : elles en font partie.
  { href: '/dressing', label: 'Dressing', icon: 'hanger', also: ['/tenues'] },
  { href: '/kodi', label: 'Kodi', icon: null },
  { href: '/calendrier', label: 'Calendrier', icon: 'calendar' },
  { href: '/moi', label: 'Profil', icon: 'user', also: ['/offres'] },
] as const;

/**
 * La barre de la référence « Inspiration Navbar » (21/10), élément par
 * élément : barre arrondie, bosse centrale qui porte le rond, petit trait
 * au-dessus de l'onglet actif qui glisse d'un onglet à l'autre, icône au
 * trait qui devient pleine et bleue, tous les noms écrits. Au centre,
 * l'orbe de Kodi (25/10) : il tourne, et ouvre la conversation au toucher.
 * Elle reste en verre (décision du 03/10).
 */
export function TabBar({ active }: { active?: string } = {}) {
  const path = usePathname();
  // `active` : l'aperçu du design (/apercu) montre un onglet choisi.
  const pathname = active ?? path;
  const index = TABS.findIndex((t) =>
    [t.href, ...('also' in t ? t.also : [])].some((h) => pathname === h || pathname.startsWith(h + '/')),
  );

  // La silhouette (barre et bosse) se mesure : son contour et son ombre suivent la largeur.
  const navRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth));
    ro.observe(el);
    setWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  // L'atelier de tenue a sa propre barre d'action : la navigation s'efface.
  if (pathname.startsWith('/tenues/nouvelle')) return null;

  const outline = width ? silhouette(width) : null;

  return (
    <nav ref={navRef} aria-label="Navigation principale" className="dk-nav">
      {outline ? (
        // L'ombre, seulement hors de la silhouette : le verre reste transparent dedans.
        <svg className="dk-nav__shade" width={width} height={HEIGHT + BUMP} viewBox={`0 ${-BUMP} ${width} ${HEIGHT + BUMP}`} aria-hidden="true">
          <defs>
            <filter id="dk-nav-ombre" x="-10%" y="-60%" width="120%" height="240%">
              {/* Une ombre tout autour, qui dessine la bosse, et une plus large dessous. */}
              <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="pres" />
              <feFlood className="is-near" />
              <feComposite in2="pres" operator="in" result="autour" />
              <feGaussianBlur in="SourceAlpha" stdDeviation="14" />
              <feOffset dy="10" result="loin" />
              <feFlood className="is-far" />
              <feComposite in2="loin" operator="in" result="dessous" />
              <feMerge result="ombres">
                <feMergeNode in="autour" />
                <feMergeNode in="dessous" />
              </feMerge>
              <feComposite in="ombres" in2="SourceAlpha" operator="out" />
            </filter>
          </defs>
          <path d={outline} filter="url(#dk-nav-ombre)" />
        </svg>
      ) : null}
      <span className="dk-nav__bump" aria-hidden="true" />
      <div className="dk-nav__bar" style={{ '--i': Math.max(index, 0) } as CSSProperties}>
        <span className="dk-nav__ind" data-hidden={index < 0 || index === 2 ? 'true' : 'false'} aria-hidden="true" />
        {TABS.map((tab, i) => {
          const on = i === index;
          if (!tab.icon) {
            return (
              <Link key={tab.href} href={tab.href} className="dk-nav__center" aria-current={on ? 'page' : undefined} aria-label="Kodi, ton styliste">
                <span className="dk-nav__orb">
                  <Orb size={46} />
                </span>
                <span className="dk-nav__label" aria-hidden="true">{tab.label}</span>
              </Link>
            );
          }
          return (
            <Link key={tab.href} href={tab.href} className="dk-nav__item" aria-current={on ? 'page' : undefined}>
              <span className="dk-nav__icon" aria-hidden="true">
                <svg className="is-line" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={NAV_LINES[tab.icon]} />
                </svg>
                <span className="is-solid">
                  <Icon name={tab.icon} size={24} />
                </span>
              </span>
              <span className="dk-nav__label">{tab.label}</span>
            </Link>
          );
        })}
      </div>
      {outline ? (
        <svg className="dk-nav__edge" width={width} height={HEIGHT + BUMP} viewBox={`0 ${-BUMP} ${width} ${HEIGHT + BUMP}`} aria-hidden="true">
          <path d={outline} />
        </svg>
      ) : null}
    </nav>
  );
}

const HEIGHT = 68;
const BUMP = 30;
const RADIUS = 24;

/**
 * Le contour de la barre et de sa bosse, pour une largeur donnée : la même
 * courbe que la bosse de globals.css (132 px de large, 26 de haut), posée
 * au milieu d'un rectangle aux coins de 24 px.
 */
function silhouette(w: number): string {
  const r = RADIUS;
  const x = w / 2 - 66;
  return [
    `M${r} 0H${x}`,
    // La bosse de globals.css (viewBox 132 × 30) ramenée à ses 28 px de haut.
    `C${x + 18} 0 ${x + 30} -2.8 ${x + 38} -11.2`,
    `C${x + 46} -20.53 ${x + 54} -26.13 ${x + 66} -26.13`,
    `C${x + 78} -26.13 ${x + 86} -20.53 ${x + 94} -11.2`,
    `C${x + 102} -2.8 ${x + 114} 0 ${x + 132} 0`,
    `H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${HEIGHT - r}A${r} ${r} 0 0 1 ${w - r} ${HEIGHT}`,
    `H${r}A${r} ${r} 0 0 1 0 ${HEIGHT - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`,
  ].join('');
}
