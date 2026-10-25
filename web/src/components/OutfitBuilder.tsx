'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import Link from 'next/link';
import { createOutfit } from '@/app/actions';
import type { Piece } from '@/lib/garments';
import { PieceArt, pieceKindLabel } from '@/components/PieceArt';
import { Segment } from '@/components/Segment';
import { Icon, ICON } from '@/components/ui';

/**
 * L’atelier de tenue, sur le modèle des applis de garde-robe les plus
 * simples à l’usage : une rangée qui défile par emplacement, la pièce
 * au centre est celle qu’on porte. On verrouille ce qu’on garde, on
 * mélange le reste, on ajoute sac, accessoires et bijoux d’un toucher.
 */

type RowKey = 'veste' | 'haut' | 'bas' | 'robe' | 'chaussures';
const ROW_CATEGORY: Record<RowKey, string> = {
  veste: 'vestes', haut: 'hauts', bas: 'bas', robe: 'robes', chaussures: 'chaussures',
};
const ROW_LABEL: Record<RowKey, string> = {
  veste: 'Veste', haut: 'Haut', bas: 'Bas', robe: 'Robe', chaussures: 'Chaussures',
};
type ExtraKey = 'sacs' | 'accessoires' | 'bijoux';
const EXTRAS: { key: ExtraKey; label: string; single?: boolean }[] = [
  { key: 'bijoux', label: 'Bijoux' },
  { key: 'accessoires', label: 'Accessoires' },
  { key: 'sacs', label: 'Sac', single: true },
];

const ITEM = 124;
const GAP = 12;

/* ---------------------------------------------------------------- rangée */

