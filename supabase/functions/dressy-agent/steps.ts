/**
 * Les modèles que l'agent fait travailler. Chaque fonction ne fait qu'un
 * appel et rend un résultat propre ; l'enchaînement est dans index.ts.
 *
 *   Sonnet 5.5 (MODELS.prompts) : repère les pièces d'une photo et écrit la
 *     consigne de chacune ; réécrit la consigne après un essai refusé.
 *   Sonnet 5.5 + recherche web : retrouve le modèle exact d'une pièce de marque
 *     et en tire les détails de design (bandes, semelle, logo).
 *   Nano Banana (MODELS.gemini) : dessine la pièce seule, sur fond uni ; pour
 *     un modèle identifié, il regarde aussi ses photos (recherche Google).
 *   Sonnet 5.5 (MODELS.judge) : contrôle qualité et choix entre images.
 *
 * Ni Opus ni Fable ici : leur coût ne se justifie pas à chaque pièce.
 *
 * Rien de ce fichier n'est montré tel quel : un AgentError porte un message
 * écrit pour la personne (qui ne nomme jamais les modèles) et un détail
 * technique qui ne va que dans les journaux.
 */
import { Buffer } from 'node:buffer';
import Anthropic, { APIError, APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import {
  MAX_PIECES, cleanTarget,
  INVENTORY_SYSTEM, INVENTORY_SCHEMA, inventoryUserText,
  REFINE_SYSTEM, REFINE_SCHEMA, refineUserText,
  RESEARCH_SYSTEM, researchUserText, parseResearch,
  JUDGE_SYSTEM, VERDICT_SCHEMA, judgeText,
  PICK_SYSTEM, PICK_SCHEMA,
  type Previous, type Reference, type Target,
} from './prompts.ts';
import { normaliseVerdict, type Verdict } from './decide.ts';
import { sniffMime } from './codec.ts';

export type Img = { bytes: Uint8Array; mime: string };
export type Usage = Record<string, unknown> | null;
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Erreur dont `message` peut être montré dans le dressing ; `detail` reste dans les journaux. */
export class AgentError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
  }
}

/** Les messages que la personne peut lire. Aucun ne nomme un modèle ni un fournisseur. */
export const SAY = {
  notReady: "Kodi n'est pas encore prêt à dessiner tes pièces. Réessaie un peu plus tard.",
  busy: 'Kodi est très demandé en ce moment. Réessaie dans quelques minutes.',
  failed: "Kodi n'a pas pu finir cette pièce. Réessaie dans un moment.",
  refused: "Kodi n'a pas pu dessiner cette pièce. Essaie avec une autre photo.",
  nothing: "Kodi n'a trouvé aucune pièce à ranger sur cette photo. Essaie avec une photo où elle se voit en entier.",
  photo: 'Kodi ne retrouve plus ta photo. Confie-la de nouveau.',
} as const;

const env = (name: string) => Deno.env.get(name)?.trim() || undefined;
const effort = (name: string, fallback: Effort): Effort => {
  const v = env(name);
  return v && ['low', 'medium', 'high', 'xhigh', 'max'].includes(v) ? v as Effort : fallback;
};

/**
 * Un modèle lu dans les secrets doit appartenir à une famille permise ; sinon
 * le défaut sert, et un avertissement part dans les journaux. Un secret resté
 * sur Opus ne peut donc plus faire grimper la facture en silence.
 */
const modele = (name: string, fallback: string, familles: string[]) => {
  const v = env(name);
  if (!v) return fallback;
  if (familles.some((f) => v.startsWith(f))) return v;
  console.warn(`${name} = ${v} refusé (modèle non permis) : ${fallback} utilisé`);
  return fallback;
};

export const MODELS = {
  // Sonnet 5.5 écrit les consignes de Nano Banana : c'est l'étape qui décide de
  // la ressemblance, et un seul appel sert toutes les pièces d'une photo.
  // Haiku 5.5 reste permis ici, pour un coût moindre au prix du détail.
  prompts: modele('CLAUDE_PROMPT_MODEL', 'claude-sonnet-5-5', ['claude-sonnet-', 'claude-haiku-']),
  gemini: env('GEMINI_IMAGE_MODEL') ?? 'gemini-3.1-flash-image',
  // Le contrôle juge la fidélité au vêtement : Sonnet seulement.
  judge: modele('CLAUDE_MODEL', 'claude-sonnet-5-5', ['claude-sonnet-']),
};

