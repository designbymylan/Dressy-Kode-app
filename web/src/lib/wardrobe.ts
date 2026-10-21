import type { createClient } from '@/lib/supabase/server';
import type { KodiMood } from '@/components/Kodi';
import type { PieceView } from '@/components/PieceCard';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Fenêtre sur laquelle une pièce compte comme « portée ». */
export const WINDOW_DAYS = 90;

/** Date du jour à Paris, au format AAAA-MM-JJ : le serveur peut tourner en UTC. */
export function todayParis(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
}

export function daysAgo(n: number, from = new Date()) {
  return todayParis(new Date(from.getTime() - n * 86400000));
}

export type GarmentRow = {
  id: string;
  name: string;
  category_id: string;
  image_path: string | null;
  thumb_path: string | null;
  created_at?: string;
};

export type PieceWear = { count: number; last: string | null };

export type Usage = {
  total: number;
  worn: number;
  pct: number;
  windowDays: number;
  categories: { id: string; label: string; total: number; worn: number; pct: number }[];
  /** Par pièce : nombre de ports et dernier port connu. */
  wear: Record<string, PieceWear>;
  wornToday: string[];
};

/**
 * La part de la garde-robe réellement portée ces 90 derniers jours.
 *
 * Deux sources : les ports notés pièce par pièce (`wears`) et les jours du
 * calendrier marqués « porté » (`planned_days.worn`, via les pièces de la
 * tenue). La RLS limite tout à l'espace de la personne.
 */
export async function getUsage(
  supabase: Supabase,
  garments: GarmentRow[],
  categories: { id: string; label: string }[],
): Promise<Usage> {
  const since = daysAgo(WINDOW_DAYS);
  const today = todayParis();

  const [{ data: wears }, { data: days }] = await Promise.all([
    supabase.from('wears').select('garment_id, worn_on').order('worn_on', { ascending: false }).limit(5000),
    supabase.from('planned_days').select('outfit_id, day').eq('worn', true).gte('day', since),
  ]);

  const wear: Record<string, PieceWear> = {};
  const recent = new Set<string>();
  const wornToday: string[] = [];

  for (const w of wears ?? []) {
    const cur = (wear[w.garment_id] ??= { count: 0, last: null });
    cur.count += 1;
    if (!cur.last || w.worn_on > cur.last) cur.last = w.worn_on;
    if (w.worn_on >= since) recent.add(w.garment_id);
    if (w.worn_on === today) wornToday.push(w.garment_id);
  }

  const outfitIds = [...new Set((days ?? []).map((d) => d.outfit_id).filter(Boolean))] as string[];
  if (outfitIds.length) {
    const { data: items } = await supabase.from('outfit_items').select('garment_id').in('outfit_id', outfitIds);
    for (const it of items ?? []) recent.add(it.garment_id);
  }

  const ids = new Set(garments.map((g) => g.id));
  const worn = [...recent].filter((id) => ids.has(id)).length;
  const total = garments.length;

  return {
    total,
    worn,
    pct: total ? (worn / total) * 100 : 0,
    windowDays: WINDOW_DAYS,
    categories: categories
      .map((c) => {
        const mine = garments.filter((g) => g.category_id === c.id);
        const w = mine.filter((g) => recent.has(g.id)).length;
        return { id: c.id, label: c.label, total: mine.length, worn: w, pct: mine.length ? (w / mine.length) * 100 : 0 };
      })
      .filter((c) => c.total > 0),
    wear,
    wornToday,
  };
}

/** Ce que Kodi dit de la barre de progression, et la tête qu'il fait. */
export function usageMood(total: number, worn: number, pct: number): { mood: KodiMood; line: string } {
  if (!total) return { mood: 'wave', line: 'Ajoute tes pièces, je m’occupe du reste.' };
  if (!worn) return { mood: 'thinking', line: 'Touche le cintre d’une pièce quand tu la portes : je tiens le compte.' };
  if (pct < 25) return { mood: 'sleepy', line: 'La plupart de tes pièces dorment. On en réveille une demain ?' };
  if (pct < 50) return { mood: 'wink', line: 'Bon début. L’autre moitié de ton dressing t’attend.' };
  if (pct < 80) return { mood: 'happy', line: 'Tu fais tourner ton dressing, c’est beau à voir.' };
  return { mood: 'celebrate', line: 'Presque tout ton dressing vit. Bravo !' };
}

/** « il y a 3 j », « aujourd'hui », « jamais porté ». */
export function wornLabel(w: PieceWear | undefined, today = todayParis()) {
  if (!w?.last) return null;
  const diff = Math.round((Date.parse(today) - Date.parse(w.last)) / 86400000);
  if (diff <= 0) return 'aujourd’hui';
  if (diff === 1) return 'hier';
  if (diff < 30) return `il y a ${diff} j`;
  if (diff < 365) return `il y a ${Math.round(diff / 30)} mois`;
  return 'il y a plus d’un an';
}

/** Catégories, pièces (les plus récentes d'abord) et leur usage. */
export async function loadWardrobe(supabase: Supabase) {
  const [{ data: categories }, { data: garments }] = await Promise.all([
    supabase.from('categories').select('id, label').order('sort'),
    supabase
      .from('garments')
      .select('id, name, category_id, image_path, thumb_path, created_at')
      .order('created_at', { ascending: false }),
  ]);
  const items = (garments ?? []) as GarmentRow[];
  const cats = (categories ?? []) as { id: string; label: string }[];
  const usage = await getUsage(supabase, items, cats);
  return { items, categories: cats, usage };
}

/** Ce qu'une vignette affiche : image signée, catégorie, état de port. */
export async function toPieces(
  supabase: Supabase,
  list: GarmentRow[],
  usage: Usage,
  categories: { id: string; label: string }[],
): Promise<PieceView[]> {
  const pathOf = (g: GarmentRow) => (g.thumb_path ?? g.image_path) as string;
  const urls = await signAll(supabase, 'garments', list.map(pathOf).filter(Boolean));
  const label = new Map(categories.map((c) => [c.id, c.label]));
  const today = todayParis();
  const wornToday = new Set(usage.wornToday);
  return list.map((g) => ({
    id: g.id,
    name: g.name,
    category: label.get(g.category_id) ?? '',
    url: urls.get(pathOf(g)) ?? null,
    wearCount: usage.wear[g.id]?.count ?? 0,
    worn: wornLabel(usage.wear[g.id], today),
    wornToday: wornToday.has(g.id),
  }));
}

/** Pièces sans port depuis la fenêtre de suivi. */
export function asleepCount(items: GarmentRow[], usage: Usage) {
  const since = daysAgo(usage.windowDays);
  return items.filter((g) => !usage.wear[g.id]?.last || usage.wear[g.id]!.last! < since).length;
}

/** URL signées en un seul aller-retour : les deux buckets sont privés. */
export async function signAll(supabase: Supabase, bucket: string, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
  for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl);
  return out;
}
