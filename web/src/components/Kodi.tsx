'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Kodi, le styliste de Dressy, en personne.
 *
 * Une petite boutique vivante : un auvent rayé en guise de chapeau (la
 * « vitrine » de la marque), un crochet de cintre sur le dessus, un corps
 * beurre et des yeux chocopie. Sa bouche « porte de boutique » s'ouvre
 * quand il est surpris ou qu'il parle.
 *
 * Les humeurs vivent en CSS (globals.css, data-mood) ; ce composant ne
 * gère que la forme des yeux et de la bouche, le regard et le toucher.
 */

export type KodiMood =
  | 'idle'
  | 'happy'
  | 'wave'
  | 'thinking'
  | 'surprised'
  | 'sleepy'
  | 'love'
  | 'sad'
  | 'celebrate'
  | 'listening'
  | 'wink'
  | 'talking'
  | 'shy';

export type KodiLook = 'center' | 'left' | 'right' | 'up' | 'down' | 'up-left';

const LOOK: Record<KodiLook, [number, number]> = {
  center: [0, 0],
  left: [-2.8, 0.4],
  right: [2.8, 0.4],
  up: [0.4, -2.6],
  down: [0, 2.4],
  'up-left': [-2.2, -2.2],
};

const BUTTER = '#FEEFB8';
const CHOCO = '#432F2E';
const BLUE = '#C4DAE8';
const BLUSH = '#F4C9A8';

/** Réactions au toucher, jouées tour à tour. */
const REACTIONS: KodiMood[] = ['happy', 'wink', 'love', 'surprised', 'celebrate'];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function Eyes({ mood }: { mood: KodiMood }) {
  const arc = (x: number, up = true) => (
    <path
      d={up ? `M${x - 5} 64 Q${x} 57 ${x + 5} 64` : `M${x - 5} 61.5 Q${x} 66 ${x + 5} 61.5`}
      fill="none"
      stroke={CHOCO}
      strokeWidth="3.4"
      strokeLinecap="round"
    />
  );
  const open = (x: number, rx = 4.6, ry = 6) => (
    <g>
      <ellipse cx={x} cy={62} rx={rx} ry={ry} fill={CHOCO} />
      <circle cx={x + 1.6} cy={62 - ry * 0.38} r={rx * 0.36} fill="#FFFFFF" />
    </g>
  );
  const heart = (x: number) => (
    <path
      className="kodi__heart"
      d={`M${x} 67.5c-.3 0-.6-.1-.8-.3-2.4-2-5.7-4.6-5.7-7.9a3.4 3.4 0 0 1 6.5-1.5 3.4 3.4 0 0 1 6.5 1.5c0 3.3-3.3 5.9-5.7 7.9-.2.2-.5.3-.8.3Z`}
      fill={CHOCO}
    />
  );

  switch (mood) {
    case 'happy':
    case 'celebrate':
      return <>{arc(39)}{arc(61)}</>;
    case 'wink':
      return <>{arc(39)}{open(61)}</>;
    case 'sleepy':
    case 'shy':
      return <>{arc(39, false)}{arc(61, false)}</>;
    case 'love':
      return <>{heart(39)}{heart(61)}</>;
    case 'surprised':
    case 'listening':
      return <>{open(39, 5.2, 7.2)}{open(61, 5.2, 7.2)}</>;
    case 'sad':
      return (
        <>
          {open(39, 4.2, 5.2)}
          {open(61, 4.2, 5.2)}
          <path d="M33 54.5 43 51.5M67 54.5 57 51.5" stroke={CHOCO} strokeWidth="2.6" strokeLinecap="round" />
        </>
      );
    default:
      return <>{open(39)}{open(61)}</>;
  }
}