// L'effort règle la vitesse et le soin : « xhigh » pour les consignes, là où
// se joue la ressemblance ; « high » pour le contrôle, qui note et choisit.
export const EFFORT = {
  prompts: effort('CLAUDE_PROMPT_EFFORT', 'xhigh'),
  judge: effort('CLAUDE_JUDGE_EFFORT', 'high'),
};

export const KEYS = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY'] as const;

/** La clé telle que collée, sans les espaces ni guillemets qu'un copier-coller ajoute souvent. */
function readKey(name: (typeof KEYS)[number]): string | undefined {
  const raw = Deno.env.get(name);
  if (!raw) return undefined;
  return raw.trim().replace(/^["']+|["']+$/g, '').trim() || undefined;
}

function secret(name: (typeof KEYS)[number]): string {
  const v = readKey(name);
  if (!v) throw new AgentError(SAY.notReady, `${name} absente des secrets Supabase`);
  return v;
}

/**
 * À quoi ressemble une clé, sans en montrer un seul caractère : sert à repérer
 * une clé collée sous le mauvais nom (une clé Google dans ANTHROPIC_API_KEY…).
 */
function keyShape(name: (typeof KEYS)[number]) {
  const raw = Deno.env.get(name) ?? '';
  const k = readKey(name) ?? '';
  const famille = /^sk-ant-/.test(k) ? 'Anthropic' : /^sk-/.test(k) ? 'OpenAI' : /^AIza/.test(k) ? 'Google' : 'inconnue';
  return { famille, longueur: k.length, nettoyee: raw !== k };
}

const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

/** Traduit un code HTTP d'un fournisseur en message lisible, le détail partant aux journaux. */
function httpError(who: string, status: number, text: string): AgentError {
  const detail = `${who} ${status} : ${text.replace(/\s+/g, ' ').slice(0, 300)}`;
  if (status === 401 || status === 403) return new AgentError(SAY.notReady, detail);
  if (status === 429 || status === 529 || /credit|quota|billing/i.test(text)) return new AgentError(SAY.busy, detail);
  return new AgentError(SAY.failed, detail);
}

// ---------------------------------------------------------------- Nano Banana

export async function generate(prompt: string, sources: Img[], opts: { search?: boolean } = {}): Promise<Img & { usage: Usage; searched: boolean }> {
  const key = secret('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent`;

  // Consigne d'abord, puis les photos de référence : Nano Banana redessine la
  // pièce à partir de la vraie, au lieu de l'imaginer d'après le texte.
  const parts = [
    { text: prompt },
    ...sources.map((s) => ({ inline_data: { mime_type: s.mime, data: b64(s.bytes) } })),
  ];
  // Recherche Google, web ET images : le générateur voit les photos du
  // modèle identifié (googleSearch.searchTypes, SDK google-genai).
  const search = [{ googleSearch: { searchTypes: { webSearch: {}, imageSearch: {} } } }];
  const call = (generationConfig: Record<string, unknown>, withSearch: boolean) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({ contents: [{ parts }], generationConfig, ...(withSearch ? { tools: search } : {}) }),
    });

  const size = { aspectRatio: '1:1', imageSize: '1K' };
  let searched = Boolean(opts.search);
  let res: Response;
  try {
    const config = (legacy: boolean) => ({
      // Avec la recherche, le modèle peut écrire avant de dessiner.
      responseModalities: searched ? ['TEXT', 'IMAGE'] : ['IMAGE'],
      ...(legacy ? { imageConfig: size } : { responseFormat: { image: size } }),
    });
    let legacy = false;
    res = await call(config(legacy), searched);
    for (let retry = 0; res.status === 400 && retry < 2; retry++) {
      const text = await res.text();
      // La documentation publie deux formes du réglage d'image selon les pages
      // et les modèles ; si la plus récente est refusée, on retente avec l'ancienne.
      if (!legacy && /responseFormat/i.test(text)) legacy = true;
      // Recherche refusée (modèle ou compte qui ne l'a pas) : on dessine sans.
      else if (searched && /search|tool|grounding/i.test(text)) {
        console.warn(`Nano Banana : recherche refusée, dessin sans (${text.replace(/\s+/g, ' ').slice(0, 160)})`);
        searched = false;
      } else if (!legacy && /Unknown name|Invalid JSON payload/i.test(text)) legacy = true;
      else throw httpError('Nano Banana', 400, text);
      res = await call(config(legacy), searched);
    }
  } catch (err) {
    if (err instanceof AgentError) throw err;
    throw new AgentError(SAY.failed, `Nano Banana injoignable : ${err instanceof Error ? err.message : err}`);
  }
  if (!res.ok) throw httpError('Nano Banana', res.status, await res.text());

  const body = await res.json();
  const candidate = body?.candidates?.[0];
  const blocked = body?.promptFeedback?.blockReason ?? (
    /SAFETY|PROHIBITED|BLOCK/.test(candidate?.finishReason ?? '') ? candidate.finishReason : null
  );
  if (blocked) throw new AgentError(SAY.refused, `Nano Banana a refusé : ${blocked}`);

  // Le modèle peut renvoyer des images de brouillon marquées « thought » : on
  // garde la dernière image définitive.
  type Part = { thought?: boolean; inlineData?: { data: string; mimeType?: string } };
  const images = ((candidate?.content?.parts ?? []) as Part[]).filter((p) => p.inlineData && !p.thought);
  const last = images.at(-1);
  if (!last?.inlineData) {
    // Avec la recherche, le modèle répond parfois en texte seul : on redessine sans.
    if (searched) {
      console.warn('Nano Banana : aucune image avec la recherche, dessin sans');
      return generate(prompt, sources, { search: false });
    }
    throw new AgentError(SAY.refused, "Nano Banana n'a renvoyé aucune image");
  }

  const bytes = new Uint8Array(Buffer.from(last.inlineData.data, 'base64'));
  const mime = sniffMime(bytes) ?? last.inlineData.mimeType ?? 'image/png';
  const grounding = candidate?.groundingMetadata;
  const usage = { ...(body.usageMetadata ?? {}), recherche: grounding ? { requetes: grounding.webSearchQueries ?? grounding.imageSearchQueries ?? [] } : null };
  return { bytes, mime, usage, searched };
}

// ---------------------------------------------------------------- Claude

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  // Une seule reprise automatique : au-delà, c'est la file de l'agent qui
  // retente, sans bloquer le passage.
  client ??= new Anthropic({ apiKey: secret('ANTHROPIC_API_KEY'), timeout: 100_000, maxRetries: 1 });
  return client;
}

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string } };

