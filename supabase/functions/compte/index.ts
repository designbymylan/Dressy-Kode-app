/**
 * Ton compte et tes données (RGPD art. 15, 17 et 20 ; App Store 5.1.1(v)).
 *
 *   POST { action: 'exporter' }
 *     → { url } : toutes tes données dans un fichier JSON, lisible une heure
 *       par ce lien (les images de tes pièces y sont en liens valables
 *       sept jours). Le fichier est effacé au bout de deux jours.
 *   POST { action: 'supprimer', confirmation: 'SUPPRIMER' }
 *     → { ok } : l'abonnement s'arrête, les fichiers puis le compte sont
 *       effacés ; la base efface en cascade tout ce qui en dépend.
 *
 * Déployée AVEC vérification JWT. La personne est reconnue par getUser()
 * (le jeton est revalidé), son espace par la RLS, jamais par la requête.
 * Les factures restent chez le prestataire de paiement : la loi impose de
 * les garder dix ans (code de commerce, art. L123-22).
 */
import Stripe from 'stripe';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { envKey, secret } from '../_shared/env.ts';
import { ENTITLED } from '../_shared/billing.ts';
import { effacerFichiers, type Fichier } from '../_shared/stockage.ts';

class CompteError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const PUBLIC_KEY = envKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
const admin = createClient(SUPABASE_URL, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Les liens des images, dans l'export : sept jours pour les enregistrer. */
const IMAGE_TTL = 7 * 24 * 3600;
/** Le lien de l'export lui-même : une heure. */
const EXPORT_TTL = 3600;

async function openSession(token: string) {
  const db = createClient(SUPABASE_URL, PUBLIC_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) throw new CompteError('Session expirée. Reconnecte-toi.', 401);
  const { data: space } = await db.from('spaces').select('id, name, created_at').limit(1).maybeSingle();
  if (!space) throw new CompteError('Espace introuvable.', 404);
  return { db, user, space: space as { id: string; name: string; created_at: string } };
}

/** Une lecture de l'export : en cas d'erreur, la section le dit au lieu de manquer en silence. */
async function lire<T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>, quoi: string): Promise<T | { erreur: string }> {
  const { data, error } = await q;
  if (error) {
    console.error(`[compte] export, ${quoi} :`, error.message);
    return { erreur: 'Section illisible pour le moment : redemande l’export dans un instant.' };
  }
  return (data ?? []) as T;
}

// ---------------------------------------------------------------- exporter

async function exporter(token: string): Promise<{ url: string }> {
  const { db, user, space } = await openSession(token);
  const sid = space.id;
  const garments = await db.from('garments').select('*').eq('space_id', sid).order('created_at');
  if (garments.error) throw new Error(`pièces : ${garments.error.message}`);
  const pieces = garments.data ?? [];

  // Les images de tes pièces, en liens signés : l'export reste lisible sans l'app.
  const paths = [...new Set(pieces.flatMap((g) => [g.image_path, g.thumb_path]).filter(Boolean) as string[])];
  const signed = paths.length ? (await db.storage.from('garments').createSignedUrls(paths, IMAGE_TTL)).data ?? [] : [];
  const url = new Map(signed.map((x) => [x.path, x.signedUrl]));
  const profile = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
  const avatar = profile.data?.avatar_url ? (await db.storage.from('uploads').createSignedUrl(profile.data.avatar_url, IMAGE_TTL)).data?.signedUrl ?? null : null;

  const donnees = {
    a_lire: [
      'Voici toutes les données que Dresskode garde sur toi, telles qu’elles sont enregistrées.',
      'Les liens des images restent valables sept jours : enregistre-les si tu veux les garder.',
      'Les factures de tes abonnements sont chez notre prestataire de paiement : tu les retrouves depuis « Mon offre ».',
      'Une question, une correction ? Écris-nous depuis Réglages › Tes données.',
    ],
    exporte_le: new Date().toISOString(),
    compte: {
      email: user.email,
      cree_le: user.created_at,
      derniere_connexion: user.last_sign_in_at,
      connexion_par: user.app_metadata?.providers ?? [user.app_metadata?.provider].filter(Boolean),
    },
    profil: { ...(profile.data ?? {}), photo_de_profil: avatar },
    espace: space,
    reglages: await lire(db.from('settings').select('*').eq('space_id', sid), 'réglages'),
    style: await lire(db.from('style_profile').select('*').eq('space_id', sid), 'style'),
    silhouette: await lire(db.from('silhouettes').select('*').eq('space_id', sid), 'silhouette'),
    accords: await lire(db.from('consents').select('kind, version, granted, created_at').eq('space_id', sid).order('created_at'), 'accords'),
    pieces: pieces.map((g) => ({ ...g, image: g.image_path ? url.get(g.image_path) ?? null : null, vignette: g.thumb_path ? url.get(g.thumb_path) ?? null : null })),
    ports: await lire(db.from('wears').select('garment_id, worn_on, created_at').order('worn_on'), 'ports'),
    prets: await lire(db.from('loans').select('*').order('created_at'), 'prêts'),
    tenues: await lire(db.from('outfits').select('*, outfit_items(*)').eq('space_id', sid).order('created_at'), 'tenues'),
    jours_prevus: await lire(db.from('planned_days').select('*').eq('space_id', sid).order('day'), 'jours prévus'),
    rendez_vous: await lire(db.from('events').select('*').eq('space_id', sid).order('day'), 'rendez-vous'),
    voyages: await lire(db.from('trips').select('*').eq('space_id', sid).order('starts_on'), 'voyages'),
    conversations_avec_kode: await lire(db.from('kode_messages').select('author, body, meta, archived, created_at').eq('space_id', sid).order('created_at'), 'conversations'),
    tenues_ecartees: await lire(db.from('outfit_feedback').select('garment_ids, reason, target_ids, created_at').eq('space_id', sid).order('created_at'), 'tenues écartées'),
    photos_confiees_a_kode: await lire(db.from('ai_jobs').select('id, status, user_input, source_paths, garment_id, created_at, updated_at').eq('space_id', sid).order('created_at'), 'photos confiées'),
    abonnements: await lire(db.from('subscriptions').select('plan, period, status, current_period_end, cancel_at, trial_end, updated_at').eq('space_id', sid), 'abonnements'),
  };

  const path = `${sid}/export-${Date.now().toString(36)}.json`;
  const body = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' });
  const up = await admin.storage.from('exports').upload(path, body, { contentType: 'application/json', upsert: false });
  if (up.error) throw new Error(`dépôt de l'export : ${up.error.message}`);
  const link = await admin.storage.from('exports').createSignedUrl(path, EXPORT_TTL, { download: `dresskode-mes-donnees-${new Date().toISOString().slice(0, 10)}.json` });
  if (link.error || !link.data) throw new Error(`lien de l'export : ${link.error?.message}`);
  return { url: link.data.signedUrl };
}