function Mouth({ mood }: { mood: KodiMood }) {
  const line = { fill: 'none', stroke: CHOCO, strokeWidth: 3.2, strokeLinecap: 'round' as const };
  const smile = <path d="M44 75 Q50 81 56 75" {...line} />;
  // La porte de boutique de l'icône d'origine, devenue bouche.
  const door = <path d="M45.6 81.5V77a4.4 4.4 0 0 1 8.8 0v4.5Z" fill={CHOCO} />;

  switch (mood) {
    case 'happy':
    case 'celebrate':
    case 'love':
      return (
        <g>
          <path d="M42.5 73.5Q50 86 57.5 73.5Z" fill={CHOCO} />
          <ellipse cx="50" cy="79.6" rx="3.6" ry="1.9" fill={BLUSH} />
        </g>
      );
    case 'surprised':
      return door;
    case 'thinking':
      return <path d="M45.5 77.5 Q48 75.8 50.5 77.2 T55 76.4" {...line} />;
    case 'sleepy':
      return <circle cx="50" cy="77.5" r="2.4" fill={CHOCO} />;
    case 'sad':
      return <path d="M44 80 Q50 73.5 56 80" {...line} />;
    case 'wink':
      return <path d="M44 75 Q51 81.5 57 73.5" {...line} />;
    case 'shy':
      return <path d="M46.5 76.5 Q50 79.5 53.5 76.5" {...line} />;
    case 'listening':
      return <ellipse cx="50" cy="77" rx="2.6" ry="2.2" fill={CHOCO} />;
    case 'talking':
      return (
        <>
          <g className="kodi__mouth-a">{smile}</g>
          <g className="kodi__mouth-b">{door}</g>
        </>
      );
    default:
      return smile;
  }
}

function Effects({ mood }: { mood: KodiMood }) {
  if (mood === 'shy') {
    return (
      <g className="kodi__hands">
        {[37, 63].map((x) => (
          <ellipse key={x} cx={x} cy="62" rx="9" ry="7.4" fill={BUTTER} stroke={CHOCO} strokeWidth="3.2" />
        ))}
      </g>
    );
  }
  if (mood === 'thinking') {
    return (
      <g className="kodi__fx" fill="currentColor">
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            className="kodi__dot"
            cx={80 + i * 7}
            cy={14 - i * 5}
            r={2.2 + i * 0.6}
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </g>
    );
  }
  if (mood === 'sleepy') {
    return (
      <g className="kodi__fx" fill="currentColor" fontFamily="inherit" fontWeight="800">
        {[0, 1].map((i) => (
          <text key={i} className="kodi__z" x={80 + i * 4} y={24} fontSize={11 - i * 2} style={{ animationDelay: `${i * 1.1}s` }}>
            z
          </text>
        ))}
      </g>
    );
  }
  if (mood === 'celebrate') {
    const bits = [
      [-34, -38, BLUE], [30, -44, BUTTER], [-44, -6, BUTTER], [42, -12, BLUE],
      [-22, -52, 'currentColor'], [16, -56, BLUE], [-48, -30, BLUE], [46, -34, 'currentColor'],
    ] as const;
    return (
      <g className="kodi__fx">
        {bits.map(([x, y, c], i) => (
          <rect
            key={i}
            className="kodi__bit"
            x="48"
            y="40"
            width={i % 2 ? 4 : 5}
            height={i % 2 ? 6 : 5}
            rx="1.2"
            fill={c}
            style={{ '--cx': `${x}px`, '--cy': `${y}px`, animationDelay: `${i * 90}ms` } as CSSProperties}
          />
        ))}
      </g>
    );
  }
  return null;
}

