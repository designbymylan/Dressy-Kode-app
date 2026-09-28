'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

/**
 * Bouton d'envoi d'un formulaire : pendant l'attente, un anneau tourne et le
 * libellé dit ce qui se passe. Le bouton garde sa largeur, rien ne saute.
 */
export function SubmitButton({
  label,
  pending: pendingLabel = 'Un instant',
  className = 'btn btn-primary btn-block',
  style,
  disabled,
  name,
  value,
}: {
  label: ReactNode;
  pending?: ReactNode;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  // Plusieurs boutons dans un même formulaire : seul celui qui a été touché tourne.
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-busy={mine || undefined}
      className={className}
      style={style}
    >
      {mine ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : label}
    </button>
  );
}
