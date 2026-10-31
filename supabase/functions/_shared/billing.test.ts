/**
 * node supabase/functions/_shared/billing.test.ts
 *
 * Ce qui décide qui a payé quoi, sans réseau : lecture d'un abonnement
 * Stripe, et accord entre le catalogue affiché (web/src/lib/plans.ts) et
 * celui des Edge Functions.
 */
import { parseLookupKey, subscriptionRow, spaceOf, lookupKey, isPlan, PLAN_IDS, PERIODS, PLACE_PACKS, type SubscriptionLike } from './billing.ts';
import * as web from '../../../web/src/lib/plans.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` : attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
};

// ---------------------------------------------------------------- clés de prix

check('clé lue', parseLookupKey('dressy_atelier_mois'), { plan: 'atelier', period: 'mois' });
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
check('essai Stripe encore en cours',
  subscriptionRow(sub({ status: 'trialing', trial_end: T }, 'dressy_atelier_mois'), SPACE)?.trial_end, new Date(T * 1000).toISOString());
check('client développé par Stripe', subscriptionRow(sub({ customer: { id: 'cus_2' } }), SPACE)?.stripe_customer_id, 'cus_2');
check('prix hors Dressy : ignoré', subscriptionRow(sub({}, 'autre'), SPACE), null);
check('le prix Dressy est retrouvé parmi plusieurs articles', subscriptionRow(sub({
  items: { data: [
    { current_period_end: T, price: { id: 'price_x', lookup_key: null } },
    { current_period_end: T, price: { id: 'price_2', lookup_key: 'dressy_atelier_mois' } },
  ] },
}), SPACE)?.plan, 'atelier');
check('Couture n’est plus vendue', parseLookupKey('dressy_couture_mois'), null);
check('l’annuel n’est plus vendu', parseLookupKey('dressy_atelier_an'), null);

check('espace pris dans l’abonnement', spaceOf(sub(), null), SPACE);
check('espace retrouvé par le client', spaceOf(sub({ metadata: {} }), SPACE), SPACE);
check('identifiant d’espace mal formé refusé', spaceOf(sub({ metadata: { space_id: 'x; drop' } }), null), null);

// ---------------------------------------------------------------- catalogues

check('mêmes offres affichées et vendues', web.PLANS.map((p) => p.id), [...PLAN_IDS]);
check('mêmes clés de prix', web.PLANS.flatMap((p) => PERIODS.map((d) => web.lookupKey(p.id, d))),
  PLAN_IDS.flatMap((p) => PERIODS.map((d) => lookupKey(p, d))));
check('prix du brief v6 (Fashion 8,99 €, Sapologue 14,99 €, au mois)', web.PLANS.map((p) => [p.name, web.euros(p.cents.mois)]), [
  ['Fashion', '8,99 €'],
  ['Sapologue', '14,99 €'],
]);
check('aucun annuel affiché', web.PLANS.every((p) => !('an' in p.cents)), true);
check('packs de places : mêmes montants affichés et vendus',
  web.PLACE_PACKS.map((p) => [p.id, p.places, p.cents]),
  Object.entries(PLACE_PACKS).map(([id, p]) => [id, p.places, p.cents]));
check('packs de places : 1,99 € et 4,99 €', web.PLACE_PACKS.map((p) => web.euros(p.cents)), ['1,99 €', '4,99 €']);

console.log(fails ? `\n${fails} échec(s)` : '\ntout est bon');
if (fails) process.exit(1);
