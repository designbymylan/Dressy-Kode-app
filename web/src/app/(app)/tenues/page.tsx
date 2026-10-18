import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { loadPieces } from '@/lib/garments';
import { DeleteOutfit } from '@/components/DeleteOutfit';
import { PieceArt } from '@/components/PieceArt';
import { Screen, Title, Card, Icon, ICON } from '@/components/ui';

export default async function Tenues() {
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  const supabase = await createClient();

  const [pieces, { data: outfits }] = await Promise.all([
    loadPieces(supabase),
    supabase
      .from('outfits')
      .select('id, name, source, created_at, outfit_items(garment_id, slot, position)')
      .order('created_at', { ascending: false }),
  ]);

  const byId = new Map(pieces.map((p) => [p.id, p]));
  const list = (outfits ?? []).map((o) => ({
    ...o,
    items: [...(o.outfit_items ?? [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((it) => byId.get(it.garment_id))
      .filter(Boolean) as NonNullable<ReturnType<typeof byId.get>>[],
  }));

  return (
    <Screen>
      <Title sub={list.length ? `${list.length} tenue${list.length > 1 ? 's' : ''} composée${list.length > 1 ? 's' : ''} avec ce que tu as déjà.` : 'Assemble tes pièces en quelques gestes.'}>
        Tes <em className="accent">tenues</em>
      </Title>

      <Link href="/tenues/nouvelle" className="btn btn-primary btn-block rise" style={{ '--i': 1 } as CSSProperties}>
        <Icon d={ICON.sparkle} size={18} /> Composer une tenue
      </Link>

      {list.length === 0 ? (
        <Card center i={2} style={{ paddingBlock: 30 }}>
          <div style={{ display: 'flex', gap: 10 }} aria-hidden="true">
            {[-8, 4, -2].map((r, i) => (
              <span
                key={i}
                className="float"
                style={{
                  '--r': `${r}deg`, animationDelay: `${i * -2}s`, width: 64, height: 78, borderRadius: 20,
                  background: 'var(--tile)', border: '1px solid var(--glass-edge)', boxShadow: 'var(--shadow-glass)',
                  display: 'grid', placeItems: 'center',
                } as CSSProperties}
              >
                <Icon d={[ICON.hanger, 'M8 4 12 6.5 16 4l5 2.5-2 4-2-1V20H7V9.5l-2 1-2-4Z', 'M3 16h11l6 1.5V20H3ZM3 16V9l3 1 2 3 5 1'][i]} size={30} width={1.3} />
              </span>
            ))}
          </div>
          <h2 style={{ fontSize: 22 }}>Ta première <em className="accent">tenue</em></h2>
          <p className="lead small">
            Choisis un haut, un bas, des chaussures, puis la touche finale : un sac, un bandeau, tes bijoux.
            Le bouton Mélanger propose une autre combinaison à chaque fois.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {list.map((o, i) => (
            <article
              key={o.id}
              className="glass outfit-card pop"
              style={{ '--i': Math.min(i, 10), position: 'relative', padding: 10, borderRadius: 26, display: 'flex', flexDirection: 'column', gap: 8 } as CSSProperties}
            >
              <div className="board" aria-hidden="true">
                {o.items.slice(0, 4).map((p) => (
                  <span key={p.id}><PieceArt piece={p} size={40} /></span>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingInline: 4 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</p>
                  <p className="piece-kind">
                    {o.items.length} pièce{o.items.length > 1 ? 's' : ''}{o.source === 'kode' ? ' · par Kode' : ''}
                  </p>
                </div>
                <DeleteOutfit id={o.id} name={o.name} />
              </div>
            </article>
          ))}
        </div>
      )}
    </Screen>
  );
}
