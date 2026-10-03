import type { CSSProperties } from 'react';
import { KodeThinking } from '@/components/KodeThinking';
import { THINKING } from '@/lib/thinking';

/**
 * Entre deux écrans de l'application : la silhouette de la page en verre,
 * traversée d'un reflet, et Kode qui prépare la suite. Rien ne saute quand
 * le vrai contenu arrive, les blocs ont la même place.
 */
export default function Loading() {
  return (
    <main className="screen" aria-busy="true">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 8 }}>
        <div className="skeleton" style={{ width: 160, height: 36, borderRadius: 0 }} />
        <div className="skeleton" style={{ width: 220, height: 14, borderRadius: 0 }} />
      </div>
      <div className="skeleton" style={{ height: 150, borderRadius: 0 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton" style={{ aspectRatio: '4 / 5', opacity: 1 - i * 0.1 } as CSSProperties} />
        ))}
      </div>
      <KodeThinking phrases={THINKING.page} center style={{ marginTop: 6 }} />
    </main>
  );
}
