/**
 * Prépare un compte Stripe pour Dressy, en une commande et sans rien casser
 * si on la relance :
 *
 *   STRIPE_SECRET_KEY=sk_test_… APP_URL=https://… node tools/stripe-setup.mjs
 *
 *   1. les trois produits (Capsule, Atelier, Couture) ;
 *   2. leurs six prix, retrouvés par lookup_key (dressy_<offre>_<mois|an>) :
 *      un montant changé dans web/src/lib/plans.ts crée un nouveau prix, qui
 *      reprend la clé ; les abonnés en cours gardent l'ancien ;
 *   3. le portail client (changer d'offre, résilier, factures, carte) ;
 *   4. le webhook vers l'Edge Function stripe-webhook, dont le secret
 *      n'est affiché qu'à sa création.
 *
 * Une clé live (sk_live_…) est refusée sans --live : on règle tout en mode
 * test d'abord, on refait la même commande en live le jour du lancement.
 */
import { PLANS, lookupKey } from '../web/src/lib/plans.ts';

const API = process.env.STRIPE_API_BASE ?? 'https://api.stripe.com';
const API_VERSION = '2026-08-26.dahlia'; // la même que les Edge Functions
const KEY = process.env.STRIPE_SECRET_KEY?.trim();
const APP_URL = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const SUPABASE_URL = (process.env.SUPABASE_URL ?? 'https://pxjlbtevrexlckhxskdn.supabase.co').replace(/\/+$/, '');
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`;
const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

if (!KEY) {
  console.error('Il manque la clé secrète : STRIPE_SECRET_KEY=sk_test_… node tools/stripe-setup.mjs');
  process.exit(1);
}
const LIVE = /^(sk|rk)_live_/.test(KEY);
if (LIVE && !process.argv.includes('--live')) {
  console.error('Clé live détectée. Règle tout en mode test d’abord ; relance avec --live le jour du lancement.');
  process.exit(1);
}

// ---------------------------------------------------------------- API

/** Encode un objet à la manière de Stripe : a[b][0]=c. */
function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => (typeof item === 'object' ? form(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    } else if (typeof v === 'object') {
      form(v, key, out);
    } else {
      out.append(key, String(v));
    }
  }
  return out;
}

async function api(method, path, body) {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${KEY}`,
      'stripe-version': API_VERSION,
      ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: body ? form(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status} : ${json.error?.message ?? 'erreur Stripe'}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

const INTERVAL = { mois: 'month', an: 'year' };
const euro = (cents) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;

// ---------------------------------------------------------------- 1. produits

