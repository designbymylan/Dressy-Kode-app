import { notFound } from 'next/navigation';
import type { Piece } from '@/lib/garments';
import { CATEGORIES } from '@/lib/wardrobe';
import { DressingBar } from '@/components/DressingBar';
import { DressingRails, type WearStat } from '@/components/DressingRails';
import { TabBar } from '@/components/TabBar';
import { Screen, Title } from '@/components/ui';
import { PIECES } from '../fixtures';

/**
 * Planche du dressing, sans compte ni base : les onglets, le choix grille ou
 * portants et les vignettes du vrai écran, nourris des pièces inventées
 * d'Alice. Mêmes paramètres que /dressing (?cat=, ?vue=portants). Fermée par
 * défaut : elle ne s'ouvre qu'avec DRESSY_APERCU=1 dans l'environnement du
 * serveur.
 */
export const dynamic = 'force-dynamic';

const COLOUR: Record<string, string> = { m1: 'camel', m6: 'anthracite', h1: 'gris', h2: 'creme', h3: 'ciel', b1: 'gris', b2: 'noir', b3: 'gris', r3: 'vert', c1: 'marron', c5: 'noir', a1: 'camel', a5: 'marron' };
const TAB_LABEL: Record<string, string> = { vestes: 'Manteaux' };

export default async function ApercuDressing({ searchParams }: { searchParams: Promise<{ cat?: string; vue?: string }> }) {
  if (process.env.DRESSY_APERCU !== '1') notFound();
  const { cat, vue } = await searchParams;
  const now = Date.now();

  const items: Piece[] = PIECES.map((p) => ({
    id: p.id, name: p.name, category_id: p.category_id, kind: p.kind, colors: [COLOUR[p.id]], url: p.url,
    created_at: new Date(now - p.addedDaysAgo * 86_400_000).toISOString(), brand: null, size: null, fit: null, material: null, reports: 0,
  }));
  const stats: Record<string, WearStat> = Object.fromEntries(PIECES.map((p) => [p.id, { wears: p.wears, last: null }]));

  const layout = vue === 'portants' ? 'portants' : 'grille';
  const rails = CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon, pieces: items.filter((g) => g.category_id === c.id) }));
  const filled = rails.filter((r) => r.pieces.length > 0);
  const current = filled.some((r) => r.id === cat) ? (cat as string) : 'tout';
  const shown = filled.filter((r) => current === 'tout' || r.id === current);

  return (
    <>
      <Screen>
        <Title sub={`${items.length} pièces dans l’espace d’Alice`}>
          <em className="accent">Dressing</em>
        </Title>
        <DressingBar
          tabs={filled.map((r) => ({ id: r.id, label: TAB_LABEL[r.id] ?? r.label }))}
          current={current}
          layout={layout}
          count={shown.reduce((n, r) => n + r.pieces.length, 0)}
          base="/apercu/dressing"
        />
        <DressingRails rails={shown} stats={stats} layout={layout} now={new Date(now).toISOString()} />
      </Screen>
      <TabBar active="/dressing" />
    </>
  );
}
