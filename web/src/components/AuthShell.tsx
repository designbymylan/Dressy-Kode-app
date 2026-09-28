import type { CSSProperties, ReactNode } from 'react';
import { Wordmark } from '@/components/HeroFan';
import { GlossIcon } from '@/components/Gloss';
import { ICON } from '@/components/ui';

export { Wordmark };

/**
 * Cadre des écrans de compte (connexion, inscription, mot de passe), sur le
 * modèle choisi : la marque, un titre, une phrase, le formulaire, puis le
 * lien vers l'autre écran. Une seule colonne, centrée, rien d'autre.
 */
export function AuthShell({
  title,
  lead,
  children,
  footer,
}: {
  title: ReactNode;
  lead: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="auth page">
      <div className="auth-head rise">
        <GlossIcon d={ICON.hanger} tone={1} size={60} stroke={1.5} />
        <Wordmark />
      </div>

      <header className="auth-head rise" style={{ '--i': 1 } as CSSProperties}>
        <h1 className="auth-title">{title}</h1>
        <p className="lead">{lead}</p>
      </header>

      <div className="rise" style={{ '--i': 2, display: 'flex', flexDirection: 'column', gap: 16 } as CSSProperties}>
        {children}
      </div>

      {footer ? (
        <p className="auth-switch rise" style={{ '--i': 3 } as CSSProperties}>{footer}</p>
      ) : null}
    </main>
  );
}
