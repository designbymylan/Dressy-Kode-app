import Link from 'next/link';
import type { ReactNode } from 'react';
import { FlatLay } from '@/components/garments';

export function Wordmark() {
  return (
    <span
      style={{
        fontSize: 13, fontWeight: 700, letterSpacing: '.22em',
        textTransform: 'uppercase', color: 'var(--ink)',
      }}
    >
      Dressy
    </span>
  );
}

/** Bascule connexion / inscription, dans le style « segment » de la charte. */
function Segments({ active }: { active: 'inscription' | 'connexion' }) {
  const seg = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      style={{
        flex: 1, minHeight: 44, borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13.5, fontWeight: on ? 600 : 500,
        background: on ? 'var(--ground)' : 'transparent',
        color: on ? 'var(--ink)' : 'var(--muted)',
        boxShadow: on ? 'var(--shadow-soft)' : 'none',
        transition: 'background-color 200ms cubic-bezier(.2,.8,.2,1)',
      }}
    >
      {label}
    </Link>
  );

  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: 'var(--tile)' }}>
      {seg('/inscription', 'Créer un espace', active === 'inscription')}
      {seg('/connexion', 'Me connecter', active === 'connexion')}
    </div>
  );
}

export function AuthShell({
  active,
  title,
  lead,
  children,
}: {
  active: 'inscription' | 'connexion';
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <main
      style={{
        maxWidth: 390, margin: '0 auto', minHeight: '100dvh',
        padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 18,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', paddingBlock: 6 }}>
        <Wordmark />
      </div>

      <FlatLay />

      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ fontSize: 33 }}>{title}</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--muted)' }}>{lead}</p>
      </header>

      <Segments active={active} />

      <section
        style={{
          background: 'var(--ground)', borderRadius: 28, padding: 22,
          boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        {children}
      </section>
    </main>
  );
}
