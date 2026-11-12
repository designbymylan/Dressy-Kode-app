'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { marquerAvisLu } from '@/app/actions';
import { avisQuand, type Avis } from '@/lib/avis';

/**
 * L'avis de changement en tête de l'accueil (12/11, `AVIS` dans
 * mobile/src/data/legal.ts) : un bandeau beurre, ce qui change en une phrase,
 * « Lire » le texte, « Compris » le range pour de bon.
 */
export function AvisBand({ avis, today }: { avis: Avis; today: string }) {
  const [hidden, setHidden] = useState(false);
  const [, start] = useTransition();
  if (hidden) return null;
  return (
    <section className="band avis-band rise" data-testid="home-avis" aria-labelledby="avis-titre">
      <p className="eyebrow">{avisQuand(avis, today)}</p>
      <h2 id="avis-titre">{avis.titre}</h2>
      <p>{avis.texte}</p>
      <div className="avis-band__actions">
        <Link href={avis.doc === 'politique' ? '/confidentialite' : '/conditions'} className="btn btn-glass btn-sm">Lire</Link>
        <button
          type="button"
          className="btn btn-sm avis-band__ok"
          onClick={() => {
            setHidden(true);
            start(() => marquerAvisLu(avis.id));
          }}
        >
          Compris
        </button>
      </div>
    </section>
  );
}
