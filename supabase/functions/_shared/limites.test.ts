/**
 * node supabase/functions/_shared/limites.test.ts
 *
 * Les chiffres du brief v6 (31/10) doivent dire la même chose partout : la
 * base (migration quotas_generation), le site (web/src/lib/plans.ts), l'app
 * (mobile/src/state/store.tsx et screens/Offers.tsx) et les Edge Functions.
 * La base fait foi ; un écran qui s'en écarte annonce une limite fausse.
 */
import { readFileSync } from 'node:fs';
import * as web from '../../../web/src/lib/plans.ts';
import { PLACE_PACKS } from './billing.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` : attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
};

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const sql = read('../../migrations/20261031120000_quotas_generation.sql');
const store = read('../../../mobile/src/state/store.tsx');
const offers = read('../../../mobile/src/screens/Offers.tsx');

/** « case plan when 'capsule' then 50 when 'atelier' then 100 … else 15 » → { capsule: 50, atelier: 100, decouverte: 15 }. */
function caseOf(fn: string, which = 0): Record<string, number> {
  const body = sql.slice(sql.indexOf(`function public.${fn}`));
  const expr = [...body.matchAll(/case plan([^;]*?)end/g)][which][1];
  const out: Record<string, number> = {};
  for (const m of expr.matchAll(/when '(\w+)' then (\d+|null)/g)) out[m[1]] = m[2] === 'null' ? NaN : Number(m[2]);
  const other = /else (\d+)/.exec(expr);
  if (other) out.decouverte = Number(other[1]);
  return out;
}

// Places de garde-robe.
const pieces = caseOf('plan_limits', 0);
check('base : 15 / 50 / 100 places', [pieces.decouverte, pieces.capsule, pieces.atelier], [15, 50, 100]);
check('app : mêmes places que la base',
  ['decouverte', 'capsule', 'atelier'].map((p) => Number(new RegExp(`${p}: \\{ pieces: (\\d+)`).exec(store)?.[1])),
  [15, 50, 100]);

// Générations.
const gens = caseOf('plan_generations');
check('base : 50 générations par mois pour Fashion, 100 pour Sapologue, aucune incluse en Découverte',
  [gens.capsule, gens.atelier, gens.decouverte], [50, 100, 0]);
check('base : 4 générations offertes à vie, dans la fourchette 3 à 5',
  (() => { const n = Number(/free_generation_quota\(\)[\s\S]*?select (\d+);/.exec(sql)?.[1]); return [n, n >= 3 && n <= 5]; })(), [4, true]);
check('site : le texte annonce 50 et 100 générations',
  web.PLANS.map((p) => p.features.some((f) => f.label.includes(`${p.id === 'capsule' ? 50 : 100} générations par mois`))), [true, true]);
check('app : les offres annoncent 4, 50 et 100 générations',
  ['4 générations offertes', '50 générations par mois', '100 générations par mois'].map((t) => offers.includes(t)), [true, true, true]);

// Packs de places : des places, jamais des générations.
check('base : les packs valent 10 et 30 places', /places in \(10, 30\)/.test(sql), true);
check('packs : 10 places à 1,99 € et 30 places à 4,99 €', Object.values(PLACE_PACKS).map((p) => [p.places, p.cents]), [[10, 199], [30, 499]]);
check('app : mêmes packs que le site',
  web.PLACE_PACKS.map((p) => [p.id, p.places, p.cents]).every(([id, places, cents]) =>
    new RegExp(`id: '${id}', places: ${places}, cents: ${cents}`).test(store)), true);
check('un pack ne touche pas aux générations',
  /create table public\.place_packs[\s\S]*?\);/.exec(sql)![0].includes('remaining'), false);

// La limite de la base n'est jamais montrée au client au-delà du compteur restant.
check('le client ne lit jamais la dotation gratuite',
  /grant execute on function public\.free_generation_quota\(\) to service_role/.test(sql)
  && !/grant execute on function public\.free_generation_quota\(\) to authenticated/.test(sql), true);
check('generation_quota et generation_log fermées au client',
  /revoke all on public\.generation_quota from anon, authenticated/.test(sql) && /revoke all on public\.generation_log from anon, authenticated/.test(sql), true);

console.log(fails ? `\n${fails} échec(s)` : '\ntout est bon');
if (fails) process.exit(1);
