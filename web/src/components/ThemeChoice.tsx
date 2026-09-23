'use client';

import { useTransition } from 'react';
import { setTheme } from '@/app/actions';
import type { Theme } from '@/lib/space';

const OPTIONS: { value: Theme; label: string; swatch: string }[] = [
  { value: 'light', label: 'Clair', swatch: '#EEEDEA' },
  { value: 'dark', label: 'Sombre', swatch: '#151517' },
  { value: 'auto', label: 'Auto', swatch: 'linear-gradient(105deg,#EEEDEA 0 50%,#151517 50%)' },
];

/**
 * Le choix part en base, puis le layout racine relit settings.theme et
 * repose data-theme sur <html> : le changement vaut donc pour toute
 * l'application, pas seulement pour cet écran.
 */
export function ThemeChoice({ current }: { current: Theme }) {
  const [pending, start] = useTransition();

  return (
    <div
      role="radiogroup"
      aria-label="Apparence de l'application"
      style={{ display: 'flex', gap: 10, opacity: pending ? 0.6 : 1 }}
    >
      {OPTIONS.map((opt) => {
        const on = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            // La pastille de couleur n'a pas de texte : sans ce libellé, le
            // bouton serait annoncé sans nom par un lecteur d'écran.
            aria-label={opt.label}
            disabled={pending}
            onClick={() => start(() => { void setTheme(opt.value); })}
            style={{
              flex: 1, border: 'none', background: 'transparent', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: 0, minHeight: 44,
            }}
          >
            <span
              style={{
                width: '100%', height: 56, borderRadius: 18, background: opt.swatch,
                border: `2px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                boxSizing: 'border-box',
                transition: 'border-color 200ms cubic-bezier(.2,.8,.2,1)',
              }}
            />
            <span style={{ fontSize: 12.5, fontWeight: on ? 600 : 400, color: on ? 'var(--ink)' : 'var(--muted)' }}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
