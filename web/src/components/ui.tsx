import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { Kodi } from '@/components/Kodi';

/** Classes des boutons verre (voir globals.css). `dk-tap` déclenche le geste des icônes. */
export const btn = {
  primary: 'dk-btn dk-btn--primary dk-tap',
  glass: 'dk-btn dk-tap',
  butter: 'dk-btn dk-btn--butter dk-tap',
  choco: 'dk-btn dk-btn--choco dk-tap',
  ghost: 'dk-btn dk-btn--ghost dk-tap',
  icon: 'dk-btn dk-btn--icon dk-tap',
} as const;

/** Cadre commun aux écrans : largeur de téléphone, place pour l'encoche et la barre d'onglets. */
export function Screen({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <main className="dk-screen" style={style}>
      {children}
    </main>
  );
}

export function Title({
  children,
  sub,
  action,
}: {
  children: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <h1 className="dk-h1">{children}</h1>
        {sub ? <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>{sub}</p> : null}
      </div>
      {action}
    </header>
  );
}

/** « Titre de section ……… Voir tout › », comme sur la référence minimaliste. */
export function SectionHead({ title, href, more = 'Voir tout' }: { title: ReactNode; href?: string; more?: string }) {
  return (
    <div className="dk-section-head">
      <h2 className="dk-h2">{title}</h2>
      {href ? (
        <Link href={href} className="dk-see-all dk-tap">
          {more}
          <Icon name="chevronRight" size={16} />
        </Link>
      ) : null}
    </div>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section className="dk-card" style={style}>
      {children}
    </section>
  );
}

/** Bouton rond en verre, une icône et un nom pour les lecteurs d'écran. */
export function IconLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link href={href} className={btn.icon} aria-label={label}>
      <Icon name={icon} size={20} />
    </Link>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="dk-label">{label}</span>
      {children}
    </label>
  );
}

/** role="alert" : l'erreur est annoncée dès son apparition. Kodi compatit. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 13, lineHeight: 1.45, color: 'var(--danger)',
        background: 'var(--tile)', borderRadius: 18, padding: '8px 14px 8px 8px',
      }}
    >
      <Kodi mood="sad" size={40} decorative tap={false} />
      <p>{children}</p>
    </div>
  );
}

/** Barre de progression de la référence : gélule cernée, gélule pleine qui porte le %. */
export function ProgressBar({
  value,
  size = 'lg',
  label,
  busy = false,
  style,
}: {
  value: number;
  size?: 'lg' | 'sm';
  label: string;
  busy?: boolean;
  style?: CSSProperties;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={`dk-pbar${size === 'sm' ? ' dk-pbar--sm' : ''}${busy ? ' dk-pbar--busy' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={busy ? undefined : pct}
      style={style}
    >
      <div className="dk-pbar__fill" style={busy ? undefined : { width: `${pct}%` }}>
        {busy ? null : <span className="dk-pbar__val">{pct}%</span>}
      </div>
    </div>
  );
}

/** Section noire qui coule dans la page blanche (référence « découpage de section »). */
export function Cut({
  children,
  flip,
  close,
  fill,
  style,
  label,
}: {
  children: ReactNode;
  flip?: boolean;
  close?: boolean;
  fill?: boolean;
  style?: CSSProperties;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={`dk-cut${flip ? ' dk-cut--flip' : ''}${close ? ' dk-cut--close' : ''}${fill ? ' dk-cut--fill' : ''}`}
      style={style}
    >
      {children}
    </section>
  );
}

/** Formulaire de recherche du dressing : champ verre et bouton de filtres. */
export function SearchBar({ q = '', placeholder = 'Rechercher une pièce…' }: { q?: string; placeholder?: string }) {
  return (
    <form action="/dressing" role="search" style={{ display: 'flex', gap: 10 }}>
      <label className="dk-search">
        <span className="dk-sr">Rechercher dans le dressing</span>
        <Icon name="search" size={19} />
        <input type="search" name="q" defaultValue={q} placeholder={placeholder} autoComplete="off" />
      </label>
      <Link href="/dressing#filtres" className={btn.choco + ' dk-btn--icon'} aria-label="Filtrer par catégorie" style={{ width: 50, height: 50, borderRadius: 16 }}>
        <Icon name="sliders" size={20} />
      </Link>
    </form>
  );
}
