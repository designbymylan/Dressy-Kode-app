'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';

export type DockItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  /** Pastille noire, plus grande : l'action phare de la barre. */
  pill?: boolean;
};

const SPRING = { damping: 20, stiffness: 300, mass: 0.5 };
/** Au-delà de ce déplacement, un appui devient un glissé. */
const SLIDE_THRESHOLD = 8;

/**
 * Dock magnétique, porté de @componentry/magnetic-dock sans Tailwind.
 *
 * Les icônes grossissent et se soulèvent à l'approche du pointeur. Sur
 * ordinateur, la souris suffit ; sur téléphone, le doigt glisse le long de la
 * barre et le relâcher ouvre l'onglet sous le doigt (le quitter par le haut
 * annule). Un simple appui reste un lien ordinaire.
 */
export function MagneticDock({
  items,
  label,
  maxScale = 1.32,
  distance = 110,
  style,
}: {
  items: DockItem[];
  label: string;
  maxScale?: number;
  /** Rayon d'influence du pointeur, en pixels. */
  distance?: number;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const still = useReducedMotion() ?? false;
  const pointerX = useMotionValue(Infinity);
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const touch = useRef<{ x: number; slid: boolean } | null>(null);
  const swallowClick = useRef(false);
  const [labelled, setLabelled] = useState<number | null>(null);

  const nearest = (x: number): number | null => {
    let best: number | null = null;
    let gap = Infinity;
    for (let i = 0; i < items.length; i++) {
      const el = linkRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const d = Math.abs(x - (r.left + r.width / 2));
      if (d < gap) { gap = d; best = i; }
    }
    return best;
  };

  const follow = (x: number) => {
    if (!still) pointerX.set(x);
    const i = nearest(x);
    setLabelled((prev) => (prev === i ? prev : i));
  };

  const release = () => {
    touch.current = null;
    pointerX.set(Infinity);
    setLabelled(null);
  };

  return (
    <nav
      ref={navRef}
      aria-label={label}
      onPointerDown={(e) => {
        swallowClick.current = false;
        if (e.pointerType === 'mouse') return;
        touch.current = { x: e.clientX, slid: false };
        if (!still) pointerX.set(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse') return follow(e.clientX);
        const t = touch.current;
        if (!t) return;
        if (!t.slid && Math.abs(e.clientX - t.x) > SLIDE_THRESHOLD) t.slid = true;
        if (t.slid) follow(e.clientX);
        else if (!still) pointerX.set(e.clientX);
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'mouse') return;
        const slid = touch.current?.slid ?? false;
        release();
        if (!slid) return;
        // Le navigateur ouvrirait le lien de départ : on choisit nous-mêmes.
        swallowClick.current = true;
        const bar = navRef.current?.getBoundingClientRect();
        const inside = bar
          && e.clientX >= bar.left && e.clientX <= bar.right
          && e.clientY >= bar.top - 48 && e.clientY <= bar.bottom + 24;
        const i = inside ? nearest(e.clientX) : null;
        if (i !== null && !items[i].active) router.push(items[i].href);
      }}
      onPointerCancel={release}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') release(); }}
      onClickCapture={(e) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.preventDefault();
      }}
      style={{ ...style, touchAction: 'none' }}
    >
      <LazyMotion features={domAnimation} strict>
        {items.map((item, i) => (
          <DockLink
            key={item.href}
            item={item}
            pointerX={pointerX}
            maxScale={maxScale}
            distance={distance}
            showLabel={labelled === i}
            onFocusVisible={(on) => setLabelled(on ? i : null)}
            linkRef={(el) => { linkRefs.current[i] = el; }}
          />
        ))}
      </LazyMotion>
    </nav>
  );
}

function DockLink({
  item,
  pointerX,
  maxScale,
  distance,
  showLabel,
  onFocusVisible,
  linkRef,
}: {
  item: DockItem;
  pointerX: MotionValue<number>;
  maxScale: number;
  distance: number;
  showLabel: boolean;
  onFocusVisible: (on: boolean) => void;
  linkRef: (el: HTMLAnchorElement | null) => void;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const size = item.pill ? 56 : 44;

  // Écart horizontal entre le pointeur et le centre de l'icône. L'agrandissement
  // part du bas et ne décale pas ce centre : la mesure ne s'emballe pas.
  const offset = useTransform(pointerX, (x) => {
    const el = ref.current;
    if (!el || !Number.isFinite(x)) return distance;
    const r = el.getBoundingClientRect();
    return x - (r.left + r.width / 2);
  });
  const scale = useSpring(useTransform(offset, [-distance, 0, distance], [1, maxScale, 1]), SPRING);
  const lift = useTransform(scale, (s) => (s - 1) * -22);
  // L'étiquette suit le sommet de l'icône agrandie.
  const labelY = useTransform(scale, (s) => (s - 1) * -(size + 22));

  return (
    <Link
      ref={(el) => { ref.current = el; linkRef(el); }}
      href={item.href}
      aria-label={item.label}
      aria-current={item.active ? 'page' : undefined}
      draggable={false}
      onFocus={(e) => onFocusVisible(e.currentTarget.matches(':focus-visible'))}
      onBlur={() => onFocusVisible(false)}
      style={{
        position: 'relative', flex: 'none', width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 999, userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
      }}
    >
      <m.span
        aria-hidden="true"
        style={{
          scale, y: lift, transformOrigin: '50% 100%',
          width: '100%', height: '100%', borderRadius: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: item.pill ? 'var(--ink)' : 'transparent',
          boxShadow: item.pill ? 'var(--shadow-press)' : 'none',
          color: item.pill ? 'var(--on-ink)' : item.active ? 'var(--ink)' : 'var(--muted)',
        }}
      >
        {item.icon}
      </m.span>

      {item.active && !item.pill ? (
        <span
          aria-hidden="true"
          className="pop"
          style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 99, background: 'var(--ink)' }}
        />
      ) : null}

      <AnimatePresence>
        {showLabel ? (
          <m.span
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', x: '-50%', y: labelY,
              padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap', pointerEvents: 'none',
              fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)',
              background: 'var(--glass-strong)', border: '1px solid var(--glass-edge)',
              backdropFilter: 'blur(20px) saturate(1.6)', WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
              boxShadow: 'var(--shadow-glass)',
            }}
          >
            {item.label}
          </m.span>
        ) : null}
      </AnimatePresence>
    </Link>
  );
}
