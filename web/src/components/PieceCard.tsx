import { Garment, type ShapeName } from '@/components/garments';

/** Silhouette de remplacement tant que la photo n'est pas prête. */
const SHAPE_OF: Record<string, ShapeName> = {
  Hauts: 'chemise',
  Bas: 'jean',
  Robes: 'robe',
  'Vestes et manteaux': 'trench',
  Chaussures: 'escarpin',
};
import { WearButton } from '@/components/WearButton';

export type PieceView = {
  id: string;
  name: string;
  category: string;
  url: string | null;
  wearCount: number;
  /** « il y a 3 j », null si jamais porté */
  worn: string | null;
  wornToday: boolean;
};

/** Une pièce : vignette, nom, et l'état de port qui nourrit la progression. */
export function PieceCard({ piece, width, wearable = true }: { piece: PieceView; width?: number; wearable?: boolean }) {
  return (
    <article className="dk-piece" style={width ? { width } : undefined}>
      <div className="dk-piece__pic">
        {piece.url ? (
          <img src={piece.url} alt="" loading="lazy" />
        ) : (
          <Garment shape={SHAPE_OF[piece.category] ?? 'blazer'} size={72} fill="var(--surface)" stroke="var(--subtle)" />
        )}
        {wearable ? (
          <span style={{ position: 'absolute', top: 6, right: 6 }}>
            <WearButton id={piece.id} name={piece.name} initial={piece.wornToday} />
          </span>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingInline: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {piece.name}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {piece.worn ? (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Porté {piece.wearCount > 1 ? `${piece.wearCount}× · ` : ''}{piece.worn}
            </span>
          ) : (
            <span className="dk-tag dk-tag--butter">Jamais porté</span>
          )}
        </span>
      </div>
    </article>
  );
}