const imageBlock = (img: Img): Block => ({
  type: 'image',
  source: {
    type: 'base64',
    media_type: (['image/jpeg', 'image/png', 'image/webp'].includes(img.mime) ? img.mime : 'image/jpeg') as 'image/jpeg',
    data: b64(img.bytes),
  },
});

/**
 * Un appel Claude dont la réponse suit un schéma JSON (sorties structurées).
 * La réflexion reste adaptative, par défaut sur ces modèles ; l'effort règle
 * la vitesse.
 */
async function askJson(opts: {
  model: string;
  effort: Effort;
  system: string;
  schema: Record<string, unknown>;
  content: Block[];
  maxTokens: number;
}): Promise<{ data: unknown; usage: Usage }> {
  let res: Anthropic.Message;
  try {
    res = await anthropic().messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [{ role: 'user', content: opts.content }],
      output_config: { effort: opts.effort, format: { type: 'json_schema', schema: opts.schema } },
    });
  } catch (err) {
    if (err instanceof AgentError) throw err;
    if (err instanceof APIError && typeof err.status === 'number') throw httpError(`Claude ${opts.model}`, err.status, err.message);
    if (err instanceof APIConnectionTimeoutError) throw new AgentError(SAY.failed, `Claude ${opts.model} : délai dépassé`);
    throw new AgentError(SAY.failed, `Claude ${opts.model} : ${err instanceof Error ? err.message : err}`);
  }

  if (res.stop_reason === 'refusal') {
    throw new AgentError(SAY.refused, `Claude ${opts.model} a refusé (${JSON.stringify(res.stop_details ?? null)})`);
  }
  if (res.stop_reason === 'max_tokens') throw new AgentError(SAY.failed, `Claude ${opts.model} : réponse coupée (max_tokens)`);

  const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  try {
    return { data: JSON.parse(text), usage: res.usage as unknown as Usage };
  } catch {
    throw new AgentError(SAY.failed, `Claude ${opts.model} : JSON illisible (${text.slice(0, 120)})`);
  }
}

