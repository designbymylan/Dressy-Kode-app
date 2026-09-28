/**
 * Les trois modèles que l'agent fait travailler. Chaque fonction ne fait
 * qu'un appel et rend un résultat propre ; l'enchaînement est dans index.ts.
 */
import { Buffer } from 'node:buffer';
import {
  CATEGORIES, COLOUR_IDS, KINDS, DESCRIBE_TOOL, DESCRIBE_SYSTEM, describeUserText,
  JUDGE_SYSTEM, VERDICT_TOOL, PICK_SYSTEM, PICK_TOOL, type Previous,
} from './prompts.ts';
import { normaliseVerdict, type Verdict } from './decide.ts';
import { sniffMime } from './codec.ts';

export type Img = { bytes: Uint8Array; mime: string };
export type Usage = Record<string, unknown> | null;

/** Erreur dont le message peut être montré tel quel dans le dressing. */
export class AgentError extends Error {}

const CLAUDE = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5';

export const MODELS = {
  // Claude décrit la photo et écrit la consigne ; il peut tourner sur un autre
  // modèle que le contrôle qualité (CLAUDE_DESCRIBE_MODEL), sinon le même.
  describe: Deno.env.get('CLAUDE_DESCRIBE_MODEL') ?? CLAUDE,
  gemini: Deno.env.get('GEMINI_IMAGE_MODEL') ?? 'gemini-3.1-flash-image',
  claude: CLAUDE,
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
  if (!v) throw new AgentError(`Clé ${name} absente des secrets Supabase (Edge Functions → Secrets).`);
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

async function apiError(who: string, key: string, res: Response): Promise<AgentError> {
  const text = (await res.text()).replace(/\s+/g, ' ').slice(0, 240);
  if (res.status === 401 || res.status === 403) {
    return new AgentError(`${who} refuse la clé ${key} (${res.status}). Vérifie-la dans les secrets Supabase.`);
  }
  if (res.status === 429) {
    return new AgentError(`${who} limite les appels ou le crédit est épuisé (429). ${text}`);
  }
  return new AgentError(`${who} a répondu ${res.status} : ${text}`);
}

// ---------------------------------------------------------------- Nano Banana

export async function generate(prompt: string, sources: Img[]): Promise<Img & { usage: Usage }> {
  const key = secret('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent`;

  // Consigne d'abord, puis les photos de référence : Nano Banana redessine la
  // pièce à partir de la vraie, au lieu de l'imaginer d'après le texte.
  const parts = [
    { text: prompt },
    ...sources.map((s) => ({ inline_data: { mime_type: s.mime, data: b64(s.bytes) } })),
  ];
  const call = (generationConfig: Record<string, unknown>) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({ contents: [{ parts }], generationConfig }),
    });

  const size = { aspectRatio: '1:1', imageSize: '1K' };
  let res = await call({ responseModalities: ['IMAGE'], responseFormat: { image: size } });

  // La documentation publie deux formes de ce réglage selon les pages et les
  // modèles ; si la plus récente est refusée, on retente avec l'ancienne.
  if (res.status === 400) {
    const text = await res.text();
    if (!/responseFormat|Unknown name|Invalid JSON payload/i.test(text)) {
      throw new AgentError(`Nano Banana a répondu 400 : ${text.replace(/\s+/g, ' ').slice(0, 240)}`);
    }
    res = await call({ responseModalities: ['IMAGE'], imageConfig: size });
  }
  if (!res.ok) throw await apiError('Nano Banana', 'GEMINI_API_KEY', res);

  const body = await res.json();
  const candidate = body?.candidates?.[0];
  const blocked = body?.promptFeedback?.blockReason ?? (
    /SAFETY|PROHIBITED|BLOCK/.test(candidate?.finishReason ?? '') ? candidate.finishReason : null
  );
  if (blocked) throw new AgentError(`Nano Banana a refusé de générer l'image (${blocked}).`);

  // Le modèle peut renvoyer des images de brouillon marquées « thought » : on
  // garde la dernière image définitive.
  type Part = { thought?: boolean; inlineData?: { data: string; mimeType?: string } };
  const images = ((candidate?.content?.parts ?? []) as Part[]).filter((p) => p.inlineData && !p.thought);
  const last = images.at(-1);
  if (!last?.inlineData) throw new AgentError("Nano Banana n'a renvoyé aucune image.");

  const bytes = new Uint8Array(Buffer.from(last.inlineData.data, 'base64'));
  const mime = sniffMime(bytes) ?? last.inlineData.mimeType ?? 'image/png';
  return { bytes, mime, usage: body.usageMetadata ?? null };
}

// ---------------------------------------------------------------- Claude

type ClaudeBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

const imageBlock = (img: Img): ClaudeBlock => ({
  type: 'image',
  source: { type: 'base64', media_type: img.mime, data: b64(img.bytes) },
});

async function askClaude(
  system: string,
  tool: { name: string },
  content: ClaudeBlock[],
  opts: { model?: string; maxTokens?: number; missing?: string } = {},
) {
  const key = secret('ANTHROPIC_API_KEY');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: opts.model ?? MODELS.claude,
      max_tokens: opts.maxTokens ?? 1500,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) throw await apiError('Claude', 'ANTHROPIC_API_KEY', res);

  const body = await res.json();
  if (body.stop_reason === 'max_tokens') throw new AgentError('La réponse de Claude a été coupée (max_tokens) : relance la pièce.');
  const use = (body.content ?? []).find((b: { type: string }) => b.type === 'tool_use');
  if (!use) throw new AgentError(opts.missing ?? "Claude n'a pas rendu de verdict.");
  return { input: use.input as unknown, usage: (body.usage ?? null) as Usage };
}

