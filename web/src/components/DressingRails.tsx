'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import Link from 'next/link';
import type { Piece } from '@/lib/garments';
import { PieceArt, pieceKindLabel } from '@/components/PieceArt';
import { Icon, ICON } from '@/components/ui';

export type RailView = { id: string; label: string; icon: string; pieces: Piece[] };
export type WearStat = { wears: number; last: string | null };

/** Une pièce arrivée depuis moins de ce temps tombe sur son portant à sa première apparition. */
const FRESH_MS = 20 * 60 * 1000;
const SEEN_KEY = 'dk-portant-vues';

/** Ce qui va avec une pièce : une règle simple et lisible (même esprit que l'app mobile). */
const GOES: Record<string, string[]> = {
  vestes: ['hauts', 'bas', 'robes'],
  hauts: ['bas', 'vestes', 'chaussures'],
  bas: ['hauts', 'vestes', 'chaussures'],
  robes: ['vestes', 'chaussures', 'sacs', 'bijoux'],
  chaussures: ['bas', 'robes'],
  sacs: ['robes', 'hauts', 'bas', 'vestes'],
  bijoux: ['robes', 'hauts', 'vestes'],
  accessoires: ['hauts', 'bas', 'vestes', 'robes'],
};

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function wornLine(stat: WearStat | undefined): string {
  const n = stat?.wears ?? 0;
  if (!n || !stat?.last) return 'Jamais portée pour l’instant';
  const [y, m, d] = stat.last.split('-').map(Number);
  const today = new Date();
  const when = y === today.getFullYear() && m === today.getMonth() + 1 && d === today.getDate() ? 'aujourd’hui' : `le ${d} ${MOIS[m - 1]}`;
  return `Portée ${n} fois · dernière fois ${when}`;
}

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function markSeen(ids: string[]) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...readSeen(), ...ids])].slice(-200)));
  } catch {
    // Stockage indisponible : la pièce retombera peut-être une fois de plus, sans gêne.
  }
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Les portants du dressing. Deux mouvements :
 * - le cintre qui se balance : une pièce qui vient d'arriver tombe sur son
 *   portant et se balance un instant (une fois par visite) ;
 * - la vignette qui s'ouvre : la vignette touchée grandit jusqu'à devenir
 *   la fiche de la pièce, et s'y replie à la fermeture. L'œil ne perd
 *   jamais la pièce.
 */
