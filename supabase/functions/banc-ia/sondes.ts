/**
 * Les sondes du fournisseur pour Kodi : l'appel le moins cher qui prouve
 * chaque comportement dont le code dépend, avant de construire dessus (13/11).
 *
 *   - sorties structurées et effort, modèle par modèle, et modèle servi ;
 *   - repli sur refus (en-tête bêta et `fallbacks: 'default'`) ;
 *   - cache de consigne avec la vraie demande de Kodi (le deuxième appel doit
 *     lire en cache), par le vrai `askClaude` (kode/claude.ts).
 *
 * Paramètres (`banc_ia.params`), tous facultatifs :
 *   { claude?: ['modele:effort', …], repli?: string[], cache?: string }
 */
import Anthropic from '@anthropic-ai/sdk';
import { anthropicBase, anthropicViaIntermediaire, lireCle } from '../_shared/fournisseurs.ts';
import { askClaude, readJson, servedBy } from '../kode/claude.ts';
import { demandeReponse, type Dossier } from '../kode/demande.ts';
import { ANSWER_SCHEMA } from '../kode/prompt.ts';
import { coutClaude } from './tarifs.ts';
import type { Banc, Rendu } from '../_shared/banc.ts';

type Sonde = { nom: string; ok: boolean; ms: number; detail: string; donnees?: unknown };

const court = (e: unknown) => (e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e)).replace(/\s+/g, ' ').slice(0, 400);

const SCHEMA_MINI = {
  type: 'object', additionalProperties: false, required: ['couleur', 'raison'],
  properties: { couleur: { type: 'string' }, raison: { type: 'string' } },
} as const;

/** Un petit dressing fictif, pour une vraie question de Kodi. */
export function dossierMini(today: string): Dossier {
  const g = (id: string, category_id: string, name: string, kind: string, colors: string[], material: string | null = null) =>
    ({ id, name, category_id, kind, season: null, colors, material, wear_count: 0, last_worn_on: null });
  return {
    today,
    style: { gender: 'femme', styles: ['minimal', 'casual_chic'], colours: ['noir', 'blanc'], avoid: ['jaune'], occasions: ['bureau'], favourite_items: [], goals: [], morning_time: null, time_intent: null, assistance: 'dressing' },
    corps: null,
    coeurs: null,
    labels: new Map([['hauts', 'Hauts'], ['bas', 'Bas'], ['robes', 'Robes'], ['vestes', 'Vestes et manteaux'], ['chaussures', 'Chaussures'], ['sacs', 'Sacs']]),
    wardrobe: [
      g('a', 'hauts', 'Chemise blanche', 'chemise', ['blanc'], 'coton'),
      g('b', 'hauts', 'Pull fin noir', 'pull', ['noir'], 'laine'),
      g('c', 'bas', 'Jean brut', 'jean', ['marine'], 'denim'),
      g('d', 'bas', 'Pantalon marine', 'pantalon', ['marine']),
      g('e', 'vestes', 'Blazer gris', 'blazer', ['gris']),
      g('f', 'chaussures', 'Mocassins noirs', 'mocassins', ['noir'], 'cuir'),
      g('h', 'chaussures', 'Baskets blanches', 'baskets', ['blanc']),
    ],
    agenda: [],
    events: [],
    plannedNames: new Map(),
    turns: [],
    ecarts: [],
  };
}

