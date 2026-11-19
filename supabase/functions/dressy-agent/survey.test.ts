/**
 * deno test -A supabase/functions/dressy-agent/survey.test.ts
 *
 * Le repérage face à un fournisseur qui ne tient pas les sorties structurées :
 * réponse enrobée, option refusée (400), image perdue. L'API est simulée.
 */
import jpeg from 'jpeg-js';
import { survey, passager, _oublierMode } from './steps.ts';

Deno.env.set('ANTHROPIC_API_KEY', 'sk-ant-test');
// Depuis le 17/11, le repérage est confié à Gemini par défaut : les tests de Claude le demandent.
Deno.env.set('SURVEY_PROVIDER', 'claude');
const piece = { name: 'T-shirt noir', category: 'hauts', kind: 'tshirt', colors: ['noir'], hex: ['#111111'], material: 'coton', where: 'torse', box: { x: 300, y: 200, w: 400, h: 300 }, description: 'Plain black tee.', motif: 'uni', coupe: 'ample', habillage: 2, saison: 'toute_annee', details: '' };
const message = (text: string, lus = 3000) => new Response(JSON.stringify({
  id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5', stop_reason: 'end_turn', stop_sequence: null,
  content: [{ type: 'text', text }], usage: { input_tokens: lus, output_tokens: 200 },
}), { status: 200, headers: { 'content-type': 'application/json' } });
const geminiRepond = (texte: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texte }] } }], usageMetadata: { totalTokenCount: 900 } }), { status: 200, headers: { 'content-type': 'application/json' } });

const w = 64, h = 48;
const photo = { bytes: new Uint8Array(jpeg.encode({ data: new Uint8Array(w * h * 4).fill(128), width: w, height: h }, 90).data), mime: 'image/jpeg' };

// Le client du SDK garde le fetch qu'il voit à sa création : un seul faux fetch, aiguillé par test.
let aiguille: (body: Record<string, unknown>) => Response = () => message('');
let corps: Record<string, unknown>[] = [];
let aiguilleGemini: (body: Record<string, unknown>) => Response = () => geminiRepond('[]');
let corpsGemini: Record<string, unknown>[] = [];
globalThis.fetch = ((u: unknown, init?: RequestInit) => {
  const b = JSON.parse(String(init?.body));
  // Gemini (observation du relais) : même faux fetch, une autre réponse.
  if (String(u).includes(':generateContent')) {
    corpsGemini.push(b);
    return Promise.resolve(aiguilleGemini(b));
  }
  corps.push(b);
  return Promise.resolve(aiguille(b));
}) as typeof fetch;

