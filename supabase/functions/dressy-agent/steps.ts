/**
 * Les modèles que l'agent fait travailler. Chaque fonction ne fait qu'un
 * appel et rend un résultat propre ; l'enchaînement est dans index.ts.
 *
 *   Sonnet 5 (MODELS.survey) : repère les pièces d'une photo et écrit leur
 *     fiche (type, couleurs, cadre), vite.
 *   Gemini (MODELS.segment) : segmente la pièce, c'est-à-dire rend son masque ;
 *     les pixels restent ceux de la photo. Un modèle plus fort
 *     (MODELS.segmentStrong) reprend après un « rendu incorrect ».
 *   Nano Banana (MODELS.gemini) : ne dessine plus qu'en dernier recours, quand
 *     la personne a signalé deux fois un rendu incorrect.
 *
 * Rien de ce fichier n'est montré tel quel : un AgentError porte un message
 * écrit pour la personne (qui ne nomme jamais les modèles) et un détail
 * technique qui ne va que dans les journaux.
 */
import { Buffer } from 'node:buffer';
import Anthropic, { APIError, APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import {
  MAX_PIECES, cleanTarget,
  SURVEY_SYSTEM, SURVEY_SCHEMA, surveyUserText,
  type Target,
} from './prompts.ts';
import { parseSegments, type Segment } from './segment.ts';
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

export const MODELS = {
  // Sonnet 5 en effort bas : le repérage doit être rapide, la qualité de
  // l'image ne dépend plus de lui puisque la pièce est découpée dans la photo.
  survey: env('CLAUDE_SURVEY_MODEL') ?? 'claude-sonnet-5',
  segment: env('GEMINI_SEGMENT_MODEL') ?? 'gemini-2.5-flash',
  segmentStrong: env('GEMINI_SEGMENT_MODEL_STRONG') ?? 'gemini-2.5-pro',
  gemini: env('GEMINI_IMAGE_MODEL') ?? 'gemini-3.1-flash-image',
};

export const EFFORT = {
  survey: effort('CLAUDE_SURVEY_EFFORT', 'low'),
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

/** Le repérage des pièces d'une photo : un seul appel rapide, la découpe se fait ensuite pièce par pièce. */
export async function survey(input: { sources: Img[]; hint: string; gender: string | null }): Promise<{ pieces: Target[]; note: string; usage: Usage }> {
  const { data, usage } = await askJson({
    model: MODELS.survey,
    effort: EFFORT.survey,
    system: SURVEY_SYSTEM,
    schema: SURVEY_SCHEMA,
    content: [...input.sources.map(imageBlock), { type: 'text', text: surveyUserText(input) }],
    maxTokens: 8_000,
  });
  const o = (data ?? {}) as { pieces?: unknown; note?: unknown };
  const pieces = (Array.isArray(o.pieces) ? o.pieces : [])
    .map(cleanTarget)
    .filter((p): p is Target => p !== null)
    .slice(0, MAX_PIECES);
  return { pieces, note: String(o.note ?? '').trim(), usage };
}

// ---------------------------------------------------------------- Gemini : segmentation

/**
 * Le masque de segmentation d'UNE pièce (Gemini, modèle de texte et de vision,
 * pas de génération d'image : les pixels restent ceux de la photo). `strong`
 * prend le modèle le plus fort et ne donne pas le cadre de Kodi, pour la
 * reprise après un « rendu incorrect ».
 */
export async function segment(photo: Img, target: Target, opts: { strong: boolean }): Promise<{ segments: Segment[]; usage: Usage; model: string }> {
  const key = secret('GEMINI_API_KEY');
  const model = opts.strong ? MODELS.segmentStrong : MODELS.segment;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const hint = !opts.strong && target.box
    ? ` It is roughly inside the box [y0, x0, y1, x1] = [${[target.box[1], target.box[0], target.box[1] + target.box[3], target.box[0] + target.box[2]].map((v) => Math.round(v * 1000)).join(', ')}] (0-1000), but that box is only approximate.`
    : '';
  const text = `Give the segmentation mask of ONE single item in this photo: "${target.name}"${target.where ? ` (${target.where})` : ''}.${hint} Include the whole visible item. Leave out the person (skin, hair, face, hands), the background, every other item even where it touches or overlaps this one, and cast shadows. If the item is a pair (shoes, earrings, gloves), include both. Output a JSON list with exactly one entry: the 2D bounding box in "box_2d" as [y0, x0, y1, x1] normalised to 0-1000, the segmentation mask in "mask", and the text label in "label".`;

  const parts = [
    { inline_data: { mime_type: photo.mime, data: b64(photo.bytes) } },
    { text },
  ];
  const call = (thinking: boolean) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          ...(thinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });

  let res: Response;
  try {
    res = await call(true);
    // Certains modèles (les plus forts) ne se laissent pas couper la réflexion.
    if (res.status === 400) {
      const body = await res.text();
      if (!/think/i.test(body)) throw httpError('Gemini (découpe)', 400, body);
      res = await call(false);
    }
  } catch (err) {
    if (err instanceof AgentError) throw err;
    throw new AgentError(SAY.failed, `Gemini (découpe) injoignable : ${err instanceof Error ? err.message : err}`);
  }
  if (!res.ok) throw httpError('Gemini (découpe)', res.status, await res.text());

  const body = await res.json();
  const candidate = body?.candidates?.[0];
  const blocked = body?.promptFeedback?.blockReason ?? (/SAFETY|PROHIBITED|BLOCK/.test(candidate?.finishReason ?? '') ? candidate.finishReason : null);
  if (blocked) throw new AgentError(SAY.refused, `Gemini (découpe) a refusé : ${blocked}`);

  const answer = ((candidate?.content?.parts ?? []) as { text?: string; thought?: boolean }[])
    .filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  return { segments: parseSegments(answer), usage: body?.usageMetadata ?? null, model };
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

  const geminiList = async (k: string) => {
    const b = await (await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': k }, signal: timeout() })).json();
    return (b.models ?? []).map((m: { name: string }) => m.name.replace(/^models\//, '')).sort();
  };

  const [decoupe, decoupeFort, dessin, repérage] = await Promise.all([
    probe(
      'GEMINI_API_KEY', MODELS.segment,
      (k) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS.segment}`, { headers: { 'x-goog-api-key': k }, signal: timeout() }),
      geminiList,
    ),
    probe(
      'GEMINI_API_KEY', MODELS.segmentStrong,
      (k) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS.segmentStrong}`, { headers: { 'x-goog-api-key': k }, signal: timeout() }),
      geminiList,
    ),
    probe(
      'GEMINI_API_KEY', MODELS.gemini,
      (k) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}`, { headers: { 'x-goog-api-key': k }, signal: timeout() }),
      geminiList,
    ),
    claudeProbe(MODELS.survey),
  ]);

  const pret = [decoupe, decoupeFort, dessin, repérage].every((p) => p.cle === 'valide' && p.modele_trouve === true);
  return { pret, decoupe, decoupeFort, dessin, reperage: repérage };
}
