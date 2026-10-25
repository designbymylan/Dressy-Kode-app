import type { CSSProperties } from 'react';

/**
 * Le logo de Dresskode (25/10, `design/logo/`) : l'orbe de Kodi, une sphère
 * lavande vers ciel avec son reflet. Il remplace le K étoilé (13/10), retiré
 * à la demande de l'utilisateur. Le dégradé est celui de l'orbe au repos
 * (`STEP_COLORS.look` dans components/Orb.tsx).
 */
export const ORBE = {
  from: '#b9adff',
  to: '#9fd0ff',
  glint: { cx: 42, cy: 21, rx: 20, ry: 13 },
};

export function Monogram({
  size = 40,
  label,
  style,
}: {
  size?: number;
  /** Sans libellé, le monogramme est décoratif (le nom est écrit à côté). */
  label?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: 'block', flexShrink: 0, ...style }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <defs>
        <radialGradient id="dk-orbe" cx="32%" cy="28%" r="85%">
          <stop offset="0%" stopColor={ORBE.from} />
          <stop offset="100%" stopColor={ORBE.to} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#dk-orbe)" />
      <ellipse cx={ORBE.glint.cx} cy={ORBE.glint.cy} rx={ORBE.glint.rx} ry={ORBE.glint.ry} fill="#ffffff" fillOpacity={0.7} />
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
