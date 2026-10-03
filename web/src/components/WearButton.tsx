'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { wearToday } from '@/app/actions';

/**
 * « Je la porte » : note un port pour chaque pièce de la tenue du jour.
 * Au geste, le bouton laisse place à une coche qui se dessine, de petites
 * pastilles aux couleurs de la tenue s'envolent et le compteur de ports
 * monte. Récompenser le fait de porter ce qu'on a, c'est tout le propos.
 */
export function WearButton({
  outfitId,
  worn,
  colours,
  ports,
  count,
}: {
  outfitId: string;
  worn: boolean;
  /** Les couleurs des pièces, pour les pastilles. */
  colours: string[];
  /** Ports déjà notés pour ces pièces. */
  ports: number;
  /** Nombre de pièces de la tenue (un port chacune). */
  count: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [just, setJust] = useState(false);

  if (worn || just) {
    // Tant que la page n'est pas relue, le compteur avance tout seul.
    const total = worn ? ports : ports + count;
    return (
      <div className={`worn-line${just ? ' play' : ''}`} role="status">
        <span className="worn-check" aria-hidden="true">
          {just
            ? Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2 + (i % 2) * 0.3;
                const d = 34 + (i % 3) * 14;
                return (
                  <i
                    key={i}
                    className="spark"
                    style={{ '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d - 18}px`, background: colours[i % Math.max(1, colours.length)] ?? 'var(--hi)' } as CSSProperties}
                  />
                );
              })
            : null}
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="21" />
            <path d="M14 22.5l5.5 5.5L30.5 17" />
          </svg>
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong style={{ fontSize: 14.5, fontWeight: 500 }}>Portée aujourd&apos;hui</strong>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            <b className="worn-tally" style={{ color: 'var(--ink)', fontWeight: 500 }}>{total}</b> port{total > 1 ? 's' : ''} pour ces pièces
          </span>
        </span>
      </div>
    );
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
            if (res?.error) return setError(res.error);
            setJust(true);
            if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(14);
          })
        }
        className="btn btn-primary btn-block"
      >
        {pending ? <><span className="spinner" aria-hidden="true" />C’est noté</> : 'Je la porte'}
      </button>
      {error ? <p role="alert" style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</p> : null}
    </div>
  );
}
