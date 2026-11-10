'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { skipOutfit, wearPieces } from '@/app/actions';
import { Icon } from '@/components/icons';
import { Garment, SHAPE_BY_CATEGORY } from '@/components/garments';
import { Sheet } from '@/components/Sheet';
import { WornLine } from '@/components/WearButton';
import { cleTenue, headToToe, rowOf, ROW_NAME, ROW_ORDER, type HomePiece, type Outfit, type RowId } from '@/lib/outfits';

/**
 * La tenue du jour en rangées, de la tête aux pieds (modèle « Dress me » des
 * applis de garde-robe, comme sur l'app mobile) : une rangée par niveau, la
 * pièce au centre et ses deux voisines coupées par le bord. Toucher une
 * voisine la prend ; le cadenas garde la pièce quand on demande une autre
 * tenue ; « Je la porte » note un port par pièce ; « Pas pour moi » dit
 * pourquoi à Kodi, et une autre tenue arrive tout de suite.
 */

/** Hauteur de chaque rangée, et largeur du dessin (px). */
const ROW_H: Record<RowId, number> = { tete: 62, veste: 126, haut: 126, bas: 148, pieds: 86, main: 82 };
const ROW_ART: Record<RowId, number> = { tete: 88, veste: 100, haut: 100, bas: 116, pieds: 116, main: 100 };

/** Rotation : d'abord ce qui dort le plus longtemps. */
const rest = (a: HomePiece, b: HomePiece) => (b.lastWorn ?? 999) - (a.lastWorn ?? 999);

const RAISONS = [
  { id: 'style', label: 'Pas mon style' },
  { id: 'couleurs', label: 'Les couleurs' },
  { id: 'confort', label: 'Pas à l’aise dedans' },
  { id: 'meteo', label: 'Pas pour la météo' },
  { id: 'journee', label: 'Pas pour ma journée' },
  { id: 'piece', label: 'Une pièce en particulier' },
] as const;
type Raison = (typeof RAISONS)[number]['id'];

/** Ce qu'il faut glisser pour changer de pièce, et jusqu'où la rangée suit le doigt (comme sur l'app). */
const SWIPE = 36;
const FOLLOW = 44;
/** L'indice du geste ne se dit qu'une fois : cette clé retient qu'il a servi. */
const HINT_KEY = 'dk_indice_rangees';
type Edge = 'l' | 'r';

/** Une pièce : sa vignette détourée, ou la silhouette de sa catégorie teintée de sa couleur. */
export function PieceImage({ p, size }: { p: Pick<HomePiece, 'url' | 'category_id' | 'colour'>; size: number }) {
  if (p.url) return <img src={p.url} alt="" draggable={false} loading="lazy" decoding="async" />;
  return (
    <Garment shape={SHAPE_BY_CATEGORY[p.category_id] ?? 'tshirt'} size={size} fill={p.colour ?? 'var(--tile-2)'} stroke="var(--stage-line)" />
  );
}

