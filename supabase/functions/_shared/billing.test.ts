/**
 * node supabase/functions/_shared/billing.test.ts
 *
 * Ce qui décide qui a payé quoi, sans réseau : lecture d'un abonnement
 * Stripe, et accord entre le catalogue affiché (web/src/lib/plans.ts) et
 * celui des Edge Functions.
 */
import { parseLookupKey, subscriptionRow, spaceOf, lookupKey, isPlan, PLAN_IDS, PERIODS, TRIAL_DAYS, type SubscriptionLike } from './billing.ts';
import * as web from '../../../web/src/lib/plans.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` : attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
};

// ---------------------------------------------------------------- clés de prix

check('clé lue', parseLookupKey('dressy_atelier_an'), { plan: 'atelier', period: 'an' });
check('offre inconnue refusée', parseLookupKey('dressy_premium_mois'), null);
check('période inconnue refusée', parseLookupKey('dressy_capsule_semaine'), null);
check('clé étrangère refusée', parseLookupKey('autre_produit'), null);
check('clé absente refusée', parseLookupKey(null), null);
check('« decouverte » n’est pas une offre payante', isPlan('decouverte'), false);

// ---------------------------------------------------------------- abonnement

const T = 1_790_000_000; // secondes
const sub = (over: Partial<SubscriptionLike> = {}, key = 'dressy_capsule_mois'): SubscriptionLike => ({
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  metadata: { space_id: '6f1c2a9e-1111-4222-8333-944455556666' },
  cancel_at: null,
  cancel_at_period_end: false,
  trial_end: null,
  items: { data: [{ current_period_end: T, price: { id: 'price_1', lookup_key: key } }] },
  ...over,
});
const SPACE = '6f1c2a9e-1111-4222-8333-944455556666';

check('abonnement actif', subscriptionRow(sub(), SPACE), {
  id: 'sub_1', space_id: SPACE, stripe_customer_id: 'cus_1', plan: 'capsule', period: 'mois',
  status: 'active', price_id: 'price_1', current_period_end: new Date(T * 1000).toISOString(),
  cancel_at: null, trial_end: null,
});
check('résilié en fin de période : la date de fin est gardée',
  subscriptionRow(sub({ cancel_at_period_end: true }), SPACE)?.cancel_at, new Date(T * 1000).toISOString());
check('date de résiliation explicite prioritaire',
  subscriptionRow(sub({ cancel_at: T + 60, cancel_at_period_end: true }), SPACE)?.cancel_at, new Date((T + 60) * 1000).toISOString());
check('essai annuel',
  subscriptionRow(sub({ status: 'trialing', trial_end: T }, 'dressy_atelier_an'), SPACE)?.trial_end, new Date(T * 1000).toISOString());
check('client développé par Stripe', subscriptionRow(sub({ customer: { id: 'cus_2' } }), SPACE)?.stripe_customer_id, 'cus_2');
check('prix hors Dressy : ignoré', subscriptionRow(sub({}, 'autre'), SPACE), null);
check('le prix Dressy est retrouvé parmi plusieurs articles', subscriptionRow(sub({
  items: { data: [
    { current_period_end: T, price: { id: 'price_x', lookup_key: null } },
    { current_period_end: T, price: { id: 'price_2', lookup_key: 'dressy_couture_an' } },
  ] },
}), SPACE)?.plan, 'couture');

check('espace pris dans l’abonnement', spaceOf(sub(), null), SPACE);
check('espace retrouvé par le client', spaceOf(sub({ metadata: {} }), SPACE), SPACE);
check('identifiant d’espace mal formé refusé', spaceOf(sub({ metadata: { space_id: 'x; drop' } }), null), null);

// ---------------------------------------------------------------- catalogues

check('mêmes offres affichées et vendues', web.PLANS.map((p) => p.id), [...PLAN_IDS]);
check('mêmes clés de prix', web.PLANS.flatMap((p) => PERIODS.map((d) => web.lookupKey(p.id, d))),
  PLAN_IDS.flatMap((p) => PERIODS.map((d) => lookupKey(p, d))));
check('même durée d’essai', web.TRIAL_DAYS, TRIAL_DAYS);
check('prix de la maquette Offres', web.PLANS.map((p) => [web.euros(p.cents.mois), web.euros(p.cents.an), web.perMonth(p)]), [
  ['6,99 €', '59,99 €', 'soit 5,00 € par mois'],
  ['12,99 €', '109,99 €', 'soit 9,17 € par mois'],
  ['24,99 €', '219,99 €', 'soit 18,33 € par mois'],
]);
check('l’annuel coûte toujours moins que douze mois',
  web.PLANS.every((p) => p.cents.an < p.cents.mois * 12), true);

console.log(fails ? `\n${fails} échec(s)` : '\ntout est bon');
if (fails) process.exit(1);
