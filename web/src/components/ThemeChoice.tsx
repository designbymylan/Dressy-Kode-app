'use client';

import { useState, useTransition } from 'react';
import { setTheme, setThemeShortcut } from '@/app/actions';
import { Segment } from '@/components/Segment';
import { applyTheme } from '@/components/ThemeNotch';
import type { Theme } from '@/lib/space';

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'auto', label: 'Auto' },
];

/**
 * Le choix se voit tout de suite (posé sur <html>), puis part en base : le
 * layout racine relit settings.theme et repose data-theme, le changement
 * vaut donc pour toute l’application et sur tous les appareils.
 */
export function ThemeChoice({ current }: { current: Theme }) {
  const [value, setValue] = useState<Theme>(current);
  const [, start] = useTransition();

  return (
    <Segment
      label="Apparence de l’application"
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        const next = v as Theme;
        setValue(next);
        applyTheme(next);
        start(() => {
          void setTheme(next);
        });
      }}
    />
  );
}

/** « Raccourci clair / sombre » : montre ou masque l’encoche du haut de l’écran. */
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
