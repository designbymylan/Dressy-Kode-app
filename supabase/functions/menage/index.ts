/**
 * Le ménage de la nuit (RGPD art. 5.1.e), réveillé par pg_cron
 * (`rgpd-menage`, 3 h 41). Il applique les durées du registre (docs/rgpd/) :
 *
 * - photos confiées à Kodi : effacées 30 jours après l'envoi (la photo de
 *   profil reste tant que la personne la garde) ;
 * - exports de données : deux jours ;
 * - conversations avec Kodi : archivées, deux mois (le quota se compte au
 *   mois) ; toutes, douze mois ;
 * - demandes de dessin terminées ou en échec : 90 jours (la pièce dessinée
 *   reste dans le dressing).
 *
 * Déployée SANS vérification JWT : elle ne prend aucune entrée et ne fait
 * qu'appliquer ces durées. L'appeler plus souvent n'efface rien de plus.
 */
import { createClient } from '@supabase/supabase-js';
import { envKey } from '../_shared/env.ts';
import { effacerFichiers, type Fichier } from '../_shared/stockage.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ilYa = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString();

async function fichiersEchus(): Promise<number> {
  let total = 0;
  // Cinq cents par tour, dix tours au plus : une nuit chargée finit la suivante.
  for (let tour = 0; tour < 10; tour++) {
    const { data, error } = await admin.rpc('expired_files', { max_rows: 500 });
    if (error) throw new Error(`fichiers échus : ${error.message}`);
    const lot = (data ?? []) as Fichier[];
    if (!lot.length) break;
    total += await effacerFichiers(admin, lot);
    if (lot.length < 500) break;
  }
  return total;
}

async function compter(q: PromiseLike<{ count: number | null; error: { message: string } | null }>, quoi: string) {
  const { count, error } = await q;
  if (error) throw new Error(`${quoi} : ${error.message}`);
  return count ?? 0;
}

Deno.serve(async () => {
  try {
    const fichiers = await fichiersEchus();
    const archives = await compter(admin.from('kode_messages').delete({ count: 'exact' }).eq('archived', true).lt('created_at', ilYa(61)), 'conversations archivées');
    const anciennes = await compter(admin.from('kode_messages').delete({ count: 'exact' }).lt('created_at', ilYa(366)), 'conversations');
    const demandes = await compter(admin.from('ai_jobs').delete({ count: 'exact' }).in('status', ['done', 'failed']).lt('updated_at', ilYa(90)), 'demandes de dessin');
    const bilan = { fichiers, messages: archives + anciennes, demandes };
    console.log('[menage]', JSON.stringify(bilan));
    return Response.json({ ok: true, ...bilan });
  } catch (e) {
    console.error('[menage]', e instanceof Error ? e.message : e);
    return Response.json({ ok: false }, { status: 500 });
  }
});