// Claude décrit la photo et écrit la consigne de Nano Banana (étape tenue
// autrefois par ChatGPT). La réponse passe par un outil forcé dont le schéma
// est celui de la fiche : même contrat qu'avant pour le reste de l'agent.

export type Described = {
  name: string;
  category: (typeof CATEGORIES)[number];
  /** Type précis (collier, bandeau, jean…), ou null s'il ne va pas avec la catégorie. */
  kind: string | null;
  colors: string[];
  material: string;
  description: string;
  prompt: string;
  usage: Usage;
};

export async function describe(input: {
  sources: Img[];
  hint: string;
  gender: string | null;
  previous: Previous | null;
}): Promise<Described> {
  const { input: raw, usage } = await askClaude(DESCRIBE_SYSTEM, DESCRIBE_TOOL, [
    ...input.sources.map(imageBlock),
    { type: 'text', text: describeUserText(input) },
  ], { model: MODELS.describe, maxTokens: 3000, missing: "Claude n'a renvoyé aucune description." });

  const parsed = (raw ?? {}) as Record<string, unknown>;
  const category = (CATEGORIES as readonly string[]).includes(String(parsed.category))
    ? parsed.category as Described['category']
    : 'accessoires';
  const kind = KINDS[category].includes(String(parsed.kind)) ? String(parsed.kind) : null;
  const colors = (Array.isArray(parsed.colors) ? parsed.colors : [])
    .map(String)
    .filter((c) => (COLOUR_IDS as readonly string[]).includes(c))
    .slice(0, 3);
  const prompt = String(parsed.prompt ?? '').trim();
  if (!prompt) throw new AgentError("Claude n'a pas renvoyé de consigne exploitable.");

  return {
    name: String(parsed.name ?? '').trim().slice(0, 60) || 'Pièce sans nom',
    category,
    kind,
    colors,
    material: String(parsed.material ?? '').trim().slice(0, 80),
    description: String(parsed.description ?? '').trim(),
    prompt,
    usage,
  };
}

export async function judge(input: {
  sources: Img[];
  generated: Img;
  description: string;
  prompt: string;
}): Promise<Verdict & { usage: Usage }> {
  const { input: raw, usage } = await askClaude(JUDGE_SYSTEM, VERDICT_TOOL, [
    { type: 'text', text: input.sources.length > 1 ? "Photos d'origine :" : "Photo d'origine :" },
    ...input.sources.map(imageBlock),
    { type: 'text', text: `Description établie :\n${input.description}\n\nConsigne envoyée au générateur :\n${input.prompt}` },
    { type: 'text', text: 'Image générée :' },
    imageBlock(input.generated),
  ]);
  return { ...normaliseVerdict(raw), usage };
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
  const anthropic = (k: string) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01' });

  const claudeModels = async (k: string) => {
    const b = await (await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: anthropic(k), signal: timeout() })).json();
    return (b.data ?? []).map((m: { id: string }) => m.id).sort();
  };
  const claudeProbe = (model: string) => probe(
    'ANTHROPIC_API_KEY', model,
    (k) => fetch(`https://api.anthropic.com/v1/models/${model}`, { headers: anthropic(k), signal: timeout() }),
    claudeModels,
  );

  const [gemini, claude, description] = await Promise.all([
    probe(
      'GEMINI_API_KEY', MODELS.gemini,
      (k) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}`, { headers: { 'x-goog-api-key': k }, signal: timeout() }),
      async (k) => {
        const b = await (await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': k }, signal: timeout() })).json();
        return (b.models ?? []).map((m: { name: string }) => m.name.replace(/^models\//, '')).filter((id: string) => id.includes('image')).sort();
      },
    ),
    claudeProbe(MODELS.claude),
    MODELS.describe === MODELS.claude ? null : claudeProbe(MODELS.describe),
  ]);

  // « description » n'apparaît que si la description tourne sur un autre modèle Claude.
  const probes = [gemini, claude, description].filter((p): p is Probe => p !== null);
  const pret = probes.every((p) => p.cle === 'valide' && p.modele_trouve === true);
  return { pret, gemini, claude, ...(description ? { description } : {}) };
}

/** Renvoie l'index (0, 1, 2…) de l'image que Claude garde parmi `options`. */
export async function pickBest(sources: Img[], options: { img: Img; score: number | null }[]): Promise<{ index: number; raison: string }> {
  const content: ClaudeBlock[] = [
    { type: 'text', text: sources.length > 1 ? "Photos d'origine :" : "Photo d'origine :" },
    ...sources.map(imageBlock),
  ];
  options.forEach((o, i) => {
    content.push({ type: 'text', text: `Image ${i + 1} (note du contrôle : ${o.score ?? '?'}/100) :` });
    content.push(imageBlock(o.img));
  });

  const { input } = await askClaude(PICK_SYSTEM, PICK_TOOL, content);
  const o = (input ?? {}) as { image?: unknown; raison?: unknown };
  const n = Math.round(Number(o.image));
  if (!Number.isFinite(n) || n < 1 || n > options.length) throw new AgentError('Claude a désigné une image qui n\'existe pas.');
  return { index: n - 1, raison: String(o.raison ?? '') };
}
