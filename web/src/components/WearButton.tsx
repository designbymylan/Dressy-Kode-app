'use client';

import { useState, useTransition } from 'react';
import { wearToday } from '@/app/actions';
import { buttonPrimary } from '@/components/ui';

/** « Je la porte » : note un port pour chaque pièce de la tenue du jour. */
export function WearButton({ outfitId, worn }: { outfitId: string; worn: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (worn) {
    return <p role="status" style={{ fontSize: 13.5, color: 'var(--muted)' }}>Portée aujourd&apos;hui.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await wearToday(outfitId);
            if (res?.error) setError(res.error);
          })
        }
        style={{ ...buttonPrimary, minHeight: 46, fontSize: 14, opacity: pending ? 0.6 : 1 }}
      >
        {pending ? 'Un instant…' : 'Je la porte'}
      </button>
      {error ? <p role="alert" style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</p> : null}
    </div>
  );
}
