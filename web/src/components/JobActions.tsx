'use client';

import { useState, useTransition } from 'react';
import { retryAiJob, dismissAiJob } from '@/app/actions';

const small = {
  minHeight: 44, padding: '0 16px', borderRadius: 999, border: 'none',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
} as const;

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
            style={{ ...small, background: 'var(--ink)', color: 'var(--ground)', opacity: pending ? 0.6 : 1 }}
          >
            Réessayer
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => run(dismissAiJob)}
          disabled={pending}
          style={{ ...small, background: 'var(--tile)', color: 'var(--ink)', fontWeight: 500, opacity: pending ? 0.6 : 1 }}
        >
          Retirer
        </button>
      </div>
      {error ? <p role="alert" style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</p> : null}
    </div>
  );
}
