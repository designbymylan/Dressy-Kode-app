import type { CSSProperties, ReactNode } from 'react';

/** Cadre commun aux écrans : largeur mobile, place pour la barre d'onglets. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 390, margin: '0 auto', minHeight: '100dvh',
        padding: '28px 20px 110px', display: 'flex', flexDirection: 'column', gap: 22,
      }}
    >
      {children}
    </main>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h1 style={{ fontSize: 30 }}>{children}</h1>
      {sub ? <p style={{ fontSize: 13, color: 'var(--muted)' }}>{sub}</p> : null}
    </header>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      style={{
        background: 'var(--ground)', borderRadius: 26, padding: 20,
        boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: 14,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

const baseButton: CSSProperties = {
  minHeight: 52, padding: '0 22px', border: 'none', borderRadius: 999,
  fontSize: 15, fontWeight: 700, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  transition: 'transform 200ms cubic-bezier(.2,.8,.2,1)',
};

export const buttonPrimary: CSSProperties = {
  ...baseButton,
  background: 'var(--ink)',
  color: 'var(--ground)',
};

export const buttonQuiet: CSSProperties = {
  ...baseButton,
  background: 'var(--tile)',
  color: 'var(--ink)',
  fontWeight: 500,
};

export const inputStyle: CSSProperties = {
  minHeight: 52, width: '100%', border: '1px solid var(--line)', borderRadius: 18,
  background: 'var(--ground)', padding: '0 18px', fontSize: 15, outline: 'none',
};

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span
        style={{
          fontSize: 11, fontWeight: 500, letterSpacing: '.06em',
          textTransform: 'uppercase', color: 'var(--muted)',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

/** role="alert" : l'erreur est annoncée dès son apparition. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      style={{
        fontSize: 13, lineHeight: 1.45, color: 'var(--danger)',
        background: 'var(--tile)', borderRadius: 14, padding: '10px 14px',
      }}
    >
      {children}
    </p>
  );
}
