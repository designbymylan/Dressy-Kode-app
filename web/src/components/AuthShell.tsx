import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

export function Wordmark() {
  return (
    <span
      style={{
        fontSize: 13, fontWeight: 700, letterSpacing: '.28em',
        textTransform: 'uppercase', color: 'var(--ink)',
      }}
    >
      Dressy
    </span>
  );
}

/** Bascule connexion / inscription : contrôle segmenté en verre, choix en bleu. */
function Segments({ active }: { active: 'inscription' | 'connexion' }) {
  const seg = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? 'page' : undefined} className="dk-seg__opt">
      {label}
    </Link>
  );

  return (
    <nav aria-label="Compte" className="dk-seg" style={{ '--n': 2, '--i': active === 'inscription' ? 0 : 1 } as CSSProperties}>
      <span className="dk-seg__thumb" aria-hidden="true" />
      {seg('/inscription', 'Créer un espace', active === 'inscription')}
      {seg('/connexion', 'Me connecter', active === 'connexion')}
    </nav>
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
    <main className="dk-screen" style={{ ['--screen-pb' as string]: '40px', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingBlock: 2 }}>
        <Link href="/bienvenue" aria-label="Retour à l’accueil de Dressy"><Wordmark /></Link>
      </div>

      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ fontSize: 34 }}>{title}</h1>
        <p className="dk-lead" style={{ fontSize: 14.5 }}>{lead}</p>
      </header>

      <Segments active={active} />

      <section className="dk-card" style={{ borderRadius: 28, padding: 22, gap: 16 }}>
        {children}
      </section>
    </main>
  );
}
