'use client';

import { useState, useTransition } from 'react';
import { retryAiJob, dismissAiJob } from '@/app/actions';
import { Icon } from '@/components/icons';

/** Relancer ou retirer une pièce que l'agent n'a pas pu terminer. */
export function JobActions({ jobId, canRetry }: { jobId: string; canRetry: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: (id: string) => Promise<{ error: string } | undefined>) =>
    start(async () => {
      setError(null);
      const res = await fn(jobId);
      if (res?.error) setError(res.error);
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {canRetry ? (
          <button
            type="button"
            onClick={() => run(retryAiJob)}
            disabled={pending}
            className="dk-btn dk-btn--primary dk-btn--sm dk-tap"
          >
            <Icon name="refresh" size={15} /> Réessayer
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => run(dismissAiJob)}
          disabled={pending}
          className="dk-btn dk-btn--sm dk-tap"
          style={{ fontWeight: 500 }}
        >
          <Icon name="trash" size={15} /> Retirer
        </button>
      </div>
      {error ? <p role="alert" style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</p> : null}
    </div>
  );
}
