import type { CSSProperties, ReactNode } from 'react';

/**
 * Briques communes aux écrans, sur le système de globals.css (couleurs de la
 * galerie, arrondis et verre).
 * Les styles vivent dans les classes (.glass, .btn…) ; les objets
 * `buttonPrimary`, `inputStyle`… restent exportés pour les composants qui
 * composent encore leurs styles en ligne.
 */

/** Cadre commun : largeur mobile, place pour la barre d'onglets, entrée en fondu. */
export function Screen({ children, bare }: { children: ReactNode; bare?: boolean }) {
  return <main className={bare ? 'screen' : 'screen page'}>{children}</main>;
}

/**
 * Titre d'écran, aligné à gauche comme sur le mobile : petite capitale grise,
 * titre modéré, chapeau gris. Un `<em className="accent">` reste dans la
 * phrase, sans italique ni serif.
 */
export function Title({
  children,
  sub,
  eyebrow,
  size = 28,
}: {
  children: ReactNode;
  sub?: ReactNode;
  eyebrow?: ReactNode;
  size?: number;
}) {
  return (
    <header className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', paddingTop: 8 }}>
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
  minHeight: 52, padding: '0 24px', border: '1px solid transparent', borderRadius: 999,
  fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: 0, textTransform: 'uppercase',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  transition: 'opacity 200ms',
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
  borderColor: 'var(--glass-edge)',
  boxShadow: 'var(--shadow-glass)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
};

export const inputStyle: CSSProperties = {
  minHeight: 52, width: '100%', border: '1px solid transparent', borderRadius: 999,
  background: 'var(--stage)', padding: '0 16px', fontSize: 15, outline: 'none',
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

/** Icône au trait, viewBox 0 0 24 24 : bouts et angles nets, comme sur le mobile. */
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
      strokeWidth={width} strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Les tracés du jeu d'icônes mobile (mobile/src/ui/Icon.tsx), quand ils existent. */
export const ICON = {
  plus: 'M12 4.5v15M4.5 12h15',
  back: 'M15 4.5 7.5 12l7.5 7.5',
  shuffle: 'M4 7h3c5 0 5 10 10 10h3M4 17h3c1.7 0 2.8-1.2 3.7-2.7M13.3 9.7C14.2 8.2 15.3 7 17 7h3M18 4l3 3-3 3M18 14l3 3-3 3',
  lock: 'M5.5 11h13v9.5h-13ZM8.3 11V8a3.7 3.7 0 0 1 7.4 0v3',
  unlock: 'M5.5 11h13v9.5h-13ZM8.3 11V8a3.7 3.7 0 0 1 7.1-1.4',
  check: 'M4.5 12.5l4.8 4.8L19.5 7',
  // L'étincelle de Kode, la même que celle du logo (components/Logo.tsx).
  sparkle: 'M12 3C12.64 9.43 14.57 11.36 21 12C14.57 12.64 12.64 14.57 12 21C11.36 14.57 9.43 12.64 3 12C9.43 11.36 11.36 9.43 12 3Z',
  camera: 'M3.5 7.5h4l1.5-2.5h6l1.5 2.5h4V19h-17ZM12 16a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z',
  close: 'M5.5 5.5l13 13M18.5 5.5l-13 13',
  hanger: 'M10 5.6a2 2 0 1 1 2 2v1.3M12 8.9 3 15.5h18Z',
  trash: 'M4.5 7h15M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 10.5v6M14 10.5v6',
} as const;
