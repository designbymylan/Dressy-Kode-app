/**
 * deno test -A supabase/functions/kode/claude.test.ts
 *
 * La lecture de la réponse de Kodi derrière un intermédiaire (17/11) : le format
 * JSON strict est ignoré, la réponse arrive en bloc de code ou entourée de texte.
 */
import { lireJson, readJson, formatDansLaConsigne, KodeError, type Reponse } from './claude.ts';

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