export function DressingRails({ rails, stats }: { rails: RailView[]; stats: Record<string, WearStat> }) {
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Piece | null>(null);
  const origin = useRef<HTMLElement | null>(null);

  // Les nouvelles pièces pas encore vues pendant cette visite.
  useEffect(() => {
    const seen = readSeen();
    const now = Date.now();
    const ids = rails.flatMap((r) => r.pieces).filter((p) => now - Date.parse(p.created_at) < FRESH_MS && !seen.has(p.id)).map((p) => p.id);
    if (!ids.length) return;
    setFresh(new Set(ids));
    markSeen(ids);
    // Une vibration légère au moment où la pièce touche la tringle (téléphones qui le permettent).
    // Le navigateur ne vibre qu'après un premier geste sur la page : on ne le lui demande pas avant.
    if (!reducedMotion() && navigator.userActivation?.hasBeenActive) setTimeout(() => navigator.vibrate?.(12), 450);
  }, [rails]);

  const all = rails.flatMap((r) => r.pieces);
  const goes = (p: Piece) => all.filter((q) => q.id !== p.id && (GOES[p.category_id] ?? []).includes(q.category_id)).length;

  return (
    <>
      {rails.map((rail, r) => (
        <section key={rail.id} className="rise" style={{ '--i': 2 + r, display: 'flex', flexDirection: 'column', gap: 10 } as CSSProperties}>
          <h2 className="eyebrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon d={rail.icon} size={14} width={1.8} />
            {rail.label}
            <span style={{ opacity: 0.6 }}>{rail.pieces.length}</span>
          </h2>
          <div className="scroll-x rail" style={{ paddingBlock: 4 }}>
            {rail.pieces.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`piece piece-button ${fresh.has(p.id) ? 'hang-in' : 'pop'}`}
                style={{ '--i': i, flex: 'none', width: 108 } as CSSProperties}
                aria-label={`${p.name}, ouvrir sa fiche`}
                aria-haspopup="dialog"
                onClick={(e) => {
                  origin.current = e.currentTarget.querySelector('.piece-frame');
                  setOpen(p);
                }}
              >
                <div className="piece-frame" style={{ aspectRatio: 'auto', height: 124, padding: 10 }}>
                  <PieceArt piece={p} size={46} />
                </div>
                <span className="piece-name">{p.name}</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {open ? (
        <PieceSheet
          piece={open}
          stat={stats[open.id]}
          goes={goes(open)}
          origin={origin}
          onClosed={() => {
            const back = origin.current?.closest('button');
            setOpen(null);
            back?.focus();
          }}
        />
      ) : null}
    </>
  );
}

/** La fiche d'une pièce, qui naît de sa vignette (FLIP : on part du cadre de la vignette et on la laisse grandir). */
function PieceSheet({
  piece,
  stat,
  goes,
  origin,
  onClosed,
}: {
  piece: Piece;
  stat: WearStat | undefined;
  goes: number;
  origin: RefObject<HTMLElement | null>;
  onClosed: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);

  /** Le chemin inverse : la fiche se replie sur sa vignette. */
  const delta = useCallback(() => {
    const from = origin.current?.getBoundingClientRect();
    const to = card.current?.getBoundingClientRect();
    if (!from || !to || !to.width || !to.height) return null;
    return {
      x: from.left + from.width / 2 - (to.left + to.width / 2),
      y: from.top + from.height / 2 - (to.top + to.height / 2),
      sx: from.width / to.width,
      sy: from.height / to.height,
    };
  }, [origin]);

  useLayoutEffect(() => {
    closeBtn.current?.focus({ preventScroll: true });
    if (reducedMotion()) return;
    const d = delta();
    if (d && card.current) {
      card.current.animate(
        [
          { transform: `translate(${d.x}px, ${d.y}px) scale(${d.sx}, ${d.sy})`, borderRadius: 0, opacity: 0.4 },
          { transform: 'none', borderRadius: 0, opacity: 1 },
        ],
        { duration: 520, easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)' },
      );
    }
    scrim.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
  }, [delta]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const d = delta();
    if (reducedMotion() || !d || !card.current) return onClosed();
    scrim.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-in', fill: 'forwards' });
    const a = card.current.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: `translate(${d.x}px, ${d.y}px) scale(${d.sx}, ${d.sy})`, opacity: 0 },
      ],
      { duration: 300, easing: 'cubic-bezier(0.4, 0, 0.8, 0.6)', fill: 'forwards' },
    );
    a.onfinish = onClosed;
  }, [delta, onClosed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close();
      // Le focus reste dans la fiche tant qu'elle est ouverte.
      if (e.key !== 'Tab' || !card.current) return;
      const items = [...card.current.querySelectorAll<HTMLElement>('a[href], button')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  // Le type n'apparaît que s'il dit autre chose que le nom (« Trench » pour un trench, non).
  const kind = pieceKindLabel(piece);
  const eyebrow = kind && kind.toLowerCase() !== piece.name.toLowerCase() ? kind : null;

  return (
    <div className="sheet-layer">
      <div ref={scrim} className="sheet-scrim" onClick={close} aria-hidden="true" />
      <div ref={card} className="glass piece-sheet" role="dialog" aria-modal="true" aria-labelledby="fiche-titre">
        <div className="piece-sheet-stage">
          <PieceArt piece={piece} size={120} />
        </div>
        <div className="piece-sheet-facts">
          {eyebrow ? <p className="eyebrow" style={{ textAlign: 'left' }}>{eyebrow}</p> : null}
          <h2 id="fiche-titre" style={{ fontSize: 24 }}>{piece.name}</h2>
          <p className="small muted">{wornLine(stat)}</p>
          {goes > 0 ? (
            <p className="small muted">
              Va avec {goes} pièce{goes > 1 ? 's' : ''} de ton dressing
            </p>
          ) : null}
        </div>
        <div className="piece-sheet-facts" style={{ display: 'grid', gap: 10 }}>
          <Link href={`/tenues/nouvelle?avec=${piece.id}`} className="btn btn-primary btn-block">
            <Icon d={ICON.sparkle} size={18} /> Composer une tenue avec
          </Link>
          <button ref={closeBtn} type="button" className="btn btn-glass btn-block" onClick={close}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