async function avec(reponses: (body: Record<string, unknown>, n: number) => Response) {
  corps = [];
  _oublierMode();
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
  const fmt = (b: Record<string, unknown>) => (b.output_config as { format?: unknown } | undefined)?.format;
  if (!fmt(corps[0]) || fmt(corps[1]) || (corps[1].output_config as { effort?: string })?.effort !== 'low') throw new Error('format ou effort mal placé');
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

Deno.test('derrière un intermédiaire qui passe les images : on part du mode texte (un seul appel), photo allégée', async () => {
  Deno.env.set('ANTHROPIC_BASE_URL', 'https://exemple.test');
  Deno.env.set('CLAUDE_VOIT_LES_IMAGES', '1');
  try {
    const { r, corps } = await avec(() => message(JSON.stringify({ pieces: [piece], note: '' })));
    if (r.pieces.length !== 1 || corps.length !== 1) throw new Error(`pièces ${r.pieces.length}, appels ${corps.length}`);
    if ((corps[0].output_config as { format?: unknown }).format) throw new Error('le format ne devait pas être envoyé');
  } finally {
    Deno.env.delete('ANTHROPIC_BASE_URL');
    Deno.env.delete('CLAUDE_VOIT_LES_IMAGES');
  }
});

Deno.test('relais : derrière un intermédiaire, Gemini regarde la photo et Claude ne reçoit que du texte', async () => {
  Deno.env.set('ANTHROPIC_BASE_URL', 'https://exemple.test');
  Deno.env.set('GEMINI_API_KEY', 'AIza-test');
  corpsGemini = [];
  aiguilleGemini = () => geminiRepond(JSON.stringify([{ name: 'T-shirt noir', where: 'torse', box_2d: [200, 300, 500, 700], colors: [{ name: 'noir', hex: '#111111' }] }]));
  try {
    const { r, corps } = await avec(() => message(JSON.stringify({ pieces: [piece], note: '' })));
    if (r.pieces.length !== 1) throw new Error(`pièces ${r.pieces.length}`);
    if (corpsGemini.length !== 1) throw new Error(`appels Gemini ${corpsGemini.length}`);
    const partiesGemini = ((corpsGemini[0].contents as { parts: { inline_data?: unknown }[] }[])[0]).parts;
    if (!partiesGemini.some((p) => p.inline_data)) throw new Error("Gemini n'a pas reçu la photo");
    const contenu = (corps[0].messages as { content: { type: string; text?: string }[] }[])[0].content;
    if (contenu.some((c) => c.type === 'image')) throw new Error('Claude ne devait recevoir aucune image');
    if (!contenu[0].text?.includes('T-shirt noir')) throw new Error("les observations n'arrivent pas à Claude");
    if (!/relais/.test(String(corps[0].system))) throw new Error('la consigne du relais manque');
  } finally {
    Deno.env.delete('ANTHROPIC_BASE_URL');
    Deno.env.delete('GEMINI_API_KEY');
  }
});

Deno.test('relais : sans clé Google, message honnête et aucun appel à Claude', async () => {
  Deno.env.set('ANTHROPIC_BASE_URL', 'https://exemple.test');
  Deno.env.delete('GEMINI_API_KEY');
  Deno.env.delete('GOOGLE_API_KEY');
  let err: unknown;
  try {
    await avec(() => message(JSON.stringify({ pieces: [piece], note: '' })));
  } catch (e) { err = e; } finally {
    Deno.env.delete('ANTHROPIC_BASE_URL');
  }
  if (!(err instanceof Error) || !/pas encore prêt/.test(err.message)) throw new Error(`erreur inattendue : ${err}`);
});

Deno.test("image lue comme du texte : plus de « 0 pièce » trompeur, une erreur claire", async () => {
  let err: { message?: string; detail?: string } | undefined;
  try {
    await avec(() => message(JSON.stringify({ pieces: [], note: 'Aucune photo.' }), 38_468));
  } catch (e) { err = e as { message?: string; detail?: string }; }
  if (!/pas encore prêt/.test(err?.message ?? '') || !/38468 jetons/.test(err?.detail ?? '')) throw new Error(`erreur inattendue : ${err?.message} / ${err?.detail}`);
});

Deno.test('le mode qui a marché est gardé : la photo suivante ne rejoue pas le mode raté', async () => {
  corps = [];
  _oublierMode();
  aiguille = (_b) => corps.length === 1 ? message("Je n'ai pas pu accéder à la photo.") : message(JSON.stringify({ pieces: [piece], note: '' }));
  await survey({ sources: [photo], hint: '', gender: null });
  const avant = corps.length; // 2 appels : schema raté, texte réussi
  await survey({ sources: [photo], hint: '', gender: null });
  if (avant !== 2 || corps.length !== 3) throw new Error(`appels ${avant} puis ${corps.length}`);
});

Deno.test('intermédiaire qui refuse même l\'effort (400) : dernier cran sans aucune option', async () => {
  const { r, corps } = await avec((b) => b.output_config
    ? new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'output_config not allowed' } }), { status: 400, headers: { 'content-type': 'application/json' } })
    : message(JSON.stringify({ pieces: [piece], note: '' })));
  if (r.pieces.length !== 1 || corps.length !== 3 || 'output_config' in corps[2]) throw new Error(`appels ${corps.length}`);
});