export function Kodi({
  mood = 'idle',
  size = 96,
  track = false,
  look,
  tap = true,
  enter = false,
  shadow = false,
  label = 'Kodi',
  decorative = false,
  className,
  style,
}: {
  mood?: KodiMood;
  size?: number;
  /** Les yeux suivent le pointeur (et regardent ailleurs de temps en temps sur mobile). */
  track?: boolean;
  /** Regard imposé, prioritaire sur le suivi. */
  look?: KodiLook;
  /** Un toucher le fait réagir. */
  tap?: boolean;
  /** Arrivée en rebond et auvent qui se déroule. */
  enter?: boolean;
  shadow?: boolean;
  label?: string;
  /** Dans un lien ou un bouton déjà nommé : masqué aux lecteurs d'écran. */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const uid = useId();
  const clip = `kodi-awning-${hash(uid)}`;
  const [reaction, setReaction] = useState<KodiMood | null>(null);
  const turn = useRef(0);
  const shown = reaction ?? mood;

  // Regard : imposé, ou qui suit le pointeur.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (x: number, y: number) => {
      el.style.setProperty('--kx', `${x}px`);
      el.style.setProperty('--ky', `${y}px`);
    };
    if (look) {
      set(...LOOK[look]);
      return;
    }
    if (!track) {
      set(0, 0);
      return;
    }

    let raf = 0;
    let lastMove = 0;
    const onMove = (e: PointerEvent) => {
      lastMove = Date.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height * 0.62);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 200);
        set((dx / d) * 3 * k, (dy / d) * 2.6 * k);
      });
    };
    // Sans souris, Kodi jette un œil autour de lui de temps en temps.
    const glances: KodiLook[] = ['center', 'left', 'right', 'up', 'center', 'down'];
    let g = 0;
    const timer = window.setInterval(() => {
      if (Date.now() - lastMove < 4000) return;
      g = (g + 1) % glances.length;
      set(...LOOK[glances[g]]);
    }, 2600);

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  }, [look, track]);

  // Une réaction ne dure qu'un instant, puis l'humeur du moment revient.
  useEffect(() => {
    if (!reaction) return;
    const t = window.setTimeout(() => {
      setReaction(null);
      ref.current?.classList.remove('is-tapped');
    }, 1400);
    return () => window.clearTimeout(t);
  }, [reaction]);

  function poke() {
    if (!tap) return;
    const el = ref.current;
    if (el) {
      el.classList.remove('is-tapped');
      // Relance l'animation même sur deux touchers rapprochés.
      void el.getBoundingClientRect();
      el.classList.add('is-tapped');
    }
    setReaction(REACTIONS[turn.current++ % REACTIONS.length]);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8);
  }

  const blink = `${(hash(uid) % 40) / 10}s`;
  const stripes = Array.from({ length: 8 }, (_, i) => i);

  return (
    <svg
      ref={ref}
      className={`kodi${enter ? ' kodi--enter' : ''}${className ? ` ${className}` : ''}`}
      data-mood={shown}
      data-tap={tap ? 'true' : undefined}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      onClick={tap ? poke : undefined}
      style={{ ...style, ['--kodi-blink' as string]: blink }}
    >
      <defs>
        <clipPath id={clip}>
          <path d="M14 23a9 9 0 0 1 9-9h54a9 9 0 0 1 9 9v14a9 9 0 0 1-18 0 9 9 0 0 1-18 0 9 9 0 0 1-18 0 9 9 0 0 1-18 0Z" />
        </clipPath>
      </defs>

      {shadow ? <ellipse cx="50" cy="96" rx="25" ry="3.6" fill="currentColor" opacity="0.1" /> : null}

      <g className="kodi__all">
        <g className="kodi__body">
          {/* bras */}
          <g className="kodi__arm-l">
            <ellipse cx="14.5" cy="71" rx="5.6" ry="8.6" transform="rotate(24 14.5 71)" fill={BUTTER} stroke={CHOCO} strokeWidth="3.2" />
          </g>
          <g className="kodi__arm-r">
            <ellipse cx="85.5" cy="71" rx="5.6" ry="8.6" transform="rotate(-24 85.5 71)" fill={BUTTER} stroke={CHOCO} strokeWidth="3.2" />
          </g>

          {/* corps */}
          <rect x="18" y="33" width="64" height="60" rx="25" fill={BUTTER} stroke={CHOCO} strokeWidth="3.2" />

          {/* crochet de cintre */}
          <g className="kodi__hook">
            <path d="M50 15V10.6a4.6 4.6 0 1 0-4.6-4.6" fill="none" stroke={CHOCO} strokeWidth="3.2" strokeLinecap="round" />
          </g>

          {/* auvent rayé */}
          <g className="kodi__awning">
            <g clipPath={`url(#${clip})`}>
              {stripes.map((i) => (
                <rect key={i} x={14 + i * 9} y="12" width="9" height="40" fill={i % 2 ? '#FFFFFF' : BLUE} />
              ))}
            </g>
            <path
              d="M14 23a9 9 0 0 1 9-9h54a9 9 0 0 1 9 9v14a9 9 0 0 1-18 0 9 9 0 0 1-18 0 9 9 0 0 1-18 0 9 9 0 0 1-18 0Z"
              fill="none"
              stroke={CHOCO}
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
          </g>

          {/* visage */}
          <ellipse cx="28.5" cy="73" rx="5.4" ry="3.2" fill={BLUSH} opacity="0.85" />
          <ellipse cx="71.5" cy="73" rx="5.4" ry="3.2" fill={BLUSH} opacity="0.85" />
          <g className="kodi__eyes">
            <g className="kodi__look">
              <Eyes mood={shown} />
            </g>
          </g>
          <Mouth mood={shown} />
        </g>
        <Effects mood={shown} />
      </g>
    </svg>
  );
}

/** Kodi qui parle : la mascotte et sa bulle. */
export function KodiSay({
  mood = 'idle',
  size = 52,
  children,
  track,
  style,
}: {
  mood?: KodiMood;
  size?: number;
  children: ReactNode;
  track?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div className="kodi-say" style={style}>
      <Kodi mood={mood} size={size} track={track} />
      <p className="kodi-say__bubble">{children}</p>
    </div>
  );
}
