'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { planWithKodi } from '@/app/actions';
import { Icon } from '@/components/icons';

/**
 * « Compléter avec Kodi » : Kodi prépare les jours vides, avec les
 * rendez-vous et la météo de chacun. Compte pour une question.
 */
export function FillWeek({ days }: { days: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  function fill() {
    start(async () => {
      setMessage(null);
      const res = await planWithKodi({ days });
      if ('error' in res) return setMessage({ text: res.error, error: true });
      setMessage({ text: res.planned > 1 ? `${res.planned} tenues prévues` : 'Une tenue prévue', error: false });
      router.refresh();
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button type="button" className="btn btn-glass btn-block" onClick={fill} disabled={pending} data-testid="week-fill">
        {pending ? <><span className="spinner" aria-hidden="true" />Kodi prépare ta semaine</> : <><Icon name="sparkle" size={18} /> Compléter avec Kodi</>}
      </button>
      {message ? (
        <p role={message.error ? 'alert' : 'status'} style={{ fontSize: 12.5, color: message.error ? 'var(--danger)' : 'var(--muted)', textAlign: 'center' }}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
