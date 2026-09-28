import type { CSSProperties, ReactNode } from 'react';
import { FlatLay } from '@/components/garments';
import { Wordmark } from '@/components/HeroFan';
import { Segment } from '@/components/Segment';

export { Wordmark };

/** Cadre des écrans de connexion et d'inscription. */
export function AuthShell({
  active,
  title,
  lead,
  children,
}: {
  active: 'inscription' | 'connexion';
  title: ReactNode;
  lead: string;
  children: ReactNode;
}) {
  return (
    <main
      className="page"
      style={{
        maxWidth: 390, margin: '0 auto', minHeight: '100dvh',
        padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 20px calc(env(safe-area-inset-bottom, 0px) + 40px)',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}
    >
      <div className="rise" style={{ display: 'flex', justifyContent: 'center', paddingBlock: 6 }}>
        <Wordmark />
      </div>

      <FlatLay />

      <header className="rise" style={{ '--i': 7, display: 'flex', flexDirection: 'column', gap: 8 } as CSSProperties}>
        <h1 className="hero-title" style={{ fontSize: 33 }}>{title}</h1>
        <p className="lead">{lead}</p>
      </header>

      <div className="rise" style={{ '--i': 8 } as CSSProperties}>
        <Segment
          label="Connexion ou inscription"
          value={active}
          options={[
            { value: 'inscription', label: 'Créer un espace', href: '/inscription' },
            { value: 'connexion', label: 'Me connecter', href: '/connexion' },
          ]}
        />
      </div>

      <section className="glass card rise" style={{ '--i': 9, gap: 16 } as CSSProperties}>
        {children}
      </section>
    </main>
  );
}
