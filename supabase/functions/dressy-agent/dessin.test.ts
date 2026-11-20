/**
 * deno test -A supabase/functions/dressy-agent/dessin.test.ts
 *
 * La chaîne de relais du dessin (19/11) : un modèle qui pend ou qui tombe ne
 * fait plus échouer la pièce. L'API est simulée.
 */
import { Buffer } from 'node:buffer';
import { dessiner, passager, RELAIS_DESSIN_DEFAUT, modelesDeDessin } from './steps.ts';

Deno.env.set('GEMINI_API_KEY', 'AIza-test');
// Un PNG d'un pixel : seul l'en-tête compte pour reconnaître le format.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64').toString('base64');
const image = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: png, mimeType: 'image/png' } }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
const photo = { bytes: new Uint8Array([0xff, 0xd8, 0xff]), mime: 'image/jpeg' as const };

let aiguille: (url: string, init?: RequestInit) => Response | Promise<Response> = image;
const appels: string[] = [];
globalThis.fetch = ((u: unknown, init?: RequestInit) => {
  appels.push(String(u));
  return Promise.resolve(aiguille(String(u), init));
}) as typeof fetch;

Deno.test('dessin : le modèle de l’offre répond, un seul appel', async () => {
  appels.length = 0;
  aiguille = image;
  const r = await dessiner('Dessine la pièce.', [photo], { model: 'modele-offre' }, 50);
  if (r.model !== 'modele-offre' || appels.length !== 1) throw new Error(`${r.model}, ${appels.length} appel(s)`);
});

Deno.test('dessin : le premier pend, le relais part en parallèle, gagne, et le premier est coupé', async () => {
  appels.length = 0;
  let coupe = false;
  aiguille = (url, init) => url.includes('modele-lent')
    ? new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => { coupe = true; rej(new DOMException('abandon', 'AbortError')); }))
    : image();
  const r = await dessiner('Dessine la pièce.', [photo], { model: 'modele-lent' }, 50);
  if (r.model !== RELAIS_DESSIN_DEFAUT[0]) throw new Error(`gagnant ${r.model}`);
  if (!coupe) throw new Error("le modèle lent n'a pas été coupé");
});

Deno.test('dessin : le premier tombe (503), le relais part aussitôt', async () => {
  appels.length = 0;
  aiguille = (url) => url.includes('modele-offre') ? new Response('{"error":{"code":503}}', { status: 503 }) : image();
  const r = await dessiner('Dessine la pièce.', [photo], { model: 'modele-offre' }, 60_000);
  if (r.model !== RELAIS_DESSIN_DEFAUT[0]) throw new Error(`gagnant ${r.model}`);
});

Deno.test('dessin : toute la chaîne tombe, erreur passagère (la tâche repart en file)', async () => {
  aiguille = () => new Response('{"error":{"code":503}}', { status: 503 });
  let err: unknown;
  try {
    await dessiner('Dessine la pièce.', [photo], { model: 'modele-offre' }, 50);
  } catch (e) { err = e; }
  if (!passager(err)) throw new Error(`erreur non passagère : ${(err as Error)?.message}`);
});

Deno.test('dessin : tous les modèles pendent, la limite coupe tout et rend une erreur passagère', async () => {
  appels.length = 0;
  let coupes = 0;
  aiguille = (_url, init) => new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => { coupes++; rej(new DOMException('abandon', 'AbortError')); }));
  const debut = Date.now();
  let err: unknown;
  try {
    await dessiner('Dessine la pièce.', [photo], { model: 'modele-offre', limite: Date.now() + 1_200 }, 300);
  } catch (e) { err = e; }
  if (!passager(err)) throw new Error(`erreur non passagère : ${(err as Error)?.message}`);
  if (Date.now() - debut > 5_000) throw new Error(`trop long : ${Date.now() - debut} ms`);
  if (coupes < 3) throw new Error(`${coupes} appel(s) coupé(s) sur 3`);
});

Deno.test('dessin : la chaîne commence par le modèle de l’offre, sans doublon', () => {
  const c = modelesDeDessin(RELAIS_DESSIN_DEFAUT[1]);
  if (c[0] !== RELAIS_DESSIN_DEFAUT[1] || new Set(c).size !== c.length || c.length < 3) throw new Error(c.join(', '));
});
