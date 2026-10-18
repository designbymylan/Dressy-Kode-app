/**
 * Le seul endroit où une offre devient active : Stripe y confirme les
 * paiements et chaque changement d'abonnement.
 *
 * Déployée SANS vérification JWT (Stripe n'a pas de jeton Supabase) : chaque
 * appel est authentifié par sa signature, vérifiée avec STRIPE_WEBHOOK_SECRET.
 * Un appel non signé, ou signé par un autre secret, est rejeté sans être lu.
 *
 * L'abonnement est toujours relu chez Stripe plutôt que pris dans
 * l'événement : les événements peuvent arriver en retard ou dans le
 * désordre, la relecture donne l'état du moment, quel que soit l'ordre.
 */
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { envKey, secret } from '../_shared/env.ts';
import { spaceOf, subscriptionRow } from '../_shared/billing.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const crypto = Stripe.createSubtleCryptoProvider();

const HANDLED = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

async function sync(s: Stripe, subscriptionId: string, spaceHint: string | null) {
  const sub = await s.subscriptions.retrieve(subscriptionId);

  let fallback = spaceHint;
  if (!fallback) {
    const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const { data } = await admin.from('billing_customers').select('space_id').eq('stripe_customer_id', customer).maybeSingle();
    fallback = data?.space_id ?? null;
  }

  const spaceId = spaceOf(sub, fallback);
  if (!spaceId) {
    console.error(`abonnement ${sub.id} : aucun espace Dressy retrouvé, ignoré`);
    return;
  }
  const row = subscriptionRow(sub, spaceId);
  if (!row) {
    console.error(`abonnement ${sub.id} : aucun prix Dressy (lookup_key dressy_…), ignoré`);
    return;
  }

  const { error } = await admin.from('subscriptions').upsert({ ...row, updated_at: new Date().toISOString() });
  if (error) throw new Error(`enregistrement de l'abonnement : ${error.message}`);
  console.log(`abonnement ${sub.id} → ${row.plan}/${row.period}, ${row.status} (${spaceId.slice(0, 8)})`);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });

  const key = secret('STRIPE_SECRET_KEY');
  const signingSecret = secret('STRIPE_WEBHOOK_SECRET');
  if (!key || !signingSecret) {
    console.error('STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET absent des secrets');
    return new Response('Webhook non configuré', { status: 503 }); // Stripe réessaiera
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Signature absente', { status: 400 });

  const s = new Stripe(key, { apiVersion: '2026-08-26.dahlia', httpClient: Stripe.createFetchHttpClient() });
  const body = await req.text(); // le corps brut : la signature porte sur ces octets-là

  let event: Stripe.Event;
  try {
    event = await s.webhooks.constructEventAsync(body, signature, signingSecret, undefined, crypto);
  } catch (err) {
    console.error('signature refusée :', err instanceof Error ? err.message : err);
    return new Response('Signature invalide', { status: 400 });
  }

  if (!HANDLED.has(event.type)) return Response.json({ received: true, ignored: event.type });

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        const id = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        await sync(s, id, session.client_reference_id);
      }
    } else {
      await sync(s, (event.data.object as Stripe.Subscription).id, null);
    }
    return Response.json({ received: true });
  } catch (err) {
    // Une erreur 500 fait réessayer Stripe, avec un délai croissant, pendant trois jours.
    console.error(`${event.type} ${event.id} :`, err instanceof Error ? err.message : err);
    return new Response('Erreur de traitement', { status: 500 });
  }
});
