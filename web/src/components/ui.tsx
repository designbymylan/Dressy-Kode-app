import type { CSSProperties, ReactNode } from 'react';

/**
 * Briques communes aux écrans, sur le système « vitrine de verre » de
 * globals.css. Les styles vivent dans les classes (.glass, .btn…) ; les objets
 * `buttonPrimary`, `inputStyle`… restent exportés pour les composants qui
 * composent encore leurs styles en ligne.
 */

/** Cadre commun : largeur mobile, place pour la barre d'onglets, entrée en fondu. */
export function Screen({ children, bare }: { children: ReactNode; bare?: boolean }) {
  return <main className={bare ? 'screen' : 'screen page'}>{children}</main>;
}

/**
 * Titre d'écran centré. Passe le mot à faire chanter dans `<em className="accent">`,
 * comme « Your <em>Journey</em> » des planches.
 */
export function Title({
  children,
  sub,
  eyebrow,
  size = 34,
}: {
  children: ReactNode;
  sub?: ReactNode;
  eyebrow?: ReactNode;
  size?: number;
}) {
  return (
    <header className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', paddingTop: 8 }}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 className="hero-title" style={{ fontSize: size }}>{children}</h1>
      {sub ? <p className="lead">{sub}</p> : null}
    </header>
  );
}

export function Card({
  children,
  style,
  center,
  strong,
  i,
}: {
  children: ReactNode;
  style?: CSSProperties;
  center?: boolean;
  strong?: boolean;
  /** rang dans la cascade d'entrée */
  i?: number;
}) {
  return (
    <section
      className={`glass card rise${center ? ' card-center' : ''}${strong ? ' glass-strong' : ''}`}
      style={{ ...(i !== undefined ? ({ '--i': i } as CSSProperties) : null), ...style }}
    >
      {children}
    </section>
  );
}

/* Styles en ligne conservés pour les composants existants : mêmes valeurs que .btn. */
const baseButton: CSSProperties = {
  minHeight: 54, padding: '0 24px', border: 'none', borderRadius: 999,
  fontSize: 15, fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  transition: 'transform 260ms cubic-bezier(.34,1.56,.64,1), opacity 200ms',
};

export const buttonPrimary: CSSProperties = {
  ...baseButton,
  background: 'var(--ink)',
  color: 'var(--on-ink)',
  boxShadow: 'var(--shadow-press)',
};

export const buttonQuiet: CSSProperties = {
  ...baseButton,
  background: 'var(--glass-strong)',
  color: 'var(--ink)',
  border: '1px solid var(--glass-edge)',
  boxShadow: 'var(--shadow-glass)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
};

export const inputStyle: CSSProperties = {
  minHeight: 54, width: '100%', border: '1px solid var(--glass-edge)', borderRadius: 999,
  background: 'var(--glass-strong)', padding: '0 22px', fontSize: 15, outline: 'none',
};

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** role="alert" : l'erreur est annoncée dès son apparition. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="note note-error pop">
      {children}
    </p>
  );
}

/** Icône au trait, viewBox 0 0 24 24. */
export function Icon({
  d,
  size = 22,
  stroke = 'currentColor',
  width = 1.7,
}: {
  d: string;
  size?: number;
  stroke?: string;
  width?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
      strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const ICON = {
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  shuffle: 'M4 7h3c5 0 5 10 10 10h3M4 17h3c1.7 0 2.8-1.2 3.7-2.7M13.3 9.7C14.2 8.2 15.3 7 17 7h3M18 4l3 3-3 3M18 14l3 3-3 3',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5Z',
  unlock: 'M7 11V8a5 5 0 0 1 9.6-2M5 11h14v10H5Z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  sparkle: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2Z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4ZM12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  close: 'M6 6l12 12M18 6 6 18',
  hanger: 'M12 5.5a2 2 0 1 1 2 2c-1.1 0-2 .7-2 1.8V11M12 11 3.5 17.2a1 1 0 0 0 .6 1.8h15.8a1 1 0 0 0 .6-1.8L12 11Z',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
} as const;
