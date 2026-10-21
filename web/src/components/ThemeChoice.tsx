'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { setTheme, setThemeShortcut } from '@/app/actions';
import { applyTheme } from '@/components/ThemeNotch';
import { Icon } from '@/components/icons';
import type { Theme } from '@/lib/space';

const OPTIONS: { value: Theme; label: string; icon: 'sun' | 'moon' | 'contrast' }[] = [
  { value: 'light', label: 'Clair', icon: 'sun' },
  { value: 'dark', label: 'Sombre', icon: 'moon' },
  { value: 'auto', label: 'Auto', icon: 'contrast' },
];

/**
 * Contrôle segmenté en verre ; la pastille bleue glisse sur le choix.
 * Le thème est posé tout de suite sur <html>, puis enregistré sur le
 * compte : le layout racine le relit et il vaut pour toute l'application.
 */
export function ThemeChoice({ current }: { current: Theme }) {
  const [value, setValue] = useState<Theme>(current);
  const [, start] = useTransition();
  const i = OPTIONS.findIndex((o) => o.value === value);

  return (
    <div
      role="radiogroup"
      aria-label="Apparence de l'application"
      className="dk-seg"
      style={{ '--n': OPTIONS.length, '--i': i } as CSSProperties}
    >
      <span className="dk-seg__thumb" aria-hidden="true" />
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className="dk-seg__opt dk-tap"
          onClick={() => {
            setValue(opt.value);
            applyTheme(opt.value);
            start(() => {
              void setTheme(opt.value);
            });
          }}
        >
          <Icon name={opt.icon} size={16} />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Interrupteur « afficher l'encoche clair / sombre ». */
export function ShortcutSwitch({ on }: { on: boolean }) {
  const [value, setValue] = useState(on);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label="Afficher le raccourci clair / sombre en haut à droite"
      className="dk-switch"
      onClick={() => {
        const next = !value;
        setValue(next);
        start(() => {
          void setThemeShortcut(next);
        });
      }}
    />
  );
}
