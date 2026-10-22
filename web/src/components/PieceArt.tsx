import type { CSSProperties } from 'react';
import { iconFor, kindOf, categoryMeta } from '@/lib/wardrobe';
import { colourHex } from '@/lib/onboarding';
import type { Piece } from '@/lib/garments';

/**
 * L'image d'une pièce : sa vignette détourée si Kodi l'a préparée, sinon le
 * pictogramme de son type teinté de sa couleur (pièce saisie à la main).
 */
export function PieceArt({ piece, size = 56 }: { piece: Pick<Piece, 'url' | 'category_id' | 'kind' | 'colors'>; size?: number }) {
  if (piece.url) {
    return <img src={piece.url} alt="" loading="lazy" draggable={false} />;
  }
  const tint = piece.colors[0] ? colourHex(piece.colors[0]) : null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill={tint ?? 'none'} fillOpacity={tint ? 0.9 : 1}
      stroke="var(--ink-soft)" strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round">
      <path d={iconFor(piece.category_id, piece.kind)} />
    </svg>
  );
}

export function pieceKindLabel(piece: Pick<Piece, 'category_id' | 'kind'>): string {
  return kindOf(piece.category_id, piece.kind)?.label ?? categoryMeta(piece.category_id)?.label ?? '';
}

/** Vignette de pièce pour les grilles du dressing. */
export function PieceCard({ piece, i = 0 }: { piece: Piece; i?: number }) {
  return (
    <article className="piece pop" style={{ '--i': i } as CSSProperties}>
      <div className="piece-frame">
        <PieceArt piece={piece} size={64} />
      </div>
      <div>
        <p className="piece-name">{piece.name}</p>
        <p className="piece-kind">{pieceKindLabel(piece)}</p>
      </div>
    </article>
  );
}