/** Sonnet 5.5 repère toutes les pièces de la photo (ou celles que la personne a nommées) et écrit leur consigne. */
export async function inventory(input: { sources: Img[]; hint: string; gender: string | null }): Promise<{ pieces: Target[]; note: string; usage: Usage }> {
  const { data, usage } = await askJson({
    model: MODELS.prompts,
    effort: EFFORT.prompts,
    system: INVENTORY_SYSTEM,
    schema: INVENTORY_SCHEMA,
    content: [...input.sources.map(imageBlock), { type: 'text', text: inventoryUserText(input) }],
    maxTokens: 16_000,
  });
  const o = (data ?? {}) as { pieces?: unknown; note?: unknown };
  const pieces = (Array.isArray(o.pieces) ? o.pieces : [])
    .map(cleanTarget)
    .filter((p): p is Target => p !== null)
    .slice(0, MAX_PIECES);
  return { pieces, note: String(o.note ?? '').trim(), usage };
}

/** Sonnet 5.5 réécrit la consigne d'une pièce d'après les écarts relevés par le contrôle. */
export async function refine(input: { sources: Img[]; target: Target; previous: Previous }): Promise<{ prompt: string; usage: Usage }> {
  const { data, usage } = await askJson({
    model: MODELS.prompts,
    effort: EFFORT.prompts,
    system: REFINE_SYSTEM,
    schema: REFINE_SCHEMA,
    content: [...input.sources.map(imageBlock), { type: 'text', text: refineUserText(input.target, input.previous) }],
    maxTokens: 8_000,
  });
  const prompt = String((data as { prompt?: unknown })?.prompt ?? '').trim();
  // Faute de nouvelle consigne, on garde la précédente plutôt que d'échouer.
  return { prompt: prompt || input.previous.prompt || input.target.prompt, usage };
}

/**
 * Sonnet 5.5, avec la recherche web, retrouve le modèle exact d'une pièce de
 * marque et en tire ses détails de design. Rien de sûr → reference null :
 * la pièce garde sa consigne d'origine, rien n'est perdu.
 */
export async function research(input: { sources: Img[]; target: Target }): Promise<{ reference: Reference | null; prompt: string | null; usage: Usage }> {
  const tools = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 4 },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3, max_content_tokens: 12_000 },
  ] as unknown as Anthropic.ToolUnion[];
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: [...input.sources.map(imageBlock), { type: 'text', text: researchUserText(input.target) }] as Anthropic.ContentBlockParam[] },
  ];

  let res: Anthropic.Message | null = null;
  try {
    // La recherche tourne côté serveur ; une boucle trop longue revient en
    // « pause_turn » : on renvoie la réponse telle quelle pour qu'elle reprenne.
    for (let turn = 0; turn < 3; turn++) {
      res = await anthropic().messages.create({
        model: MODELS.prompts,
        max_tokens: 12_000,
        system: RESEARCH_SYSTEM,
        messages,
        tools,
        output_config: { effort: EFFORT.prompts },
      });
      if (res.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: res.content as unknown as Anthropic.ContentBlockParam[] });
    }
  } catch (err) {
    if (err instanceof APIError && typeof err.status === 'number') throw httpError(`Claude ${MODELS.prompts} (recherche)`, err.status, err.message);
    throw new AgentError(SAY.failed, `Claude ${MODELS.prompts} (recherche) : ${err instanceof Error ? err.message : err}`);
  }
  if (!res || res.stop_reason === 'refusal') return { reference: null, prompt: null, usage: (res?.usage ?? null) as unknown as Usage };

  const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  const found = parseResearch(text);
  return { reference: found?.reference ?? null, prompt: found?.prompt || null, usage: res.usage as unknown as Usage };
}

export async function judge(input: {
  sources: Img[];
  generated: Img;
  target: Target;
  prompt: string;
}): Promise<Verdict & { usage: Usage }> {
  const { data, usage } = await askJson({
    model: MODELS.judge,
    effort: EFFORT.judge,
    system: JUDGE_SYSTEM,
    schema: VERDICT_SCHEMA,
    content: [
      { type: 'text', text: input.sources.length > 1 ? "Photos d'origine :" : "Photo d'origine :" },
      ...input.sources.map(imageBlock),
      { type: 'text', text: judgeText(input.target, input.prompt) },
      { type: 'text', text: 'Image générée :' },
      imageBlock(input.generated),
    ],
    maxTokens: 6_000,
  });
  return { ...normaliseVerdict(data), usage };
}

