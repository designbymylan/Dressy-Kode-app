import Link from 'next/link';
import { Icon } from '@/components/icons';

/**
 * Les catégories en onglets soulignés, le nombre de pièces, et le choix entre
 * la grille et les portants (l'état vit dans l'adresse : ?cat=, ?vue=).
 */
export function DressingBar({
  tabs,
  current,
  layout,
  count,
  base = '/dressing',
}: {
  tabs: { id: string; label: string }[];
  current: string;
  layout: 'grille' | 'portants';
  count: number;
  base?: string;
}) {
  const href = (c: string, v: string) => {
    const q = new URLSearchParams({ ...(c !== 'tout' ? { cat: c } : {}), ...(v !== 'grille' ? { vue: v } : {}) }).toString();
    return q ? `${base}?${q}` : base;
  };
  return (
    <>
      <nav className="dress-tabs" aria-label="Catégories">
        {[{ id: 'tout', label: 'Tout' }, ...tabs].map((t) => (
          <Link key={t.id} href={href(t.id, layout)} className="dress-tab" aria-current={t.id === current ? 'page' : undefined} scroll={false}>
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="dress-bar">
        <span className="small muted">{count} pièce{count > 1 ? 's' : ''}</span>
        <div className="dress-view" role="group" aria-label="Affichage">
          <Link href={href(current, 'grille')} className="icon-btn" aria-label="En grille" aria-current={layout === 'grille' ? 'page' : undefined} scroll={false}>
            <Icon name="grid" size={18} />
          </Link>
          <Link href={href(current, 'portants')} className="icon-btn" aria-label="Par portants" aria-current={layout === 'portants' ? 'page' : undefined} scroll={false}>
            <Icon name="hanger" size={18} />
          </Link>
        </div>
      </div>
    </>
  );
}
