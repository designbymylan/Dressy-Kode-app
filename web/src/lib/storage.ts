import type { createClient } from '@/lib/supabase/server';

const HOUR = 3600;

/** URL signées en un seul aller-retour : les buckets du dressing sont privés. */
export async function signAll(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: string,
  paths: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return out;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, HOUR);
  for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl);
  return out;
}
