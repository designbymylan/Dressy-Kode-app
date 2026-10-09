/**
 * Effacer des fichiers du stockage, pour le ménage de la nuit et la
 * suppression d'un compte. Par l'API de stockage, cent par cent et seau par
 * seau : la base refuse les suppressions directes dans storage.objects.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type Fichier = { bucket: string; path: string };

export async function effacerFichiers(admin: SupabaseClient, fichiers: Fichier[]): Promise<number> {
  const parSeau = new Map<string, string[]>();
  for (const f of fichiers) parSeau.set(f.bucket, [...(parSeau.get(f.bucket) ?? []), f.path]);
  let n = 0;
  for (const [seau, chemins] of parSeau) {
    for (let i = 0; i < chemins.length; i += 100) {
      const lot = chemins.slice(i, i + 100);
      const { error } = await admin.storage.from(seau).remove(lot);
      if (error) throw new Error(`effacement dans ${seau} : ${error.message}`);
      n += lot.length;
    }
  }
  return n;
}
