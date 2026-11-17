/**
 * deno test -A supabase/functions/kode/claude.test.ts
 *
 * La lecture de la réponse de Kodi derrière un intermédiaire (17/11) : le format
 * JSON strict est ignoré, la réponse arrive en bloc de code ou entourée de texte.
 */
import { lireJson, readJson, formatDansLaConsigne, askClaude, KodeError, type Reponse } from './claude.ts';

const reponse = (text: string, stop = 'end_turn'): Reponse => ({
  model: 'claude-opus-5', stop_reason: stop, content: [{ type: 'text', text }], usage: {} as Reponse['usage'],
});
const obj = { intention: 'tenue', reponse: 'Tu pourrais porter la chemise blanche.', tenue: { titre: 'Net', pieces: ['p1', 'p2'] } };

Deno.test('JSON brut : lu tel quel', () => {
  if (JSON.stringify(lireJson(JSON.stringify(obj))) !== JSON.stringify(obj)) throw new Error('JSON brut');
});

Deno.test('bloc ```json : lu (le cas constaté chez l’intermédiaire)', () => {
  if (JSON.stringify(readJson(reponse('```json\n' + JSON.stringify(obj, null, 2) + '\n```'))) !== JSON.stringify(obj)) throw new Error('bloc');
});

Deno.test('phrase avant et après : lu', () => {
  if (JSON.stringify(readJson(reponse('Voici ma réponse :\n' + JSON.stringify(obj) + '\nBonne journée !'))) !== JSON.stringify(obj)) throw new Error('phrase');
});

Deno.test('texte sans JSON : erreur honnête, jamais un faux objet', () => {
  for (const t of ['Je ne sais pas.', '[1, 2, 3]', '```json\n{ "reponse": "coupé\n```']) {
    let err: unknown;
    try { readJson(reponse(t)); } catch (e) { err = e; }
    if (!(err instanceof KodeError) || !/incomplète/.test(err.message)) throw new Error(`pas d’erreur pour : ${t}`);
  }
});

Deno.test('refus : message dédié, lu avant le contenu', () => {
  let err: unknown;
  try { readJson(reponse('{}', 'refusal')); } catch (e) { err = e; }
  if (!(err instanceof KodeError) || !/ne peut pas répondre/.test(err.message)) throw new Error('refus');
});

Deno.test('le schéma passe dans la consigne', () => {
  const t = formatDansLaConsigne({ type: 'object', required: ['reponse'] });
  if (!t.includes('FORMAT DE RÉPONSE') || !t.includes('"required":["reponse"]')) throw new Error(t);
});

// ---------------------------------------------------------------- une réponse illisible est redemandée une fois

const message = (text: string) => new Response(JSON.stringify({
  id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5', stop_reason: 'end_turn', stop_sequence: null,
  content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 },
}), { status: 200, headers: { 'content-type': 'application/json' } });

async function avecAppels(reponses: string[]) {
  Deno.env.set('ANTHROPIC_API_KEY', 'sk-test');
  Deno.env.set('ANTHROPIC_BASE_URL', 'https://exemple.test');
  const vus: Record<string, unknown>[] = [];
  const avant = globalThis.fetch;
  globalThis.fetch = ((_u: unknown, init?: RequestInit) => {
    vus.push(JSON.parse(String(init?.body)));
    return Promise.resolve(message(reponses[Math.min(vus.length - 1, reponses.length - 1)]));
  }) as typeof fetch;
  try {
    const res = await askClaude('Consigne.', 'Contexte.', [{ role: 'user', content: 'Salut' }], { type: 'object', required: ['reponse'] });
    return { res, vus };
  } finally {
    globalThis.fetch = avant;
    Deno.env.delete('ANTHROPIC_BASE_URL');
  }
}

Deno.test('JSON invalide puis valide : un second appel, la bonne réponse', async () => {
  const { res, vus } = await avecAppels(['{"reponse":"coupé', '{"reponse":"ok"}']);
  if (vus.length !== 2 || JSON.stringify(readJson(res)) !== '{"reponse":"ok"}') throw new Error(`appels ${vus.length}`);
});

Deno.test('JSON lisible du premier coup : un seul appel, schéma dans la consigne, sans format strict', async () => {
  const { vus } = await avecAppels(['```json\n{"reponse":"ok"}\n```']);
  const corps = vus[0] as { system: { text: string }[]; output_config: Record<string, unknown> };
  if (vus.length !== 1 || !corps.system[0].text.includes('FORMAT DE RÉPONSE') || 'format' in corps.output_config || !corps.output_config.effort) throw new Error(JSON.stringify(corps.output_config));
});

Deno.test('JSON invalide deux fois : deux appels au plus, puis l’erreur honnête', async () => {
  const { res, vus } = await avecAppels(['{"reponse":"coupé']);
  let err: unknown;
  try { readJson(res); } catch (e) { err = e; }
  if (vus.length !== 2 || !(err instanceof KodeError)) throw new Error(`appels ${vus.length}`);
});
