import type { CSSProperties } from 'react';

/**
 * Le logo de Dresskode (piste A validée le 13/10, `design/logo/`) : un K fin
 * dont la branche haute s'arrête sur l'étincelle de Kode. Le K suit la
 * couleur du texte (noir en clair, blanc en sombre) ; l'étincelle aussi, sauf
 * sur fond noir où elle peut passer en rose poudré (`sparkle="var(--butter)"`).
 */
export const K = {
  stem: 'M26.75 14H33.25V86H26.75Z',
  upper: 'M32.3 63.3L63.3 32.3L58.7 27.7L27.7 58.7Z',
  lower: 'M41.53 49.11L72.93 86L81.47 86L46.48 44.89Z',
  spark: 'M71 3C72 13 75 16 85 17C75 18 72 21 71 31C70 21 67 18 57 17C67 16 70 13 71 3Z',
};

export function Monogram({
  size = 40,
  sparkle = 'currentColor',
  label,
  style,
}: {
  size?: number;
  sparkle?: string;
  /** Sans libellé, le monogramme est décoratif (le nom est écrit à côté). */
  label?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
      style={{ display: 'block', flexShrink: 0, ...style }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <path d={K.stem} />
      <path d={K.upper} />
      <path d={K.lower} />
      <path d={K.spark} fill={sparkle} />
    </svg>
  );
}

/** La marque écrite, DRESSKODE en capitales espacées ; `mark` pose le monogramme devant. */
export function Wordmark({ mark = false, size = 13 }: { mark?: boolean; size?: number }) {
  if (!mark) return <span className="brand" style={{ fontSize: size }}>Dresskode</span>;
  return (
    <span className="brand-lockup">
      <Monogram size={Math.round(size * 1.9)} />
      <span className="brand" style={{ fontSize: size }}>Dresskode</span>
    </span>
  );
}
