/**
 * Les sondes du fournisseur pour Kodi : l'appel le moins cher qui prouve
 * chaque comportement dont le code dépend, avant de construire dessus (13/11).
 *
 * Chaque appel se décrit dans les paramètres, sans redéployer :
 *   { appels: [{ nom?, model, effort?, voie: 'standard' | 'beta' | 'repli' | 'kodi',
 *                consigne?: 'kodi' | 'mini', fois?: 1 | 2 }] }
 *
 *   - `standard` : messages.create, comme l'agent photo ;
 *   - `beta` : beta.messages.create sans en-tête ;
 *   - `repli` : beta.messages.create avec le repli sur refus ;
 *   - `kodi` : le vrai `askClaude` de Kodi (kode/claude.ts).
 * `consigne: 'kodi'` envoie la vraie demande de Kodi (règles, contexte en
 * cache, petit dressing fictif) ; `fois: 2` refait le même appel pour voir
 * le cache lu. Chaque appel dit si le JSON est tenu, le modèle servi, l'usage.
 */
import Anthropic from '@anthropic-ai/sdk';
import { anthropicBase, anthropicViaIntermediaire, lireCle } from '../_shared/fournisseurs.ts';
import { askClaude, servedBy, type Effort, type Reponse } from '../kode/claude.ts';
import { demandeReponse, type Dossier } from '../kode/demande.ts';
import { ANSWER_SCHEMA } from '../kode/prompt.ts';
import { coutClaude } from './tarifs.ts';
import type { Banc, Rendu } from '../_shared/banc.ts';

type Appel = { nom?: string; model: string; effort?: Effort; voie: 'standard' | 'beta' | 'repli' | 'kodi'; consigne?: 'kodi' | 'mini'; fois?: number };

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

const PAR_DEFAUT: Appel[] = [
  { nom: 'standard opus-5-5 kodi', model: 'claude-opus-5-5', voie: 'standard', consigne: 'kodi', fois: 2 },
  { nom: 'beta sans en-tête opus-5-5', model: 'claude-opus-5-5', voie: 'beta', consigne: 'kodi' },
  { nom: 'repli opus-5-5 mini', model: 'claude-opus-5-5', voie: 'repli', consigne: 'mini' },
  { nom: 'repli opus-5 kodi', model: 'claude-opus-5', voie: 'repli', consigne: 'kodi' },
  { nom: 'askClaude opus-5-5', model: 'claude-opus-5-5', voie: 'kodi', consigne: 'kodi', fois: 2 },
  { nom: 'standard sonnet-5-5 kodi low', model: 'claude-sonnet-5-5', effort: 'low', voie: 'standard', consigne: 'kodi' },
];

export async function sondes(b: Banc, p: Record<string, unknown>): Promise<Rendu> {
  const appels = (p.appels as Appel[] | undefined) ?? PAR_DEFAUT;
  const client = new Anthropic({ apiKey: lireCle('ANTHROPIC_API_KEY') ?? '', baseURL: anthropicBase(), timeout: 90_000, maxRetries: 0 });
  const d = demandeReponse(dossierMini('2026-11-13'), 'Je mets quoi demain pour le bureau ?', { texte: '', meteo: null }, []);
  const out: unknown[] = [];
  let cost = 0;

  for (const a of appels) {
    const effort = a.effort ?? 'medium';
    const kodi = (a.consigne ?? 'kodi') === 'kodi';
    const body = kodi
      ? {
        model: a.model, max_tokens: 16000,
        system: [{ type: 'text' as const, text: d.system }, { type: 'text' as const, text: d.context, cache_control: { type: 'ephemeral' as const } }],
        messages: d.turns,
        output_config: { effort, format: { type: 'json_schema' as const, schema: ANSWER_SCHEMA } },
      }
      : {
        model: a.model, max_tokens: 4000,
        messages: [{ role: 'user' as const, content: 'Une couleur de pantalon qui va avec une chemise rose pâle, et pourquoi en dix mots.' }],
        output_config: { effort, format: { type: 'json_schema' as const, schema: SCHEMA_MINI } },
      };
    for (let i = 0; i < (a.fois ?? 1); i++) {
      const t = Date.now();
      const nom = `${a.nom ?? `${a.voie} ${a.model}`}${(a.fois ?? 1) > 1 ? ` #${i + 1}` : ''}`;
      try {
        let res: Reponse;
        if (a.voie === 'standard') res = await client.messages.create(body) as unknown as Reponse;
        else if (a.voie === 'beta') res = await client.beta.messages.create(body) as unknown as Reponse;
        else if (a.voie === 'repli') res = await client.beta.messages.create({ ...body, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }) as unknown as Reponse;
        else res = await askClaude(d.system, d.context, d.turns, ANSWER_SCHEMA, { model: a.model, effort });
        const text = res.content.map((x) => (x.type === 'text' ? x.text ?? '' : '')).join('');
        let json = false;
        try { JSON.parse(text); json = true; } catch { /* noté */ }
        const u = res.usage as unknown as Record<string, number | null>;
        cost += coutClaude(a.model, res.usage);
        out.push({
          nom, ms: Date.now() - t, json, servi: servedBy(res), stop: res.stop_reason,
          entree: u.input_tokens, cache_ecrit: u.cache_creation_input_tokens ?? 0, cache_lu: u.cache_read_input_tokens ?? 0, sortie: u.output_tokens,
          extrait: json ? text.slice(0, 300) : text.slice(0, 200),
        });
      } catch (e) {
        out.push({ nom, ms: Date.now() - t, erreur: court(e) });
      }
      b.log(`${nom} : ${JSON.stringify(out.at(-1)).slice(0, 220)}`);
    }
  }
  return { result: { intermediaire: anthropicViaIntermediaire(), appels: out }, cost };
}
