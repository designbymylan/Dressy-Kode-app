/**
 * Le banc d'essai de Kodi (13/11) : sondes du fournisseur pour Kodi
 * (sorties structurées, effort, repli sur refus, cache), scénarios et
 * relecture. Il réutilise le vrai code de Kodi (kode/claude.ts,
 * kode/demande.ts, kode/prompt.ts…), côté serveur, avec les clés des
 * secrets : aucune clé ne sort. Fonction à part de `kode` pour rester légère
 * à déployer quand la consigne change.
 *
 *   POST { banc: { id, jeton } }   (voir _shared/banc.ts)
 *
 * Déployée SANS vérification JWT : le jeton à usage unique tient lieu de clé.
 * Les essais de l'agent photo (sondes, découpe) sont dans `dressy-agent`.
 */
import { createClient } from '@supabase/supabase-js';
import { envKey } from '../_shared/env.ts';
import { lancerBanc } from '../_shared/banc.ts';
import { sondes } from './sondes.ts';
import { essaiKodi, essaiJuge } from './kodi.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const db = createClient(Deno.env.get('SUPABASE_URL')!, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });
  const input = await req.json().catch(() => null) as { banc?: Record<string, unknown> } | null;
  if (!input?.banc) return Response.json({ error: 'refusé' }, { status: 403 });
  return lancerBanc(db, input.banc, { sonde: sondes, kodi: essaiKodi, juge: essaiJuge }, (p) => EdgeRuntime.waitUntil(p));
});
