/**
 * deno test -A supabase/functions/dressy-agent/survey.test.ts
 *
 * Le repérage face à un fournisseur qui ne tient pas les sorties structurées :
 * réponse enrobée, option refusée (400), image perdue. L'API est simulée.
 */
import jpeg from 'jpeg-js';
import { survey } from './steps.ts';

Deno.env.set('ANTHROPIC_API_KEY', 'sk-ant-test');
const piece = { name: 'T-shirt noir', category: 'hauts', kind: 'tshirt', colors: ['noir'], hex: ['#111111'], material: 'coton', where: 'torse', box: { x: 300, y: 200, w: 400, h: 300 }, description: 'Plain black tee.', motif: 'uni', coupe: 'ample', habillage: 2, saison: 'toute_annee', details: '' };
const message = (text: string) => new Response(JSON.stringify({
  id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5', stop_reason: 'end_turn', stop_sequence: null,
  content: [{ type: 'text', text }], usage: { input_tokens: 3000, output_tokens: 200 },
}), { status: 200, headers: { 'content-type': 'application/json' } });

const w = 64, h = 48;
const photo = { bytes: new Uint8Array(jpeg.encode({ data: new Uint8Array(w * h * 4).fill(128), width: w, height: h }, 90).data), mime: 'image/jpeg' };

// Le client du SDK garde le fetch qu'il voit à sa création : un seul faux fetch, aiguillé par test.
let aiguille: (body: Record<string, unknown>) => Response = () => message('');
let corps: Record<string, unknown>[] = [];
globalThis.fetch = ((_u: unknown, init?: RequestInit) => {
  const b = JSON.parse(String(init?.body));
  corps.push(b);
  return Promise.resolve(aiguille(b));
}) as typeof fetch;

async function avec(reponses: (body: Record<string, unknown>, n: number) => Response) {
  corps = [];
  aiguille = (b) => reponses(b, corps.length);
  const r = await survey({ sources: [photo], hint: '', gender: null });
  return { r, corps };
}

Deno.test('réponse enrobée (phrase + bloc json + liste seule) : lue sans second appel', async () => {
  const { r, corps } = await avec(() => message('Voici les pièces repérées :\n```json\n' + JSON.stringify([piece]) + '\n```'));
  if (r.pieces.length !== 1 || corps.length !== 1) throw new Error(`pièces ${r.pieces.length}, appels ${corps.length}`);
});

Deno.test('image perdue : second appel en texte simple, sans output_config, photo en JPEG', async () => {
  const { r, corps } = await avec((_b, n) => n === 1 ? message("Je n'ai pas pu accéder à la photo.") : message(JSON.stringify({ pieces: [piece], note: '' })));
  if (r.pieces.length !== 1 || corps.length !== 2) throw new Error(`pièces ${r.pieces.length}, appels ${corps.length}`);
  if (!('output_config' in corps[0]) || 'output_config' in corps[1]) throw new Error('output_config mal placé');
  const img = (corps[1].messages as { content: { type: string; source?: { media_type: string } }[] }[])[0].content.find((c) => c.type === 'image');
  if (img?.source?.media_type !== 'image/jpeg') throw new Error('photo de reprise absente');
});

Deno.test('option refusée (400) : repli en texte simple', async () => {
  const { r, corps } = await avec((_b, n) => n === 1
    ? new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'output_config: Extra inputs are not permitted' } }), { status: 400, headers: { 'content-type': 'application/json' } })
    : message(JSON.stringify({ pieces: [piece], note: '' })));
  if (r.pieces.length !== 1 || corps.length !== 2) throw new Error(`pièces ${r.pieces.length}, appels ${corps.length}`);
});

Deno.test('clé refusée (401) : pas de repli, message honnête', async () => {
  let err: unknown;
  try {
    await avec(() => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401, headers: { 'content-type': 'application/json' } }));
  } catch (e) { err = e; }
  if (!(err instanceof Error) || !/pas encore prêt/.test(err.message)) throw new Error(`erreur inattendue : ${err}`);
});

Deno.test('deux réponses illisibles : échec avec le détail des deux essais', async () => {
  let err: { detail?: string } | undefined;
  try {
    await avec(() => message('Aucune idée.'));
  } catch (e) { err = e as { detail?: string }; }
  if (!err?.detail?.includes('schema') || !err.detail.includes('texte')) throw new Error(`détail : ${err?.detail}`);
});
