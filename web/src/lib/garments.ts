import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Piece = {
  id: string;
  name: string;
  category_id: string;
  kind: string | null;
  colors: string[];
  url: string | null;
  /** Date d'arrivée dans le dressing (les nouvelles pièces tombent sur leur portant). */
  created_at: string;
};

const HOUR = 3600;

/** URL signées en un seul aller-retour : les buckets sont privés. */
export async function signAll(supabase: Supabase, bucket: string, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, HOUR);
  for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl);
  return out;
}

/** Les pièces actives de l'espace, avec l'URL de leur vignette (ou null sans image). */
export async function loadPieces(supabase: Supabase): Promise<Piece[]> {
  const { data } = await supabase
    .from('garments')
    .select('id, name, category_id, kind, colors, image_path, thumb_path, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  const rows = data ?? [];
  const urls = await signAll(
    supabase,
    'garments',
    rows.map((g) => g.thumb_path ?? g.image_path).filter(Boolean) as string[],
  );

  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    category_id: g.category_id,
    kind: g.kind ?? null,
    colors: g.colors ?? [],
    url: urls.get((g.thumb_path ?? g.image_path) as string) ?? null,
    created_at: g.created_at,
  }));
}
