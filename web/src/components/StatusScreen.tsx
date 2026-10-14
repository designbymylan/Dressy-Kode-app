import type { ReactNode } from 'react';
import { Monogram } from '@/components/Logo';

/**
 * Écran d'état (page introuvable, erreur) : le monogramme, un titre, une
 * phrase, puis les actions. Même cadre que les écrans de compte (`.auth`),
 * pour qu'une impasse reste dans la charte et propose toujours une sortie.
 */
export function StatusScreen({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <main className="auth page" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
      <div className="auth-head rise">
        <Monogram size={56} />
        <h1 className="auth-title">{title}</h1>
        <p className="lead">{lead}</p>
      </div>
      <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        {children}
      </div>
    </main>
  );
}
