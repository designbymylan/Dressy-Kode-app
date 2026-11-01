import type { createClient } from '@/lib/supabase/server';

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Ce que l'écran montre des générations : l'offre et ce qui reste, rien de
 * plus (la dotation de départ ne sort jamais de la base). Null si la base ne
 * répond pas : l'écran cache alors « Image propre » plutôt que de mentir.
 */
export type Generation = { plan: string; remaining: number };

export async function loadGeneration(supabase: Db, spaceId: string): Promise<Generation | null> {
  const { data, error } = await supabase.rpc('generation_status', { p_space: spaceId });
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as { plan?: string; remaining?: number } | null;
  if (!row || typeof row.remaining !== 'number') return null;
  return { plan: String(row.plan ?? 'decouverte'), remaining: row.remaining };
}

/** Un abonné ne voit pas le compteur des générations offertes. */
export const isFree = (g: Generation) => g.plan === 'decouverte';

/** Le compte créateur n'a ni compteur ni plafond. */
export const isCreator = (g: Generation) => g.plan === 'createur';
