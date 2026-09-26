/** La conversation avec Kode et les tenues qu'il propose, telles que les écrans les affichent. */
import type { createClient } from '@/lib/supabase/server';
import { signAll } from '@/lib/storage';
import { colourHex } from '@/lib/onboarding';

type Db = Awaited<ReturnType<typeof createClient>>;

export type OutfitPiece = {
  id: string;
  name: string;
  slot: string;
  category: string;
  colour: string | null; // teinte de la silhouette quand la pièce n'a pas d'image
  url: string | null;
};

export type OutfitView = { id: string; title: string; why: string; pieces: OutfitPiece[] };

export type KodeMessage = {
  id: string;
  author: 'user' | 'kode';
  body: string;
  outfit: OutfitView | null;
};

/** quota null : questions illimitées (offres Atelier et Couture). */
export type KodeUsage = { used: number; quota: number | null };

// Ordre de pose dans la carte : les grandes pièces d'abord, les petites devant.
const SLOT_ORDER = ['veste', 'robe', 'haut', 'bas', 'chaussures', 'sac', 'accessoire'];

type GarmentRow = { id: string; name: string; category_id: string; colors: string[] | null; thumb_path: string | null; image_path: string | null };
export type OutfitRow = { id: string; name: string | null; outfit_items: { slot: string; garments: GarmentRow | null }[] };

export const OUTFIT_SELECT = 'id, name, outfit_items(slot, garments(id, name, category_id, colors, thumb_path, image_path))';

/** Met des tenues en forme, vignettes signées en un seul aller-retour. */
export async function outfitViews(
  supabase: Db,
  rows: { outfit: OutfitRow; why?: string | null; title?: string | null }[],
): Promise<Map<string, OutfitView>> {
  const paths = rows.flatMap((r) => r.outfit.outfit_items.map((i) => i.garments?.thumb_path ?? i.garments?.image_path ?? ''));
  const urls = await signAll(supabase, 'garments', paths);

  const out = new Map<string, OutfitView>();
  for (const { outfit, why, title } of rows) {
    const pieces = outfit.outfit_items
      .filter((i) => i.garments)
      .map((i) => {
        const g = i.garments!;
        const path = g.thumb_path ?? g.image_path;
        return {
          id: g.id,
          name: g.name,
          slot: i.slot,
          category: g.category_id,
          colour: g.colors?.[0] ? colourHex(g.colors[0]) : null,
          url: path ? urls.get(path) ?? null : null,
        };
      })
      .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
    // Une tenue dont les pièces ont été supprimées du dressing n'a plus rien à montrer.
    if (pieces.length) out.set(outfit.id, { id: outfit.id, title: title || outfit.name || 'Tenue', why: why ?? '', pieces });
  }
  return out;
}

type MessageRow = {
  id: string;
  author: 'user' | 'kode';
  body: string;
  meta: { titre?: string | null; pourquoi?: string | null } | null;
  outfits: OutfitRow | null;
};

/**
 * La conversation en cours (les 40 dernières bulles), ou seulement les
 * bulles demandées quand une réponse vient d'arriver.
 */
export async function loadMessages(supabase: Db, spaceId: string, ids?: string[]): Promise<KodeMessage[]> {
  let query = supabase
    .from('kode_messages')
    .select(`id, author, body, meta, outfits(${OUTFIT_SELECT})`)
    .eq('space_id', spaceId)
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(40);
  if (ids) query = query.in('id', ids);

  const { data } = await query;
  const rows = ((data ?? []) as unknown as MessageRow[]).reverse();

  const outfits = await outfitViews(
    supabase,
    rows.filter((r) => r.outfits).map((r) => ({ outfit: r.outfits!, why: r.meta?.pourquoi, title: r.meta?.titre })),
  );

  return rows.map((r) => ({
    id: r.id,
    author: r.author,
    body: r.body,
    outfit: r.outfits ? outfits.get(r.outfits.id) ?? null : null,
  }));
}

export async function loadUsage(supabase: Db, spaceId: string): Promise<KodeUsage> {
  const { data } = await supabase.rpc('kode_usage', { target: spaceId });
  const row = (Array.isArray(data) ? data[0] : data) as KodeUsage | null;
  return { used: row?.used ?? 0, quota: row ? row.quota : 0 };
}
