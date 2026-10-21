'use client';

import { useState, useTransition, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { setTheme } from '@/app/actions';
import { Icon } from '@/components/icons';
import type { Theme } from '@/lib/space';

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

/** Pose le thème sur <html> tout de suite, sans attendre le serveur. */
export function applyTheme(next: Theme, origin?: { x: number; y: number }) {
  const root = document.documentElement;
  const doc = document as ViewTransitionDoc;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!origin || !doc.startViewTransition || calm) {
    root.dataset.theme = next;
    return;
  }
  // Le nouveau thème s'ouvre en cercle depuis le doigt.
  const { x, y } = origin;
  const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const vt = doc.startViewTransition(() => {
    root.dataset.theme = next;
  });
  vt.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' },
      ),
    )
    .catch(() => {});
}

export function effectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'auto') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * L'encoche en haut à droite : un interrupteur soleil / lune toujours à
 * portée de pouce. Elle se masque depuis Profil > Paramètres.
 */
export function ThemeNotch({ theme }: { theme: Theme }) {
  const [mode, setMode] = useState<Theme>(theme);
  const [, start] = useTransition();
  const dark = mode === 'dark';

  function toggle(e: MouseEvent<HTMLButtonElement>) {
    const next = effectiveTheme(mode) === 'dark' ? 'light' : 'dark';
    const r = e.currentTarget.getBoundingClientRect();
    applyTheme(next, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    flushSync(() => setMode(next));
    navigator.vibrate?.(8);
    start(() => {
      void setTheme(next);
    });
  }

  return (
    <button
      type="button"
      className="dk-notch"
      data-mode={mode}
      onClick={toggle}
      aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title="Clair / sombre"
    >
      <span className="dk-notch__track">
        <span className="dk-notch__thumb">
          <Icon name="sun" size={14} className="is-sun" />
          <Icon name="moon" size={13} className="is-moon" />
        </span>
      </span>
    </button>
  );
}