// ---------------------------------------------------------------- supprimer

/** Les abonnements encore actifs s'arrêtent tout de suite : plus rien ne sera prélevé. */
async function arreterAbonnements(sid: string) {
  const { data: subs, error } = await admin.from('subscriptions').select('id, status').eq('space_id', sid).in('status', [...ENTITLED]);
  if (error) throw new Error(`abonnements : ${error.message}`);
  if (!subs?.length) return;
  const key = secret('STRIPE_SECRET_KEY');
  if (!key) throw new CompteError('Ton abonnement n’a pas pu être arrêté. Réessaie dans un instant, ou arrête-le depuis « Mon offre ».', 503);
  const stripe = new Stripe(key, { apiVersion: '2026-08-26.dahlia', httpClient: Stripe.createFetchHttpClient() });
  for (const s of subs) {
    try {
      await stripe.subscriptions.cancel(s.id);
    } catch (e) {
      // Déjà arrêté chez Stripe : rien à faire.
      if (!(e instanceof Stripe.errors.StripeInvalidRequestError)) throw e;
    }
  }
}

async function supprimer(token: string, input: Record<string, unknown>) {
  if (input.confirmation !== 'SUPPRIMER') throw new CompteError('Confirme la suppression pour continuer.');
  const { user, space } = await openSession(token);
  await arreterAbonnements(space.id);

  // Les fichiers d'abord : une fois le compte parti, plus rien ne les relierait à l'espace.
  const { data: files, error } = await admin.rpc('space_files', { target: space.id });
  if (error) throw new Error(`fichiers de l'espace : ${error.message}`);
  const n = await effacerFichiers(admin as SupabaseClient, (files ?? []) as Fichier[]);

  // Le compte : profil, espace, pièces, tenues, rendez-vous, conversations,
  // accords… tout part en cascade (on delete cascade).
  const gone = await admin.auth.admin.deleteUser(user.id);
  if (gone.error) throw new Error(`suppression du compte : ${gone.error.message}`);
  console.log('[compte] compte supprimé', JSON.stringify({ fichiers: n }));
  return { ok: true };
}

// ---------------------------------------------------------------- entrée

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Connexion nécessaire.' }, { status: 401 });
  const input = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  try {
    if (input.action === 'exporter') return Response.json(await exporter(token));
    if (input.action === 'supprimer') return Response.json(await supprimer(token, input));
    return Response.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (err) {
    if (err instanceof CompteError) return Response.json({ error: err.message }, { status: err.status });
    console.error('[compte]', input.action, err instanceof Error ? err.message : err);
    return Response.json(
      { error: input.action === 'supprimer' ? 'La suppression n’a pas abouti. Réessaie dans un instant.' : 'L’export n’a pas pu être préparé. Réessaie dans un instant.' },
      { status: 500 },
    );
  }
});
