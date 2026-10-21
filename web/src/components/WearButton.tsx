'use client';

import { useState, useTransition } from 'react';
import { toggleWear } from '@/app/actions';
import { Icon } from '@/components/icons';

/**
 * Le cintre en verre posé sur chaque vignette : « je l'ai porté
 * aujourd'hui ». Bleu quand c'est noté — la couleur de la sélection.
 */
export function WearButton({ id, name, initial }: { id: string; name: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className="dk-btn dk-btn--icon dk-btn--sm dk-tap"
      aria-pressed={on}
      aria-label={on ? `${name} : porté aujourd’hui (annuler)` : `J’ai porté ${name} aujourd’hui`}
      title={on ? 'Porté aujourd’hui' : 'Je l’ai porté aujourd’hui'}
      disabled={pending}
      style={{ opacity: 1 }}
      onClick={() => {
        const next = !on;
        setOn(next);
        navigator.vibrate?.(8);
        start(async () => {
          const res = await toggleWear(id);
          if ('error' in res) setOn(!next);
        });
      }}
    >
      <Icon name={on ? 'check' : 'hanger'} size={17} />
    </button>
  );
}