// ---------------------------------------------------------------- repérage par Gemini seul (17/11)

async function avecGemini(reponses: (n: number) => Response) {
  Deno.env.delete('SURVEY_PROVIDER');
  Deno.env.set('GEMINI_API_KEY', 'AIza-test');
  corps = [];
  corpsGemini = [];
  aiguilleGemini = () => reponses(corpsGemini.length);
  try {
    return { r: await survey({ sources: [photo], hint: '', gender: null }), corps, corpsGemini };
  } finally {
    Deno.env.set('SURVEY_PROVIDER', 'claude');
    Deno.env.delete('GEMINI_API_KEY');
  }
}

Deno.test('Gemini seul (défaut) : un seul appel, la photo et le schéma, aucun appel à Claude', async () => {
  const { r, corps, corpsGemini } = await avecGemini(() => geminiRepond(JSON.stringify({ pieces: [piece], note: '' })));
  if (r.pieces.length !== 1 || corpsGemini.length !== 1 || corps.length !== 0) throw new Error(`pièces ${r.pieces.length}, Gemini ${corpsGemini.length}, Claude ${corps.length}`);
  if (r.fournisseur !== 'google') throw new Error(`fournisseur ${r.fournisseur}`);
  const parts = (corpsGemini[0].contents as { parts: { inline_data?: unknown }[] }[])[0].parts;
  if (!parts.some((p) => p.inline_data)) throw new Error("Gemini n'a pas reçu la photo");
  const systeme = JSON.stringify(corpsGemini[0].systemInstruction);
  if (!systeme.includes('Règles de repérage') || !systeme.includes('FORMAT DE RÉPONSE')) throw new Error('consigne ou schéma manquants');
  if (typeof (r.usage as { input_tokens?: unknown }).input_tokens !== 'number') throw new Error('jetons non normalisés');
});

Deno.test('Gemini seul : réponse illisible, redemandée une fois', async () => {
  const { r, corpsGemini } = await avecGemini((n) => n === 1 ? geminiRepond('Je ne sais pas.') : geminiRepond('```json\n' + JSON.stringify([piece]) + '\n```'));
  if (r.pieces.length !== 1 || corpsGemini.length !== 2) throw new Error(`pièces ${r.pieces.length}, appels ${corpsGemini.length}`);
});

Deno.test('Gemini seul : deux réponses illisibles, échec honnête', async () => {
  let err: { message?: string; detail?: string } | undefined;
  try {
    await avecGemini(() => geminiRepond('Aucune idée.'));
  } catch (e) { err = e as { message?: string; detail?: string }; }
  if (!/pas pu finir/.test(err?.message ?? '') || !/illisible/.test(err?.detail ?? '')) throw new Error(`erreur inattendue : ${err?.message} / ${err?.detail}`);
});

Deno.test('Gemini seul : le modèle de repérage ne répond pas (503), le secours prend le relais', async () => {
  const { r, corpsGemini } = await avecGemini((n) => n === 1
    ? new Response('{"error":{"code":503,"message":"overloaded"}}', { status: 503 })
    : geminiRepond(JSON.stringify({ pieces: [piece], note: '' })));
  if (r.pieces.length !== 1 || corpsGemini.length !== 2) throw new Error(`pièces ${r.pieces.length}, appels ${corpsGemini.length}`);
  if (r.modele !== 'gemini-3.6-flash') throw new Error(`modèle du secours : ${r.modele}`);
});

Deno.test('Gemini seul : panne qui dure, erreur marquée passagère (la tâche repart en file)', async () => {
  let err: unknown;
  try {
    await avecGemini(() => new Response('{"error":{"code":503}}', { status: 503 }));
  } catch (e) { err = e; }
  if (!passager(err)) throw new Error(`erreur non passagère : ${(err as Error)?.message}`);
});