export function HomeToday({ pieces, outfits, worn, streak = 0 }: { pieces: HomePiece[]; outfits: Outfit[]; worn: boolean; streak?: number }) {
  const [pending, start] = useTransition();
  // « Pas pour moi » a sa propre attente (07/11) : partagée, elle affichait « C’est noté » sur « Je la porte » pendant un écart.
  const [skipping, startSkip] = useTransition();
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [swapped, setSwapped] = useState<Partial<Record<RowId, string>>>({});
  const [pinned, setPinned] = useState<Set<RowId>>(new Set());
  /** La tenue qu'on vient de porter : la carte la garde telle quelle, même quand le serveur recompose les propositions. */
  const [frozen, setFrozen] = useState<{ outfit: Outfit; shown: HomePiece[] } | null>(null);
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Le côté d'où vient la dernière pièce prise dans chaque rangée : elle entre par là. */
  const [from, setFrom] = useState<Partial<Record<RowId, Edge>>>({});
  /** Les tours de la flèche d'« Une autre » : le geste se voit avant que la tenue change. */
  const [turns, setTurns] = useState(0);
  // L'indice du geste (10/11) : montré tant qu'aucune pièce n'a été changée, plus jamais ensuite.
  const [hint, setHint] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(HINT_KEY)) setHint(true);
    } catch {
      /* stockage fermé : pas d'indice, rien de cassé */
    }
  }, []);
  /** Le glissé en cours, et l'instant du dernier : un glissé ne doit pas compter comme un toucher. */
  const drag = useRef<{ id: number; x: number; y: number; on: boolean; el: HTMLElement } | null>(null);
  const swipedAt = useRef(0);

  // Les tenues proposées ont changé (une écartée, la météo qui change) : la carte repart de zéro.
  const sig = outfits.map((o) => cleTenue(o.pieces)).join('|');
  const [lastSig, setLastSig] = useState(sig);
  if (sig !== lastSig) {
    setLastSig(sig);
    if (!frozen) {
      setIndex(0);
      setHidden(new Set());
      setSwapped({});
      setPinned(new Set());
    }
  }

  const byId = useMemo(() => new Map(pieces.map((p) => [p.id, p])), [pieces]);
  const visible = outfits.filter((o) => !hidden.has(o.id));
  // Déjà portée aujourd'hui (le serveur le sait) : c'est elle, la première, qu'on montre.
  const outfit = frozen ? frozen.outfit : worn ? (outfits[0] ?? null) : visible.length ? visible[index % visible.length] : null;
  const done = worn || !!frozen;

  // La tenue telle qu'on l'a ajustée : une pièce prise à une voisine remplace celle de sa rangée.
  const shownLive = useMemo(() => {
    if (!outfit) return [] as HomePiece[];
    const base = outfit.pieces.map((id) => byId.get(id)).filter((p): p is HomePiece => !!p);
    const out = base.map((p) => {
      const id = swapped[rowOf(p)];
      return id && byId.get(id) ? byId.get(id)! : p;
    });
    // Une pièce gardée d'une tenue à l'autre s'ajoute si la nouvelle n'a pas cette rangée.
    for (const [r, id] of Object.entries(swapped)) if (id && !out.some((p) => rowOf(p) === r) && byId.get(id)) out.push(byId.get(id)!);
    const list = out.filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i);

    // Une robe garde la place du haut et du bas ; un bas gardé a besoin d'un haut.
    const dress = list.some((p) => p.category_id === 'robes');
    const kept = (r: RowId) => swapped[r] !== undefined && pinned.has(r);
    if (dress) return headToToe(list.filter((p) => rowOf(p) !== 'haut' || kept('haut')));
    if (list.some((p) => rowOf(p) === 'bas') && !list.some((p) => rowOf(p) === 'haut')) {
      const top = pieces.filter((p) => p.category_id === 'hauts').sort(rest)[0];
      if (top) list.push(top);
    }
    return headToToe(list);
  }, [outfit, swapped, pinned, byId, pieces]);
  const shown = frozen ? frozen.shown : shownLive;

  if (!outfit) {
    return (
      <section className="glass card card-center rise" style={{ '--i': 1 } as CSSProperties} aria-labelledby="home-today-title">
        <h2 id="home-today-title" style={{ fontSize: 20 }}>Plus de tenue à te proposer</h2>
        <p className="small muted">Tu les as toutes écartées pour aujourd’hui. Compose la tienne, ou demande à Kodi.</p>
        <Link href="/tenues/nouvelle" className="btn btn-primary btn-block"><Icon name="sparkle" size={18} /> Composer ma tenue</Link>
        <Link href="/kodi" className="btn btn-glass btn-block">Demander à Kodi</Link>
      </section>
    );
  }

  const inOutfit = new Set(shown.map((p) => p.id));
  const rows = ROW_ORDER.map((r) => ({ r, items: shown.filter((p) => rowOf(p) === r) })).filter((x) => x.items.length);
  const unchanged = outfit.saved && shown.length === outfit.pieces.length && shown.every((p) => outfit.pieces.includes(p.id));
  const ports = shown.reduce((n, p) => n + p.wears, 0) + (frozen ? shown.length : 0);
  const colours = shown.map((p) => p.colour).filter((c): c is string => !!c);

  /** Prendre une voisine : elle remplace la pièce de sa rangée, et l'indice a fait son travail. */
  function take(r: RowId, p: HomePiece | undefined, edge: Edge) {
    if (!p) return;
    setFrom((f) => ({ ...f, [r]: edge }));
    setSwapped((s) => ({ ...s, [r]: p.id }));
    if (hint) {
      setHint(false);
      try {
        localStorage.setItem(HINT_KEY, '1');
      } catch {
        /* rien */
      }
    }
  }

  /**
   * Glisser une rangée (10/11, comme sur l'app) : elle suit le doigt, et au
   * lâcher la voisine du côté opposé prend la place. Le geste ne compte que
   * s'il est franchement horizontal : la page défile comme avant
   * (`touch-action: pan-y`).
   */
  function swipeHandlers(r: RowId, alts: HomePiece[]) {
    if (!alts.length) return {};
    const end = (e: ReactPointerEvent<HTMLDivElement>, done: boolean) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      drag.current = null;
      d.el.removeAttribute('data-drag');
      d.el.style.removeProperty('--dx');
      if (!done || !d.on) return;
      const dx = e.clientX - d.x;
      if (Math.abs(dx) < SWIPE) return;
      swipedAt.current = Date.now();
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(8);
      // Glisser vers la gauche amène la voisine de droite, et inversement.
      if (dx < 0) take(r, alts[1] ?? alts[0], 'r');
      else take(r, alts[0], 'l');
    };
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false, el: e.currentTarget };
      },
      onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.x;
        if (!d.on) {
          if (Math.abs(dx) < 14 || Math.abs(dx) < Math.abs(e.clientY - d.y)) return;
          d.on = true;
          d.el.setAttribute('data-drag', '');
        }
        d.el.style.setProperty('--dx', `${Math.max(-FOLLOW, Math.min(FOLLOW, dx * 0.5))}px`);
      },
      onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => end(e, true),
      onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => end(e, false),
      onPointerLeave: (e: ReactPointerEvent<HTMLDivElement>) => end(e, e.pointerType === 'mouse'),
    };
  }
  /** Le toucher d'une voisine, sauf s'il termine un glissé. */
  const tap = (r: RowId, p: HomePiece, edge: Edge) => () => {
    if (Date.now() - swipedAt.current > 350) take(r, p, edge);
  };

  /** Une autre tenue : les rangées verrouillées gardent leur pièce, le reste change. */
  function another() {
    setTurns((t) => t + 1);
    setFrom({});
    const keep: Partial<Record<RowId, string>> = {};
    for (const r of pinned) {
      const p = shown.find((x) => rowOf(x) === r);
      if (p) keep[r] = p.id;
    }
    setSwapped(keep);
    setIndex((i) => i + 1);
  }

  /**
   * « Je la porte » : un port par pièce, et la tenue (ajustée ou non) reste
   * sur la journée, pour que l'accueil et le calendrier la montrent portée.
   * L'action serveur rafraîchit la page ; la carte garde sa tenue et joue sa coche.
   */
  function wear() {
    start(async () => {
      setError(null);
      const res = await wearPieces({ garmentIds: shown.map((p) => p.id), outfitId: unchanged ? outfit!.saved : null, title: outfit!.title });
      if ('error' in res) return setError(res.error);
      setFrozen({ outfit: outfit!, shown });
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(14);
    });
  }

  function skip(reason: Raison | 'sans', targets: string[]) {
    startSkip(async () => {
      setError(null);
      const res = await skipOutfit({ garmentIds: shown.map((p) => p.id), reason, targetIds: targets });
      if ('error' in res) return setError(res.error);
      // La tenue écartée disparaît tout de suite ; le serveur recompose les propositions sans elle.
      setHidden((h) => new Set(h).add(outfit!.id));
      setSwapped({});
      setPinned(new Set());
      setSheet(false);
    });
  }

  return (
    <section className="glass card home-today rise" style={{ '--i': 1 } as CSSProperties} aria-labelledby="home-today-title">
      {/* Le matin, un geste : « Je la porte » et « Une autre » en tête de carte, visibles sans défiler. */}
      <div className="home-today__head">
        <h2 id="home-today-title" className="home-tag">{done ? 'Portée aujourd’hui' : 'Tenue du jour'}</h2>
        {!done ? (
          <>
            {visible.length > 1 ? (
              <button type="button" className="icon-btn" onClick={another} aria-label="Une autre tenue">
                <span className="turn" style={{ transform: `rotate(${turns * 360}deg)` }}><Icon name="refresh" size={18} /></span>
              </button>
            ) : null}
            <button type="button" className="btn btn-primary btn-sm" onClick={wear} disabled={pending}>
              {pending ? <><span className="spinner" aria-hidden="true" />C’est noté</> : 'Je la porte'}
            </button>
          </>
        ) : null}
      </div>

      {/* La récompense juste sous le geste (10/11) : plus bas, il fallait défiler pour la voir. */}
      {done ? <WornLine total={ports} just={!!frozen} colours={colours} streak={streak + 1} /> : null}

      <div className="dress-stage" key={outfit.id}>
        {rows.map(({ r, items }, i) => {
          const alts = done ? [] : pieces.filter((p) => rowOf(p) === r && !inOutfit.has(p.id)).sort(rest);
          const keep = pinned.has(r);
          const art = Math.round(ROW_ART[r] * (items.length > 1 ? 0.78 : 1));
          const side = Math.round(ROW_ART[r] * 0.86);
          return (
            <div
              key={r}
              role="group"
              aria-label={ROW_NAME[r]}
              className="dress-row"
              style={{ '--h': `${ROW_H[r]}px`, '--art': `${art}px`, '--side': `${side}px`, '--i': i } as CSSProperties}
              {...swipeHandlers(r, alts)}
            >
              {alts[0] ? (
                <button type="button" className="dress-near dress-near--l" onClick={tap(r, alts[0], 'l')} aria-label={`${ROW_NAME[r]} : prendre ${alts[0].name}`}>
                  <PieceImage p={alts[0]} size={side} />
                </button>
              ) : null}
              {alts[1] ? (
                <button type="button" className="dress-near dress-near--r" onClick={tap(r, alts[1], 'r')} aria-label={`${ROW_NAME[r]} : prendre ${alts[1].name}`}>
                  <PieceImage p={alts[1]} size={side} />
                </button>
              ) : null}
              <div className="dress-main">
                {items.map((p) => (
                  <span key={p.id} className="dress-art" data-from={from[r]} role="img" aria-label={p.name}>
                    <PieceImage p={p} size={art} />
                  </span>
                ))}
                {alts.length > 0 ? (
                  <button
                    type="button"
                    className="dress-lock"
                    aria-pressed={keep}
                    aria-label={keep ? `${ROW_NAME[r]} : ne plus garder` : `${ROW_NAME[r]} : garder pour la prochaine tenue`}
                    onClick={() => setPinned((prev) => { const n = new Set(prev); if (n.has(r)) n.delete(r); else n.add(r); return n; })}
                  >
                    <span className="dress-lock__dot" data-on={keep}><Icon name="lock" size={13} /></span>
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {hint && !done && rows.some(({ r }) => pieces.some((p) => rowOf(p) === r && !inOutfit.has(p.id))) ? (
        <p className="dress-hint" data-testid="rows-hint"><span aria-hidden="true">←</span> Glisse une rangée pour changer une pièce <span aria-hidden="true">→</span></p>
      ) : null}

      {/* La tenue s'assemble, puis son titre s'écrit. */}
      <div className="home-today__words">
        <h3>{outfit.title}</h3>
        {outfit.why ? <p>{outfit.why}</p> : null}
      </div>

      {error ? <p role="alert" style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</p> : null}

      {!done ? (
        <div className="home-today__foot">
          <button type="button" className="home-label-btn" onClick={() => setSheet(true)} aria-haspopup="dialog">Pas pour moi</button>
          <span className="small muted">{visible.length > 1 ? `${(index % visible.length) + 1} sur ${visible.length}` : ''}</span>
        </div>
      ) : null}

      {sheet ? <NotForMe pieces={shown} busy={skipping} onClose={() => setSheet(false)} onConfirm={skip} /> : null}
    </section>
  );
}

/**
 * « Pas pour moi » : la feuille qui s'ouvre sous une tenue qu'on ne veut pas.
 * Une raison en un geste (facultative), la pièce visée si c'est elle, et une
 * autre tenue tout de suite. La raison part chez Kodi.
 */
function NotForMe({ pieces, busy, onClose, onConfirm }: { pieces: HomePiece[]; busy: boolean; onClose: () => void; onConfirm: (r: Raison | 'sans', targets: string[]) => void }) {
  const [raison, setRaison] = useState<Raison | null>(null);
  const [cibles, setCibles] = useState<string[]>([]);
  const waiting = raison === 'piece' && cibles.length === 0;

  return (
    <Sheet kicker="Dis-le à Kodi" title="Pas pour moi" onClose={onClose}>
      <p className="small muted" style={{ fontSize: 14 }}>
        Pourquoi ? Kodi s’en souviendra pour tes prochaines tenues. Tu peux aussi passer sans rien dire.
      </p>
      <div role="radiogroup" aria-label="La raison" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {RAISONS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={raison === r.id}
            className="chip"
            onClick={() => setRaison(raison === r.id ? null : r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
      {raison === 'piece' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p className="eyebrow">Laquelle ?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pieces.map((p) => {
              const on = cibles.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="notforme-piece"
                  aria-pressed={on}
                  aria-label={p.name}
                  onClick={() => setCibles(on ? cibles.filter((x) => x !== p.id) : [...cibles, p.id])}
                >
                  <span className="notforme-piece__art">
                    <PieceImage p={p} size={52} />
                    {on ? <span className="notforme-piece__check"><Icon name="check" size={12} /></span> : null}
                  </span>
                  <span className="notforme-piece__name">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={waiting || busy}
        onClick={() => onConfirm(raison ?? 'sans', raison === 'piece' ? cibles : [])}
      >
        {busy ? <><span className="spinner" aria-hidden="true" />Une seconde</> : <><Icon name="refresh" size={18} /> {waiting ? 'Choisis la pièce' : 'Une autre tenue'}</>}
      </button>
    </Sheet>
  );
}
