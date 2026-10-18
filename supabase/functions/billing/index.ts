/**
 * Abonnements : ouvre le paiement Stripe ou le portail client.
 *
 *   POST { action: 'checkout', plan, period }  →  { url }
 *   POST { action: 'portal' }                  →  { url }
 *   GET                                        →  état de la configuration
 *
 * Déployée AVEC vérification JWT. Rien n'est accordé ici : l'offre ne
 * devient active que lorsque Stripe confirme le paiement, par le webhook
 * (stripe-webhook). Cette fonction ne fait qu'ouvrir des pages Stripe.
 */
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { envKey, secret, appUrl } from '../_shared/env.ts';
import { ENTITLED, TRIAL_DAYS, isPeriod, isPlan, lookupKey } from '../_shared/billing.ts';

class BillingError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const PUBLIC_KEY = envKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
const admin = createClient(SUPABASE_URL, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function stripe(): Stripe {
  const key = secret('STRIPE_SECRET_KEY');
  if (!key) {
    // Le détail va dans les journaux ; la personne lit un message qu'elle peut comprendre.
    console.error('STRIPE_SECRET_KEY absent des secrets Supabase');
    throw new BillingError('Le paiement n’est pas encore ouvert. Réessaie un peu plus tard.', 503);
  }
  return new Stripe(key, { apiVersion: '2026-08-26.dahlia', httpClient: Stripe.createFetchHttpClient() });
}

// ---------------------------------------------------------------- client Stripe

/**
 * Le client Stripe de l'espace, créé au premier passage. La clé
 * d'idempotence évite d'en créer deux si deux paiements partent en même temps.
 */
async function customerFor(s: Stripe, spaceId: string, email: string | undefined): Promise<string> {
  const { data: known } = await admin.from('billing_customers').select('stripe_customer_id').eq('space_id', spaceId).maybeSingle();
  if (known) return known.stripe_customer_id;

  const customer = await s.customers.create(
    { email, metadata: { space_id: spaceId } },
    { idempotencyKey: `dressy-customer-${spaceId}` },
  );
  const { error } = await admin.from('billing_customers')
    .upsert({ space_id: spaceId, stripe_customer_id: customer.id }, { onConflict: 'space_id', ignoreDuplicates: true });
  if (error) throw new Error(`enregistrement du client : ${error.message}`);

  const { data: saved } = await admin.from('billing_customers').select('stripe_customer_id').eq('space_id', spaceId).single();
  return saved!.stripe_customer_id;
}

/** La configuration du portail posée par tools/stripe-setup.mjs, sinon celle par défaut du compte. */
let portalConfig: string | null | undefined;
async function portalConfiguration(s: Stripe): Promise<string | undefined> {
  if (portalConfig === undefined) {
    const list = await s.billingPortal.configurations.list({ active: true, limit: 20 });
    portalConfig = list.data.find((c) => c.metadata?.dressy === '1')?.id ?? null;
  }
  return portalConfig ?? undefined;
}

async function portal(s: Stripe, customer: string): Promise<string> {
  const session = await s.billingPortal.sessions.create({
    customer,
    return_url: `${appUrl()}/moi`,
    configuration: await portalConfiguration(s),
    locale: 'fr',
  });
  return session.url;
}

// ---------------------------------------------------------------- actions

async function handle(token: string, input: Record<string, unknown>): Promise<{ url: string }> {
  const db = createClient(SUPABASE_URL, PUBLIC_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) throw new BillingError('Session expirée. Reconnecte-toi.', 401);

  // L'espace vient de la RLS avec le jeton de la personne, jamais de la requête.
  const { data: space } = await db.from('spaces').select('id').limit(1).maybeSingle();
  if (!space) throw new BillingError('Espace introuvable.', 404);

  const s = stripe();

  if (input.action === 'portal') {
    const { data: known } = await db.from('billing_customers').select('stripe_customer_id').eq('space_id', space.id).maybeSingle();
    if (!known) throw new BillingError('Aucun abonnement à gérer pour le moment.', 404);
    return { url: await portal(s, known.stripe_customer_id) };
  }

  if (input.action !== 'checkout') throw new BillingError('Action inconnue.');
  if (!isPlan(input.plan) || !isPeriod(input.period)) throw new BillingError('Offre inconnue.');

  const customer = await customerFor(s, space.id, user.email);

  // Lu chez Stripe et non en base : le webhook peut avoir quelques secondes
  // de retard, et un double clic ne doit jamais créer deux abonnements.
  const { data: subs } = await s.subscriptions.list({ customer, status: 'all', limit: 20 });

  // Déjà abonné : le changement d'offre passe par le portail, qui gère le prorata.
  if (subs.some((x) => (ENTITLED as readonly string[]).includes(x.status))) {
    return { url: await portal(s, customer) };
  }

  const key = lookupKey(input.plan, input.period);
  const { data: prices } = await s.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  if (!prices.length) {
    console.error(`prix ${key} introuvable chez Stripe : lancer tools/stripe-setup.mjs`);
    throw new BillingError('Cette offre n’est pas encore en vente. Réessaie un peu plus tard.', 503);
  }

  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: space.id,
    line_items: [{ price: prices[0].id, quantity: 1 }],
    subscription_data: {
      metadata: { space_id: space.id },
      // Le mois offert de l'annuel, une seule fois : pas à qui a déjà été abonné.
      ...(input.period === 'an' && !subs.length ? { trial_period_days: TRIAL_DAYS } : {}),
    },
    allow_promotion_codes: true,
    locale: 'fr',
    success_url: `${appUrl()}/moi?abonnement=merci`,
    cancel_url: `${appUrl()}/offres`,
  });
  if (!session.url) throw new Error('Stripe n’a pas rendu de page de paiement.');
  return { url: session.url };
}

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    const key = secret('STRIPE_SECRET_KEY') ?? '';
    return Response.json({
      billing: true,
      cle: key ? (key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : 'test') : 'absente',
      webhook: Boolean(secret('STRIPE_WEBHOOK_SECRET')),
      app_url: appUrl(),
    });
  }
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Connexion nécessaire.' }, { status: 401 });

  try {
    const input = await req.json().catch(() => ({}));
    return Response.json(await handle(token, input ?? {}));
  } catch (err) {
    if (err instanceof BillingError) return Response.json({ error: err.message }, { status: err.status });
    if (err instanceof Stripe.errors.StripeAuthenticationError) {
      console.error('Stripe refuse la clé :', err.message);
      return Response.json({ error: 'Le paiement est indisponible : la clé Stripe est refusée.' }, { status: 503 });
    }
    console.error('billing :', err instanceof Error ? err.message : err);
    return Response.json({ error: 'Le paiement n’a pas pu s’ouvrir. Réessaie dans un instant.' }, { status: 500 });
  }
});
