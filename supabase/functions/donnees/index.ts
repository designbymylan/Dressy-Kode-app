/**
 * Les données du jour pour l'app : météo, air, soleil, jours fériés,
 * ponts, vacances scolaires, tendances, fête du jour. L'app n'appelle
 * jamais ces API elle-même : elle appelle cette fonction, qui passe par le
 * cache partagé et la chaîne de repli (_shared/donnees/).
 *
 *   POST { ville? }  →  Contexte (voir _shared/donnees/contexte.ts)
 *   POST { action: 'lieux', q }  →  { lieux: Bloc<Lieu[]> }  (voyages, 07/10)
 *   POST { action: 'voyage', nom, lat, lon, debut, fin }  →  { photo, prevision, saison }
 *
 * Sans `ville`, c'est celle du profil (settings.city), lue avec le jeton de
 * la personne, donc à travers la RLS. Déployée AVEC vérification JWT. La
 * clé service ne sert qu'au cache, qui ne contient rien de personnel.
 */
import { createClient } from '@supabase/supabase-js';
import { envKey } from '../_shared/env.ts';
import { cachePostgres } from '../_shared/donnees/cache.ts';
import { contexteDuJour } from '../_shared/donnees/contexte.ts';
import { chercherLieux, meteoVoyage, photoDuLieu } from '../_shared/donnees/voyage.ts';
import { jourParis } from '../_shared/donnees/temps.ts';

const JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const PUBLIC_KEY = envKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
const admin = createClient(SUPABASE_URL, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const cache = cachePostgres(admin);

// L'aperçu web de l'app mobile appelle depuis un navigateur : il lui faut ces en-têtes.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

/** De temps en temps, on efface les lignes expirées depuis plus d'une semaine (soleil et fête du jour en laissent une par jour). */
async function menage() {
  if (Math.random() > 0.02) return;
  const limite = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { error } = await admin.from('data_cache').delete().lt('expire', limite);
  if (error) console.warn('[donnees] ménage du cache :', error.message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Méthode non prise en charge' }, 405);

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Connexion nécessaire.' }, 401);

  try {
    const db = createClient(SUPABASE_URL, PUBLIC_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return json({ error: 'Session expirée. Reconnecte-toi.' }, 401);

    const input = await req.json().catch(() => ({}));

    // Les voyages : un lieu dans le monde, puis sa photo et sa météo jour par jour.
    if (input?.action === 'lieux') {
      const q = typeof input.q === 'string' ? input.q.trim().slice(0, 80) : '';
      if (q.length < 2) return json({ error: 'Tape au moins deux lettres.' }, 400);
      return json({ lieux: await chercherLieux(cache, q) });
    }
    if (input?.action === 'voyage') {
      const { nom, lat, lon, debut, fin } = input;
      if (typeof nom !== 'string' || !Number.isFinite(lat) || !Number.isFinite(lon) || !JOUR_ISO.test(debut) || !JOUR_ISO.test(fin) || fin < debut)
        return json({ error: 'Le voyage est incomplet.' }, 400);
      const [photo, meteo] = await Promise.all([photoDuLieu(cache, nom.slice(0, 80)), meteoVoyage(cache, lat, lon, debut, fin, jourParis())]);
      await menage();
      return json({ photo, ...meteo });
    }

    let ville = typeof input?.ville === 'string' ? input.ville.trim().slice(0, 80) : '';
    if (!ville) {
      // La RLS ne laisse voir que les réglages des espaces de la personne.
      const { data: s } = await db.from('settings').select('city').limit(1).maybeSingle();
      ville = s?.city ?? '';
    }

    const contexte = await contexteDuJour(cache, ville || null);
    await menage();
    return json(contexte);
  } catch (err) {
    // contexteDuJour ne lève pas (chaque bloc a son repli) : ici, c'est la session ou la base.
    console.error('[donnees]', err instanceof Error ? err.message : err);
    return json({ error: 'Les données du jour n’ont pas pu être chargées. Réessaie dans un instant.' }, 500);
  }
});