/** Renvoie l'index (0, 1, 2…) de l'image que le contrôle garde parmi `options`. */
export async function pickBest(sources: Img[], target: Target, options: { img: Img; score: number | null }[]): Promise<{ index: number; raison: string }> {
  const content: Block[] = [
    { type: 'text', text: sources.length > 1 ? "Photos d'origine :" : "Photo d'origine :" },
    ...sources.map(imageBlock),
    { type: 'text', text: `Pièce : ${target.name}, ${target.where || 'pièce principale'}.` },
  ];
  options.forEach((o, i) => {
    content.push({ type: 'text', text: `Image ${i + 1} (note du contrôle : ${o.score ?? '?'}/100) :` });
    content.push(imageBlock(o.img));
  });

  const { data } = await askJson({
    model: MODELS.judge, effort: EFFORT.judge, system: PICK_SYSTEM, schema: PICK_SCHEMA, content, maxTokens: 4_000,
  });
  const o = (data ?? {}) as { image?: unknown; raison?: unknown };
  const n = Math.round(Number(o.image));
  if (!Number.isFinite(n) || n < 1 || n > options.length) throw new AgentError(SAY.failed, `choix hors liste : ${o.image}`);
  return { index: n - 1, raison: String(o.raison ?? '') };
}

// ---------------------------------------------------------------- vérification

type Probe = {
  cle: 'absente' | 'valide' | 'refusée' | 'inconnue';
  forme: ReturnType<typeof keyShape>;
  modele: string;
  modele_trouve: boolean | null;
  http: number | null;
  disponibles?: string[];
};

/**
 * Vérifie clé et modèle chez chaque fournisseur en ne lisant que la fiche du
 * modèle : aucune génération, donc aucun coût. Ne renvoie jamais la clé ni le
 * corps des réponses (certains fournisseurs y recopient la clé masquée).
 */
async function probe(
  name: (typeof KEYS)[number],
  model: string,
  lookup: (key: string) => Promise<Response>,
  list: (key: string) => Promise<string[]>,
): Promise<Probe> {
  const key = readKey(name);
  const forme = keyShape(name);
  if (!key) return { cle: 'absente', forme, modele: model, modele_trouve: null, http: null };

  try {
    const res = await lookup(key);
    const text = await res.text();
    if (res.ok) return { cle: 'valide', forme, modele: model, modele_trouve: true, http: res.status };

    const refused = res.status === 401 || res.status === 403 || /API key|api_key|authentication/i.test(text);
    if (refused) return { cle: 'refusée', forme, modele: model, modele_trouve: null, http: res.status };

    if (res.status === 404) {
      const disponibles = await list(key).catch(() => []);
      return { cle: 'valide', forme, modele: model, modele_trouve: false, http: 404, disponibles };
    }
    return { cle: 'inconnue', forme, modele: model, modele_trouve: null, http: res.status };
  } catch {
    return { cle: 'inconnue', forme, modele: model, modele_trouve: null, http: null };
  }
}

export async function checkSetup() {
  const timeout = () => AbortSignal.timeout(15_000);
  const headers = (k: string) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01' });

  const claudeModels = async (k: string) => {
    const b = await (await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: headers(k), signal: timeout() })).json();
    return (b.data ?? []).map((m: { id: string }) => m.id).sort();
  };
  const claudeProbe = (model: string) => probe(
    'ANTHROPIC_API_KEY', model,
    (k) => fetch(`https://api.anthropic.com/v1/models/${model}`, { headers: headers(k), signal: timeout() }),
    claudeModels,
  );

  const [gemini, consignes, controle] = await Promise.all([
    probe(
      'GEMINI_API_KEY', MODELS.gemini,
      (k) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}`, { headers: { 'x-goog-api-key': k }, signal: timeout() }),
      async (k) => {
        const b = await (await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': k }, signal: timeout() })).json();
        return (b.models ?? []).map((m: { name: string }) => m.name.replace(/^models\//, '')).filter((id: string) => id.includes('image')).sort();
      },
    ),
    claudeProbe(MODELS.prompts),
    claudeProbe(MODELS.judge),
  ]);

  const pret = [gemini, consignes, controle].every((p) => p.cle === 'valide' && p.modele_trouve === true);
  return { pret, gemini, consignes, controle };
}
