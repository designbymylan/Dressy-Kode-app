/**
 * Les sondes du fournisseur : l'appel le moins cher qui prouve chaque
 * comportement dont le code dépend, avant de construire dessus (13/11).
 *
 *   - Claude : sorties structurées et effort, repli sur refus (en-tête bêta
 *     et `fallbacks`), cache de consigne (deuxième appel lu en cache), image
 *     en entrée (le vrai repérage de l'agent), modèle effectivement servi ;
 *   - Gemini : masques de segmentation (la vraie découpe, par modèle et par
 *     réglage de réflexion), génération d'image (`imageConfig`), vecteurs.
 *
 * Paramètres (`banc_ia.params`), tous facultatifs :
 *   { claude?: string[], repli?: string[], cache?: string, photo?: string,
 *     decoupe?: string[], dessin?: string | null, vecteurs?: boolean }
 */
import Anthropic from '@anthropic-ai/sdk';
import { anthropicBase, anthropicViaIntermediaire, geminiViaIntermediaire, lireCle } from '../_shared/fournisseurs.ts';
import { survey, generate, segment, MODELS, type Reflexion } from '../dressy-agent/steps.ts';
import { decode } from '../dressy-agent/codec.ts';
import { vectoriser } from '../_shared/embeddings.ts';
import { askClaude, readJson, servedBy } from '../kode/claude.ts';
import { demandeReponse, type Dossier } from '../kode/demande.ts';
import { ANSWER_SCHEMA } from '../kode/prompt.ts';
import { coutClaude, coutGemini, coutImage } from './tarifs.ts';
import type { Banc, Rendu } from './index.ts';

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

  // 4. Image en entrée : le vrai repérage de l'agent, sur une photo de test.
  const photo = (p.photo as string | undefined) ?? null;
  let cible: Awaited<ReturnType<typeof survey>>['pieces'][number] | null = null;
  let img: { bytes: Uint8Array; mime: string } | null = null;
  if (photo) {
    img = await b.lire(photo);
    await essai(`reperage ${MODELS.survey}`, async () => {
      const r = await survey({ sources: [img!], hint: '', gender: null });
      cible = r.pieces[0] ?? null;
      return {
        ok: r.pieces.length > 0,
        detail: `${r.pieces.length} pièce(s) : ${r.pieces.map((x) => `${x.name} (${x.kind ?? '?'}, ${x.hex?.join('/') ?? ''})`).join(', ')}`,
        donnees: { pieces: r.pieces.map(({ prompt: _p, ...x }) => x), usage: r.usage, octets: img!.bytes.length },
        cout: coutClaude(MODELS.survey, r.usage),
      };
    });
  }

  // 5. Les masques de segmentation, modèle par modèle (« modele:reflexion »).
  if (img && cible) {
    const decoupe = (p.decoupe as string[] | undefined) ?? ['gemini-3.6-flash:minimal', 'gemini-4-hydrogen:minimal', 'gemini-3.5-flash-lite:minimal'];
    for (const spec of decoupe) {
      const [model, reflexion] = spec.split(':') as [string, Reflexion | undefined];
      await essai(`masque ${spec}`, async () => {
        const r = await segment(img!, cible!, { strong: false, model, thinking: reflexion });
        const masques = r.segments.filter((s) => s.mask);
        let taille = '';
        if (masques[0]?.mask) {
          const bytes = Uint8Array.from(atob(masques[0].mask), (c) => c.charCodeAt(0));
          const m = decode(bytes, bytes[0] === 0x89 ? 'image/png' : 'image/jpeg');
          taille = `${m.width}×${m.height}`;
        }
        return {
          ok: masques.length > 0 && !!taille,
          detail: `${r.segments.length} segment(s), ${masques.length} masque(s)${taille ? ` (${taille})` : ''}, réflexion ${r.reflexion}`,
          donnees: { usage: r.usage, cadres: r.segments.map((s) => s.box) },
          cout: coutGemini(r.usage),
        };
      });
    }
  }

  // 6. Une image générée (1K), par le vrai `generate()` : coûte une image.
  const dessin = p.dessin === undefined ? null : (p.dessin as string | null);
  if (dessin && img) {
    await essai(`dessin ${dessin}`, async () => {
      const r = await generate('Reproduce only the garment from this photo, flat lay, centred, on a plain pure white background.', [img!], { model: dessin, size: '1K' });
      const url = await b.ranger(`dessin-${dessin}.${r.mime === 'image/png' ? 'png' : 'jpg'}`, r.bytes, r.mime);
      return { ok: r.bytes.length > 10_000, detail: `${Math.round(r.bytes.length / 1024)} Ko, ${r.mime}`, donnees: { url, usage: r.usage }, cout: coutImage(dessin) };
    });
  }

  // 7. Les vecteurs de la mémoire de Kodi.
  if (p.vecteurs !== false) {
    await essai('vecteurs', async () => {
      const v = await vectoriser(['aime le denim'], 'RETRIEVAL_QUERY', { timeout: 8000 });
      return { ok: !!v, detail: v ? `${v[0].length} dimensions` : 'aucun vecteur (voir les journaux)' };
    });
  }

  return {
    result: {
      intermediaire: { claude: anthropicViaIntermediaire(), gemini: geminiViaIntermediaire() },
      modeles: MODELS,
      sondes: out,
    },
    cost,
  };
}