async function product(plan) {
  const id = `dressy_${plan.id}`;
  try {
    const existing = await api('GET', `/products/${id}`);
    if (!existing.active) await api('POST', `/products/${id}`, { active: true });
    console.log(`  produit ${id} : déjà là`);
    return id;
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  await api('POST', '/products', {
    id,
    name: `Dressy ${plan.name}`,
    description: plan.note,
    metadata: { plan: plan.id },
  });
  console.log(`  produit ${id} : créé`);
  return id;
}

// ---------------------------------------------------------------- 2. prix

async function prices(products) {
  const keys = PLANS.flatMap((p) => ['mois', 'an'].map((period) => lookupKey(p.id, period)));
  const query = keys.map((k) => `lookup_keys[]=${encodeURIComponent(k)}`).join('&');
  const { data: existing } = await api('GET', `/prices?${query}&active=true&limit=100`);
  const byKey = new Map(existing.map((p) => [p.lookup_key, p]));
  const ids = new Map();

  for (const plan of PLANS) {
    for (const period of ['mois', 'an']) {
      const key = lookupKey(plan.id, period);
      const cents = plan.cents[period];
      const current = byKey.get(key);
      if (current && current.unit_amount === cents && current.currency === 'eur' && current.recurring?.interval === INTERVAL[period]) {
        console.log(`  prix ${key} : ${euro(cents)}, déjà là`);
        ids.set(key, current.id);
        continue;
      }
      const created = await api('POST', '/prices', {
        product: products.get(plan.id),
        currency: 'eur',
        unit_amount: cents,
        recurring: { interval: INTERVAL[period] },
        tax_behavior: 'inclusive', // prix affichés TTC
        lookup_key: key,
        transfer_lookup_key: current ? true : undefined,
        nickname: `${plan.name} ${period === 'an' ? 'annuel' : 'mensuel'}`,
        metadata: { plan: plan.id, period },
      });
      if (current) await api('POST', `/prices/${current.id}`, { active: false });
      console.log(`  prix ${key} : ${euro(cents)}, ${current ? `remplace ${euro(current.unit_amount)}` : 'créé'}`);
      ids.set(key, created.id);
    }
  }
  return ids;
}

// ---------------------------------------------------------------- 3. portail

async function portal(products, priceIds) {
  const settings = {
    business_profile: { headline: 'Dressy : ton abonnement' },
    default_return_url: APP_URL.startsWith('https://') ? `${APP_URL}/moi` : undefined,
    features: {
      customer_update: { enabled: true, allowed_updates: ['email'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end', // l'offre reste active jusqu'au bout de ce qui est payé
        cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'unused', 'other'] },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: PLANS.map((p) => ({
          product: products.get(p.id),
          prices: ['mois', 'an'].map((period) => priceIds.get(lookupKey(p.id, period))),
        })),
      },
    },
    metadata: { dressy: '1' }, // l'Edge Function billing retrouve ce portail par ce repère
  };

  const { data } = await api('GET', '/billing_portal/configurations?limit=100');
  const mine = data.find((c) => c.metadata?.dressy === '1');
  if (mine) {
    await api('POST', `/billing_portal/configurations/${mine.id}`, settings);
    console.log(`  portail ${mine.id} : mis à jour`);
  } else {
    const created = await api('POST', '/billing_portal/configurations', settings);
    console.log(`  portail ${created.id} : créé`);
  }
}

// ---------------------------------------------------------------- 4. webhook

async function webhook() {
  const { data } = await api('GET', '/webhook_endpoints?limit=100');
  const mine = data.find((w) => w.url === WEBHOOK_URL);
  if (mine) {
    const missing = EVENTS.filter((e) => !mine.enabled_events.includes(e) && !mine.enabled_events.includes('*'));
    if (missing.length) await api('POST', `/webhook_endpoints/${mine.id}`, { enabled_events: EVENTS });
    console.log(`  webhook ${mine.id} : déjà là${missing.length ? ', événements complétés' : ''}`);
    console.log('  (son secret ne se relit pas : s’il est perdu, fais-le tourner dans le tableau de bord Stripe)');
    return null;
  }
  const created = await api('POST', '/webhook_endpoints', {
    url: WEBHOOK_URL,
    enabled_events: EVENTS,
    api_version: API_VERSION,
    description: 'Dressy : abonnements vers Supabase',
  });
  console.log(`  webhook ${created.id} : créé → ${WEBHOOK_URL}`);
  return created.secret;
}

// ---------------------------------------------------------------- passage

console.log(`Stripe, mode ${LIVE ? 'LIVE' : 'test'}\n`);

console.log('1. Produits');
const products = new Map();
for (const plan of PLANS) products.set(plan.id, await product(plan));

console.log('\n2. Prix');
const priceIds = await prices(products);

console.log('\n3. Portail client');
await portal(products, priceIds);

console.log('\n4. Webhook');
const signing = await webhook();

console.log('\nIl reste à donner les clés aux Edge Functions (jamais dans le dépôt) :\n');
console.log(`  supabase secrets set STRIPE_SECRET_KEY=<ta clé ${LIVE ? 'live' : 'test'}> APP_URL=${APP_URL}${signing ? ` STRIPE_WEBHOOK_SECRET=${signing}` : ''}`);
if (!signing) console.log('  (STRIPE_WEBHOOK_SECRET est déjà réglé si le webhook existait)');
