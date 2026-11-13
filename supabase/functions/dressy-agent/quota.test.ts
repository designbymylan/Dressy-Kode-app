/**
 * node supabase/functions/dressy-agent/quota.test.ts
 *
 * Les règles de génération du brief v6, sans réseau : on branche de faux
 * ports et on compte ce qui est appelé et décompté.
 */
import { cacheKey, drawWithQuota, imageSettings, price, tokenCost, type Ports, type Status } from './quota.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` : attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
};

/** Un compteur et un générateur factices ; `remaining` suit la règle de la base. */
function world(opts: { remaining: number; cached?: string; fail?: 'panne' | 'refus' }) {
  const w = {
    remaining: opts.remaining,
    cache: new Map<string, string>(opts.cached ? [['k', opts.cached]] : []),
    apiCalls: 0,
    settled: [] as Status[],
    cacheHits: 0,
  };
  const ports: Ports<string> = {
    cacheGet: async (k) => w.cache.get(k) ?? null,
    cachePut: async (k, v) => void w.cache.set(k, v),
    reserve: async () => {
      if (w.remaining <= 0) return { ok: false, plan: 'decouverte' };
      w.remaining--;
      return { ok: true, logId: 'log1', plan: 'decouverte' };
    },
    settle: async (_id, status) => {
      w.settled.push(status);
      if (status !== 'succes') w.remaining++; // rendue
    },
    noteCacheHit: async () => void w.cacheHits++,
    call: async () => {
      w.apiCalls++;
      if (opts.fail === 'refus') throw new Error('bloqué');
      if (opts.fail === 'panne') throw new Error('réseau');
      return 'image';
    },
    isRejection: (e) => e instanceof Error && e.message === 'bloqué',
    cost: () => 0.05,
  };
  return { w, ports };
}

// Une génération réussie décompte une fois.
{
  const { w, ports } = world({ remaining: 4 });
  const r = await drawWithQuota('k', ports, 'decouverte');
  check('réussite : une génération décomptée', [r.kind, w.remaining, w.apiCalls, w.settled], ['drawn', 3, 1, ['succes']]);
  check('réussite : l’image est mise en cache', w.cache.get('k'), 'image');
}

// Une génération échouée ne décrémente pas le compteur.
{
  const { w, ports } = world({ remaining: 4, fail: 'panne' });
  let thrown = false;
  await drawWithQuota('k', ports, 'decouverte').catch(() => (thrown = true));
  check('échec : le compteur est rendu', [thrown, w.remaining, w.settled], [true, 4, ['echec']]);
  check('échec : une seule tentative, aucune relance', w.apiCalls, 1);
  check('échec : rien n’est mis en cache', w.cache.size, 0);
}

// Une génération rejetée ne décrémente pas non plus.
{
  const { w, ports } = world({ remaining: 4, fail: 'refus' });
  await drawWithQuota('k', ports, 'decouverte').catch(() => undefined);
  check('rejet : le compteur est rendu, statut rejet', [w.remaining, w.settled, w.apiCalls], [4, ['rejet'], 1]);
}

// Un cache hit ne décrémente pas et n'appelle pas l'API.
{
  const { w, ports } = world({ remaining: 4, cached: 'deja-la' });
  const r = await drawWithQuota('k', ports, 'decouverte');
  check('cache : image rendue', r.kind === 'cache' ? r.image : null, 'deja-la');
  check('cache : aucun appel, aucun décompte', [w.apiCalls, w.remaining, w.settled.length], [0, 4, 0]);
  check('cache : l’appel est noté comme cache hit', w.cacheHits, 1);
}

// Un cache hit sert même quand le quota est à 0.
{
  const { w, ports } = world({ remaining: 0, cached: 'deja-la' });
  const r = await drawWithQuota('k', ports, 'decouverte');
  check('cache à quota 0 : image rendue quand même', [r.kind, w.apiCalls], ['cache', 0]);
}

// Quota à 0 : l'écran d'abonnement, sans appel API.
{
  const { w, ports } = world({ remaining: 0 });
  const r = await drawWithQuota('k', ports, 'decouverte');
  check('quota à 0 : aucune API appelée', [r.kind, w.apiCalls, w.settled.length], ['empty', 0, 0]);
}

// La dernière génération passe, la suivante non.
{
  const { w, ports } = world({ remaining: 1 });
  const a = await drawWithQuota('k1', ports, 'decouverte');
  w.cache.clear();
  const b = await drawWithQuota('k2', ports, 'decouverte');
  check('4 gratuites : la dernière passe, la suivante est refusée', [a.kind, b.kind, w.remaining], ['drawn', 'empty', 0]);
}

// Modèle et taille selon l'offre.
const models = { free: 'lite', paid: 'complet' };
check('gratuit : modèle Lite en 1K', imageSettings('decouverte', models), { model: 'lite', size: '1K' });
check('Fashion : modèle complet en 2K', imageSettings('capsule', models), { model: 'complet', size: '2K' });
check('Sapologue : modèle complet en 2K', imageSettings('atelier', models), { model: 'complet', size: '2K' });

// Clé de cache.
check('clé : photo, pièce, modèle, version', cacheKey({ photoHash: 'p', pieceHash: 'q', model: 'm' }), 'p:q:m:dessin-2');
check('clé : un autre modèle ne réutilise pas l’image',
  cacheKey({ photoHash: 'p', pieceHash: 'q', model: 'lite' }) === cacheKey({ photoHash: 'p', pieceHash: 'q', model: 'complet' }), false);
check('clé : une autre version de la consigne ne réutilise pas l’image',
  cacheKey({ photoHash: 'p', pieceHash: 'q', model: 'm', promptVersion: 'dessin-1' }) === cacheKey({ photoHash: 'p', pieceHash: 'q', model: 'm' }), false);

// Coûts.
check('prix illisible : repli', price('abc', 0.04), 0.04);
check('prix lu', price('0.1', 0.04), 0.1);
check('coût des jetons', tokenCost(1_000_000, 100_000, { in: 3, out: 15 }), 4.5);

console.log(fails ? `\n${fails} échec(s)` : '\ntout est bon');
if (fails) process.exit(1);