function Row({
  label,
  pieces,
  index,
  onIndex,
  locked,
  onLock,
}: {
  label: string;
  pieces: Piece[];
  /** 0 = « aucune », 1…n = pièces */
  index: number;
  onIndex: (i: number) => void;
  locked: boolean;
  onLock: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reported = useRef(index);
  const frame = useRef(0);

  // Effet « cover-flow » : chaque carte rétrécit et pâlit avec sa distance au centre.
  const paint = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let nearest = 0;
    let best = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const d = (c.offsetLeft + ITEM / 2 - center) / (ITEM + GAP);
      const t = Math.min(1, Math.abs(d));
      c.style.transform = `scale(${1 - 0.18 * t}) translateY(${t * 8}px)`;
      c.style.opacity = String(1 - 0.55 * t);
      if (Math.abs(d) < best) { best = Math.abs(d); nearest = i; }
    });
    if (nearest !== reported.current) {
      reported.current = nearest;
      onIndex(nearest);
      if ('vibrate' in navigator) navigator.vibrate?.(6);
    }
  }, [onIndex]);

  const scrollTo = useCallback((i: number, smooth: boolean) => {
    const el = ref.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({ left: child.offsetLeft - (el.clientWidth - ITEM) / 2, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Premier rendu : on se place sans animation.
  useEffect(() => {
    scrollTo(index, false);
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changement venu d’ailleurs (le bouton Mélanger) : on glisse jusqu’à la pièce.
  useEffect(() => {
    if (index !== reported.current) {
      reported.current = index;
      scrollTo(index, true);
    }
  }, [index, scrollTo]);

  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
  };

  const current = index > 0 ? pieces[index - 1] : null;

  return (
    <section className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 4 }}>
        <p style={{ fontSize: 13, fontWeight: 500 }}>
          {label}
          <span className="muted" style={{ fontWeight: 400 }}> · {current ? current.name : 'aucun'}</span>
        </p>
        <button
          type="button"
          onClick={onLock}
          aria-pressed={locked}
          aria-label={locked ? `Déverrouiller ${label.toLowerCase()}` : `Garder ${label.toLowerCase()} au mélange`}
          className="chip"
          style={{ minHeight: 44, width: 44, padding: 0, justifyContent: 'center' }}
        >
          <Icon d={locked ? ICON.lock : ICON.unlock} size={15} width={1.9} />
        </button>
      </header>
      <div
        ref={ref}
        onScroll={onScroll}
        role="listbox"
        aria-label={label}
        style={{
          display: 'flex', gap: GAP, overflowX: 'auto', scrollSnapType: 'x mandatory',
          paddingInline: `calc(50% - ${ITEM / 2}px)`, paddingBlock: 4, marginInline: -20,
          scrollbarWidth: 'none',
        }}
        data-scroll
      >
        {[null, ...pieces].map((p, i) => (
          <button
            key={p?.id ?? 'aucun'}
            type="button"
            role="option"
            aria-selected={i === index}
            onClick={() => scrollTo(i, true)}
            style={{
              flex: 'none', width: ITEM, height: ITEM * 1.12, scrollSnapAlign: 'center',
              borderRadius: 26, border: '1px solid var(--glass-edge)', padding: 12,
              background: i === index ? 'var(--glass-strong)' : 'var(--glass)',
              boxShadow: i === index ? 'var(--shadow-float)' : 'none',
              backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
              display: 'grid', placeItems: 'center', cursor: 'pointer',
              transition: 'background-color 300ms, box-shadow 300ms',
              willChange: 'transform',
            }}
          >
            {p ? (
              <span style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }} className="piece-frame-img">
                <PieceArt piece={p} size={62} />
              </span>
            ) : (
              <span className="muted" style={{ fontSize: 12.5, display: 'grid', justifyItems: 'center', gap: 6 }}>
                <Icon d={ICON.close} size={20} width={1.4} />
                Sans
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- atelier */

const pick = (n: number) => Math.floor(Math.random() * n);

/**
 * `start` : la pièce d’où l’on part (« Composer avec », depuis sa fiche) ;
 * elle est posée et verrouillée dans sa rangée, ou ajoutée aux extras.
 */
export function OutfitBuilder({ pieces, start: startId }: { pieces: Piece[]; start?: string }) {
  const byCat = useMemo(() => {
    const m = new Map<string, Piece[]>();
    for (const p of pieces) m.set(p.category_id, [...(m.get(p.category_id) ?? []), p]);
    return m;
  }, [pieces]);
  const list = (cat: string) => byCat.get(cat) ?? [];

  const hasSeparates = list('hauts').length > 0 || list('bas').length > 0;
  const hasDresses = list('robes').length > 0;
  const first = pieces.find((p) => p.id === startId) ?? null;
  const firstRow = first ? ((Object.keys(ROW_CATEGORY) as RowKey[]).find((r) => ROW_CATEGORY[r] === first.category_id) ?? null) : null;
  const [mode, setMode] = useState<'separes' | 'robe'>(
    firstRow === 'robe' ? 'robe' : firstRow === 'haut' || firstRow === 'bas' ? 'separes' : hasSeparates || !hasDresses ? 'separes' : 'robe',
  );

  const rows: RowKey[] = mode === 'robe' ? ['veste', 'robe', 'chaussures'] : ['veste', 'haut', 'bas', 'chaussures'];
  const visibleRows = rows.filter((r) => list(ROW_CATEGORY[r]).length > 0);

  // Au départ : une pièce par rangée, la veste en option.
  const [index, setIndex] = useState<Record<RowKey, number>>(() => ({
    veste: 0,
    haut: list('hauts').length ? 1 : 0,
    bas: list('bas').length ? 1 : 0,
    robe: list('robes').length ? 1 : 0,
    chaussures: list('chaussures').length ? 1 : 0,
    ...(first && firstRow ? { [firstRow]: list(first.category_id).indexOf(first) + 1 } : {}),
  }));
  const [locked, setLocked] = useState<Record<RowKey, boolean>>(() => ({
    veste: false, haut: false, bas: false, robe: false, chaussures: false,
    ...(firstRow ? { [firstRow]: true } : {}),
  }));
  const [extras, setExtras] = useState<Set<string>>(() => new Set(first && !firstRow ? [first.id] : []));
  const [extraTab, setExtraTab] = useState<ExtraKey>(
    first && !firstRow && EXTRAS.some((e) => e.key === first.category_id)
      ? (first.category_id as ExtraKey)
      : (EXTRAS.find((e) => list(e.key).length)?.key ?? 'bijoux'),
  );
  const [spin, setSpin] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const setRow = useCallback((r: RowKey) => (i: number) => setIndex((prev) => (prev[r] === i ? prev : { ...prev, [r]: i })), []);
  const setters = useMemo(() => ({
    veste: setRow('veste'), haut: setRow('haut'), bas: setRow('bas'), robe: setRow('robe'), chaussures: setRow('chaussures'),
  }), [setRow]);

  const shuffle = () => {
    setSpin((s) => s + 1);
    setIndex((prev) => {
      const next = { ...prev };
      for (const r of visibleRows) {
        if (locked[r]) continue;
        const n = list(ROW_CATEGORY[r]).length;
        if (r === 'veste') { next[r] = Math.random() < 0.45 ? 0 : 1 + pick(n); continue; }
        if (n > 1) {
          let i = 1 + pick(n);
          if (i === prev[r]) i = 1 + ((i) % n);
          next[r] = i;
        } else next[r] = 1;
      }
      return next;
    });
  };

  const toggleExtra = (key: ExtraKey, id: string) => {
    const single = EXTRAS.find((e) => e.key === key)?.single;
    setExtras((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (single) for (const p of list(key)) next.delete(p.id);
        next.add(id);
      }
      return next;
    });
  };

  const chosen: Piece[] = [
    ...visibleRows.map((r) => (index[r] > 0 ? list(ROW_CATEGORY[r])[index[r] - 1] : null)).filter(Boolean) as Piece[],
    ...pieces.filter((p) => extras.has(p.id)),
  ];

  const save = () => {
    setError(null);
    start(async () => {
      const res = await createOutfit({ garmentIds: chosen.map((p) => p.id) });
      if ('error' in res) setError(res.error);
      else setSaved(res.id);
    });
  };

  if (pieces.length < 2) {
    return (
      <section className="glass card card-center rise" style={{ '--i': 1 } as CSSProperties}>
        <h2 style={{ fontSize: 22 }}>Encore <em className="accent">une pièce</em></h2>
        <p className="lead small">
          Il faut au moins deux pièces dans ton dressing pour composer une tenue : un haut et un bas,
          une robe et des chaussures, ou ce qui te ressemble.
        </p>
        <Link href="/dressing/ajouter" className="btn btn-primary btn-block">Ajouter une pièce</Link>
      </section>
    );
  }

  return (
    <>
      {hasSeparates && hasDresses ? (
        <div className="rise" style={{ '--i': 1 } as CSSProperties}>
          <Segment
            label="Type de tenue"
            value={mode}
            onChange={(v) => setMode(v as 'separes' | 'robe')}
            options={[{ value: 'separes', label: 'Haut et bas' }, { value: 'robe', label: 'Robe' }]}
          />
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {visibleRows.map((r) => (
          <Row
            key={`${mode}-${r}`}
            label={ROW_LABEL[r]}
            pieces={list(ROW_CATEGORY[r])}
            index={index[r]}
            onIndex={setters[r]}
            locked={locked[r]}
            onLock={() => setLocked((l) => ({ ...l, [r]: !l[r] }))}
          />
        ))}
      </div>

      {EXTRAS.some((e) => list(e.key).length) ? (
        <section className="glass card rise" style={{ '--i': 5, gap: 12 } as CSSProperties}>
          <h2 className="section-title">
            La touche <em className="accent" style={{ fontSize: 20 }}>finale</em>
            <small>{extras.size ? `${extras.size} choisi${extras.size > 1 ? 's' : ''}` : 'facultatif'}</small>
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {EXTRAS.filter((e) => list(e.key).length).map((e) => (
              <button key={e.key} type="button" className="chip" aria-pressed={extraTab === e.key} onClick={() => setExtraTab(e.key)}>
                {e.label}
              </button>
            ))}
          </div>
          <div className="scroll-x" style={{ marginInline: -22, paddingInline: 22, paddingBlock: 4 }}>
            {list(extraTab).map((p, i) => {
              const on = extras.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="pop"
                  onClick={() => toggleExtra(extraTab, p.id)}
                  aria-pressed={on}
                  aria-label={`${p.name}, ${pieceKindLabel(p)}`}
                  style={{
                    '--i': i, flex: 'none', width: 86, display: 'grid', gap: 6, justifyItems: 'center',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  } as CSSProperties}
                >
                  <span
                    className="piece-frame"
                    style={{
                      width: 86, aspectRatio: '1', padding: 10, borderRadius: 22,
                      outline: on ? '2px solid var(--ink)' : '2px solid transparent', outlineOffset: 2,
                      transform: on ? 'scale(1.04)' : 'none',
                    }}
                  >
                    <PieceArt piece={p} size={44} />
                    {on ? (
                      <span style={{
                        position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 99,
                        background: 'var(--ink)', color: 'var(--on-ink)', display: 'grid', placeItems: 'center',
                      }} className="pop">
                        <Icon d={ICON.check} size={13} width={2.6} />
                      </span>
                    ) : null}
                  </span>
                  <span style={{ fontSize: 11.5, lineHeight: 1.25, textAlign: 'center' }}>{p.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {error ? <p role="alert" className="note note-error pop">{error}</p> : null}

      {/* barre d’action flottante */}
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
          zIndex: 20, display: 'flex', justifyContent: 'center', paddingInline: 16, pointerEvents: 'none',
        }}
      >
        <div
          className="glass"
          style={{
            pointerEvents: 'auto', width: '100%', maxWidth: 398, borderRadius: 999, padding: 7,
            display: 'flex', gap: 8, background: 'var(--nav-glass)', boxShadow: 'var(--shadow-float)',
          }}
        >
          <Link href="/tenues" className="btn btn-glass btn-icon" aria-label="Retour aux tenues">
            <Icon d={ICON.back} size={20} width={2} />
          </Link>
          <button type="button" onClick={shuffle} className="btn btn-glass btn-icon" aria-label="Mélanger les pièces non verrouillées">
            <span style={{ display: 'grid', transform: `rotate(${spin * 360}deg)`, transition: 'transform 700ms cubic-bezier(.34,1.56,.64,1)' }}>
              <Icon d={ICON.shuffle} size={20} width={1.8} />
            </span>
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || chosen.length < 2}
            className="btn btn-primary"
            style={{ flex: 1, minHeight: 48 }}
          >
            {pending ? <><span className="spinner" aria-hidden="true" />Kodi range ta tenue</> : `Enregistrer · ${chosen.length} pièce${chosen.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {saved ? <Saved onAgain={() => setSaved(null)} /> : null}
    </>
  );
}

/* ---------------------------------------------------------------- confirmation */

function Saved({ onAgain }: { onAgain: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tenue-ok"
      style={{
        position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(14,15,19,.28)', animation: 'fade-in 300ms both',
      }}
    >
      <div
        className="glass glass-strong card card-center"
        style={{
          width: '100%', maxWidth: 430, borderRadius: '34px 34px 0 0', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
          animation: 'sheet-up 520ms cubic-bezier(.2,.8,.2,1) both', gap: 16,
        }}
      >
        <span
          style={{
            width: 78, height: 78, borderRadius: 999, background: 'var(--ink)', color: 'var(--on-ink)',
            display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-float)',
          }}
          className="pop"
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path className="check-draw" d={ICON.check} />
          </svg>
        </span>
        <h2 id="tenue-ok" style={{ fontSize: 25 }}>Tenue <em className="accent">enregistrée</em></h2>
        <p className="lead small">Elle t’attend dans tes tenues. Tu pourras la prévoir pour un jour précis.</p>
        <Link href="/tenues" className="btn btn-primary btn-block">Voir mes tenues</Link>
        <button type="button" onClick={onAgain} className="btn btn-glass btn-block">En composer une autre</button>
      </div>
    </div>
  );
}