export async function sondes(b: Banc, p: Record<string, unknown>): Promise<Rendu> {
  const out: Sonde[] = [];
  let cost = 0;
  const essai = async (nom: string, f: () => Promise<{ ok: boolean; detail: string; donnees?: unknown; cout?: number }>) => {
    const t = Date.now();
    try {
      const r = await f();
      cost += r.cout ?? 0;
      out.push({ nom, ok: r.ok, ms: Date.now() - t, detail: r.detail, donnees: r.donnees });
    } catch (e) {
      out.push({ nom, ok: false, ms: Date.now() - t, detail: court(e) });
    }
    b.log(`${nom} : ${out.at(-1)!.ok ? 'ok' : 'ÉCHEC'} (${out.at(-1)!.ms} ms) ${out.at(-1)!.detail.slice(0, 160)}`);
  };

  const cle = lireCle('ANTHROPIC_API_KEY') ?? '';
  const client = new Anthropic({ apiKey: cle, baseURL: anthropicBase(), timeout: 90_000, maxRetries: 0 });

  // 1. Sorties structurées et effort, modèle par modèle.
  const claude = (p.claude as string[] | undefined) ?? ['claude-sonnet-5:low', 'claude-sonnet-5-5:low', 'claude-opus-5:medium', 'claude-opus-5-5:medium', 'claude-haiku-5-5:low'];
  for (const spec of claude) {
    const [model, effort] = spec.split(':') as [string, 'low' | 'medium' | 'high'];
    await essai(`claude_json ${spec}`, async () => {
      const res = await client.messages.create({
        model, max_tokens: 4000,
        messages: [{ role: 'user', content: 'Une couleur de pantalon qui va avec une chemise rose pâle, et pourquoi en dix mots.' }],
        output_config: { effort: effort ?? 'low', format: { type: 'json_schema', schema: SCHEMA_MINI } },
      });
      const text = res.content.map((x) => (x.type === 'text' ? x.text : '')).join('');
      let parsed: unknown = null;
      try { parsed = JSON.parse(text); } catch { /* lu plus bas */ }
      const ok = !!parsed && typeof (parsed as { couleur?: unknown }).couleur === 'string';
      return { ok, detail: `servi ${res.model}, ${res.stop_reason}, ${ok ? 'JSON valide' : `JSON invalide : ${text.slice(0, 120)}`}`, donnees: { usage: res.usage, reponse: parsed }, cout: coutClaude(model, res.usage) };
    });
  }

  // 2. Le repli sur refus : l'en-tête bêta et `fallbacks: 'default'` sont-ils acceptés ?
  for (const model of (p.repli as string[] | undefined) ?? ['claude-opus-5', 'claude-opus-5-5']) {
    await essai(`repli ${model}`, async () => {
      const res = await client.beta.messages.create({
        model, max_tokens: 2000,
        messages: [{ role: 'user', content: 'Réponds avec la couleur « noir » et la raison « sobre ».' }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA_MINI } },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      return { ok: true, detail: `accepté, servi ${res.model}, ${res.stop_reason}`, donnees: { usage: res.usage }, cout: coutClaude(model, res.usage) };
    });
  }

  // 3. Le cache de consigne avec la vraie demande de Kodi : le deuxième appel doit lire en cache.
  const modeleCache = (p.cache as string | undefined) ?? 'claude-opus-5-5';
  await essai(`cache kodi ${modeleCache}`, async () => {
    const d = demandeReponse(dossierMini('2026-11-13'), 'Je mets quoi demain pour le bureau ?', { texte: '', meteo: null }, []);
    const r1 = await askClaude(d.system, d.context, d.turns, ANSWER_SCHEMA, { model: modeleCache, effort: 'low' });
    const r2 = await askClaude(d.system, d.context, d.turns, ANSWER_SCHEMA, { model: modeleCache, effort: 'low' });
    const u1 = r1.usage, u2 = r2.usage;
    const lu = u2.cache_read_input_tokens ?? 0;
    const rep = readJson<{ reponse: string; tenue: { pieces: string[] } }>(r2);
    return {
      ok: lu > 0,
      detail: `1er : ${u1.input_tokens} + écrit ${u1.cache_creation_input_tokens ?? 0} ; 2e : ${u2.input_tokens} + lu ${lu} ; servi ${servedBy(r2)}`,
      donnees: { u1, u2, reponse: rep },
      cout: coutClaude(modeleCache, u1) + coutClaude(modeleCache, u2),
    };
  });

  return {
    result: {
      intermediaire: anthropicViaIntermediaire(),
      sondes: out,
    },
    cost,
  };
}
