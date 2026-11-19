/**
 * Les modèles que l'agent fait travailler. Chaque fonction ne fait qu'un
 * appel et rend un résultat propre ; l'enchaînement est dans index.ts.
 *
 *   Sonnet 5 (MODELS.survey) : repère les pièces d'une photo et écrit leur
 *     fiche (type, couleurs, cadre), vite.
 *   Gemini (MODELS.segment) : segmente la pièce, c'est-à-dire rend son masque ;
 *     les pixels restent ceux de la photo. Un modèle plus fort
 *     (MODELS.segmentStrong) reprend après un « rendu incorrect ».
 *   Nano Banana (MODELS.gemini) : ne dessine que sur demande (« Image propre »)
 *     ou quand la personne a signalé deux fois un rendu incorrect ; chaque
 *     dessin prend une génération au compteur (quota.ts).
 *
 * Rien de ce fichier n'est montré tel quel : un AgentError porte un message
 * écrit pour la personne (qui ne nomme jamais les modèles) et un détail
 * technique qui ne va que dans les journaux.
 */
import { Buffer } from 'node:buffer';
import Anthropic, { APIError, APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import {
  MAX_PIECES, cleanTarget,
  SURVEY_SYSTEM, SURVEY_SCHEMA, surveyUserText, RELAIS_SYSTEM, observationPrompt,
  type Target,
} from './prompts.ts';
import { parseSegments, type Segment } from './segment.ts';
import { alleger, sniffMime } from './codec.ts';
import { accesGoogle, anthropicBase, anthropicViaIntermediaire, geminiBase, geminiUrl, geminiViaIntermediaire, GEMINI_OFFICIEL } from '../_shared/fournisseurs.ts';

export type Img = { bytes: Uint8Array; mime: string };
export type Usage = Record<string, unknown> | null;
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Erreur dont `message` peut être montré dans le dressing ; `detail` reste dans les journaux. */
export class AgentError extends Error {
  /**
   * `passager` : une panne du fournisseur qui a des chances de passer seule
   * (délai dépassé, réseau, 5xx, 429). La tâche est alors remise en file et
   * retentée au passage suivant, au lieu d'échouer (19/11, voir `runOnce`).
   */
  constructor(message: string, readonly detail?: string, readonly passager = false) {
    super(message);
  }
}

/** Une panne passagère du fournisseur (voir `AgentError.passager`). */
export const passager = (err: unknown): boolean => err instanceof AgentError && err.passager;

/** Les messages que la personne peut lire. Aucun ne nomme un modèle ni un fournisseur. */
export const SAY = {
  notReady: "Kodi n'est pas encore prêt à dessiner tes pièces. Réessaie un peu plus tard.",
  busy: 'Kodi est très demandé en ce moment. Réessaie dans quelques minutes.',
  failed: "Kodi n'a pas pu finir cette pièce. Réessaie dans un moment.",
  refused: "Kodi n'a pas pu dessiner cette pièce. Essaie avec une autre photo.",
  nothing: "Kodi n'a trouvé aucune pièce à ranger sur cette photo. Essaie avec une photo où elle se voit en entier.",
  photo: 'Kodi ne retrouve plus ta photo. Confie-la de nouveau.',
  quota: "Tu as utilisé tes générations. Passe à une offre pour continuer à générer des images.",
} as const;

const env = (name: string) => Deno.env.get(name)?.trim() || undefined;
const effort = (name: string, fallback: Effort): Effort => {
  const v = env(name);
  return v && ['low', 'medium', 'high', 'xhigh', 'max'].includes(v) ? v as Effort : fallback;
};

/**
 * La chaîne de relais du repérage (19/11). Le 18/11, gemini-3.5-flash (puis
 * 3.7-flash) s'est mis à pendre chez l'intermédiaire : un seul modèle, et
 * toutes les photos échouaient. Le repérage part sur le premier ; s'il n'a
 * pas répondu après `REPERAGE_RELAIS_MS`, le suivant part EN MÊME TEMPS, et
 * ainsi de suite ; la première réponse lisible gagne, les autres sont coupées.
 * Une erreur fait partir le suivant aussitôt. `GEMINI_VISION_MODELS` (liste
 * séparée par des virgules) remplace la chaîne ; `GEMINI_VISION_MODEL` la
 * précède. Ordre : banc du 19/11 (voir CLAUDE.md, « Panne du repérage »).
 */
export const RELAIS_VISION_DEFAUT = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-3.5-flash'];
export function modelesDeVision(): string[] {
  const liste = (env('GEMINI_VISION_MODELS')?.split(',').map((m) => m.trim()).filter(Boolean)) ?? RELAIS_VISION_DEFAUT;
  const premier = env('GEMINI_VISION_MODEL');
  return [...new Set(premier ? [premier, ...liste] : liste)].slice(0, 5);
}
/** Le délai avant de lancer le relais suivant, en parallèle (20 s par défaut). */
const relaisMs = (): number => Math.max(5_000, Number(env('REPERAGE_RELAIS_MS') ?? 20_000) || 20_000);

export const MODELS = {
  // Sonnet 5 en effort bas : le repérage doit être rapide, la qualité de
  // l'image ne dépend plus de lui puisque la pièce est découpée dans la photo.
  survey: env('CLAUDE_SURVEY_MODEL') ?? 'claude-sonnet-5',
  // Le repérage par Gemini seul (17/11) : voit les photos par un intermédiaire, ce que Claude ne fait pas.
  // Le repérage passe par une chaîne de relais (19/11, `modelesDeVision`) :
  // `vision` est le premier maillon, gardé pour le banc et les journaux.
  vision: modelesDeVision()[0],
  segment: env('GEMINI_SEGMENT_MODEL') ?? 'gemini-2.5-flash',
  segmentStrong: env('GEMINI_SEGMENT_MODEL_STRONG') ?? 'gemini-2.5-pro',
  // Le modèle complet en 2K pour les abonnées, en 1K pour le gratuit (quota.ts).
  // Les identifiants se règlent dans les secrets Supabase (GEMINI_IMAGE_MODEL,
  // GEMINI_IMAGE_MODEL_LITE) : le code ne les devine pas.
  // Nano Banana 2.1 par défaut depuis le 13/11 (décision de l'utilisateur) :
  // meilleur et deux fois moins cher que 2 en tarif public.
  gemini: env('GEMINI_IMAGE_MODEL') ?? 'gemini-nano-banana-2.1',
  geminiLite: env('GEMINI_IMAGE_MODEL_LITE') ?? env('GEMINI_IMAGE_MODEL') ?? 'gemini-nano-banana-2.1',
};

export const EFFORT = {
  survey: effort('CLAUDE_SURVEY_EFFORT', 'low'),
};

export const KEYS = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY'] as const;
/** Les clés obligatoires, plus `GOOGLE_API_KEY` (facultative : découpe et vecteurs chez Google directement). */
type SecretName = (typeof KEYS)[number] | 'GOOGLE_API_KEY';

/** La clé telle que collée, sans les espaces ni guillemets qu'un copier-coller ajoute souvent. */
function readKey(name: SecretName): string | undefined {
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
function keyShape(name: SecretName) {
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
  if (status === 429 || status === 529) return new AgentError(SAY.busy, detail, true);
  if (/credit|quota|billing/i.test(text)) return new AgentError(SAY.busy, detail);
  return new AgentError(SAY.failed, detail, status >= 500);
}

// ---------------------------------------------------------------- Nano Banana

export async function generate(prompt: string, sources: Img[], opts: { search?: boolean; model?: string; size?: '1K' | '2K' } = {}): Promise<Img & { usage: Usage; searched: boolean }> {
  const key = secret('GEMINI_API_KEY');
  const model = opts.model ?? MODELS.gemini;
  const url = geminiUrl(model);

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

  const size = { aspectRatio: '1:1', imageSize: opts.size ?? '1K' };
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
    throw new AgentError(SAY.failed, `Nano Banana injoignable : ${err instanceof Error ? err.message : err}`, true);
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
      return generate(prompt, sources, { ...opts, search: false });
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
  client ??= new Anthropic({ apiKey: secret('ANTHROPIC_API_KEY'), baseURL: anthropicBase(), timeout: 100_000, maxRetries: 1 });
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
 * Les moyens d'obtenir du JSON, du plus strict au plus tolérant :
 *   schema : sorties structurées (`output_config.format`), ce que tient l'API d'Anthropic ;
 *   texte  : le schéma est dans la consigne, l'effort reste réglé (`output_config.effort`),
 *            la réponse est lue en tolérance ;
 *   brut   : plus aucune option, pour un intermédiaire qui refuse même l'effort.
 */
type Mode = 'schema' | 'texte' | 'brut';
const ECHELLE: Mode[] = ['schema', 'texte', 'brut'];

/**
 * Le mode qui a marché la dernière fois : on repart de lui, sans perdre un
 * appel à rejouer un mode que ce fournisseur n'a pas tenu. Gardé par instance
 * de la fonction ; sans mémoire, on part de `texte` derrière un intermédiaire
 * (ANTHROPIC_BASE_URL) et de `schema` chez Anthropic.
 */
let modeConnu: Mode | null = null;
export const _oublierMode = () => { modeConnu = null; };

async function askOnce(opts: {
  model: string;
  effort: Effort;
  system: string;
  schema: Record<string, unknown>;
  content: Block[];
  maxTokens: number;
}, mode: Mode): Promise<{ text: string; usage: Usage; resume: string }> {
  const dansLaConsigne = mode !== 'schema';
  let res: Anthropic.Message;
  try {
    res = await anthropic().messages.create({
      model: opts.model,
      max_tokens: dansLaConsigne ? opts.maxTokens + 4_000 : opts.maxTokens,
      system: dansLaConsigne
        ? `${opts.system}\n\nFORMAT DE RÉPONSE : réponds UNIQUEMENT par un objet JSON valide, sans phrase avant ni après et sans bloc de code, qui respecte ce schéma JSON :\n${JSON.stringify(opts.schema)}`
        : opts.system,
      messages: [{ role: 'user', content: opts.content }],
      ...(mode === 'schema'
        ? { output_config: { effort: opts.effort, format: { type: 'json_schema', schema: opts.schema } } }
        : mode === 'texte' ? { output_config: { effort: opts.effort } } : {}),
    });
  } catch (err) {
    if (err instanceof AgentError) throw err;
    if (err instanceof APIError && typeof err.status === 'number') throw httpError(`Claude ${opts.model} (${mode})`, err.status, err.message);
    if (err instanceof APIConnectionTimeoutError) throw new AgentError(SAY.failed, `Claude ${opts.model} (${mode}) : délai dépassé`);
    throw new AgentError(SAY.failed, `Claude ${opts.model} (${mode}) : ${err instanceof Error ? err.message : err}`);
  }

  if (res.stop_reason === 'refusal') {
    throw new AgentError(SAY.refused, `Claude ${opts.model} a refusé (${JSON.stringify(res.stop_details ?? null)})`);
  }
  if (res.stop_reason === 'max_tokens') throw new AgentError(SAY.failed, `Claude ${opts.model} (${mode}) : réponse coupée (max_tokens)`);

  const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  const u = res.usage as unknown as Record<string, unknown>;
  // De quoi diagnostiquer un intermédiaire dans les journaux : le modèle qui a
  // vraiment répondu et le nombre de jetons lus (une image perdue se voit là).
  const resume = `${mode}, modèle ${res.model ?? '?'}, ${u?.input_tokens ?? '?'} jetons lus, ${u?.output_tokens ?? '?'} écrits`;
  return { text, usage: res.usage as unknown as Usage, resume };
}

/**
 * Un appel Claude dont la réponse suit un schéma JSON, par l'échelle des
 * moyens ci-dessus. On descend d'un cran quand la réponse n'est pas le JSON
 * attendu ou quand l'option est refusée (erreur 400) ; une clé refusée, un
 * quota ou un refus de contenu s'arrêtent net. `valide` dit si le JSON lu a la
 * forme voulue ; `reprise` fournit les photos allégées pour les modes tolérants.
 */
async function askJson(opts: {
  model: string;
  effort: Effort;
  system: string;
  schema: Record<string, unknown>;
  content: Block[];
  maxTokens: number;
  valide: (data: unknown) => boolean;
  reprise?: () => Block[];
}): Promise<{ data: unknown; usage: Usage }> {
  const depart = ECHELLE.indexOf(modeConnu ?? (anthropicViaIntermediaire() ? 'texte' : 'schema'));
  const essais: string[] = [];
  for (const mode of ECHELLE.slice(depart)) {
    try {
      const { text, usage, resume } = await askOnce(mode !== 'schema' && opts.reprise ? { ...opts, content: opts.reprise() } : opts, mode);
      const data = lireJson(text);
      if (data !== undefined && opts.valide(data)) {
        if (essais.length) console.warn(`Claude : repli réussi (${resume}) après ${essais.join(' | ')}`);
        modeConnu = mode;
        return { data, usage };
      }
      essais.push(`${resume} : réponse illisible (${text.replace(/\s+/g, ' ').slice(0, 160)})`);
    } catch (err) {
      if (err instanceof AgentError && mode !== 'brut' && / 400 /.test(err.detail ?? '')) {
        essais.push(`${mode} refusé : ${err.detail}`);
        continue;
      }
      if (err instanceof AgentError && essais.length) throw new AgentError(err.message, `${err.detail} (après ${essais.join(' | ')})`);
      throw err;
    }
  }
  throw new AgentError(SAY.failed, `Claude ${opts.model} : JSON illisible. ${essais.join(' | ')}`);
}

/**
 * Le JSON d'une réponse de Claude, même quand elle est enrobée : phrase
 * d'introduction, bloc ```json, texte après. Un intermédiaire qui ne tient pas
 * les sorties structurées rend souvent ce format. `undefined` si rien de lisible.
 */
export function lireJson(text: string): unknown {
  const brut = text.trim();
  try {
    return JSON.parse(brut);
  } catch { /* enrobé : on cherche le JSON dedans */ }
  const bloc = brut.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidats = [bloc, brut].filter((c): c is string => Boolean(c));
  for (const c of candidats) {
    try {
      return JSON.parse(c);
    } catch { /* suite */ }
    const debut = c.search(/[[{]/);
    if (debut < 0) continue;
    const ferme = c[debut] === '[' ? ']' : '}';
    const fin = c.lastIndexOf(ferme);
    if (fin <= debut) continue;
    try {
      return JSON.parse(c.slice(debut, fin + 1));
    } catch { /* suite */ }
  }
  return undefined;
}

/**
 * Une photo que le fournisseur n'a pas vue comme une image (17/11) : un
 * intermédiaire peut passer l'image en texte (son base64 est alors compté
 * comme du texte, soit ~0,34 jeton par octet) ; le modèle répond « aucune
 * pièce », ce qui est une réponse valide, donc aucun repli ne se déclenche.
 * Une vraie image coûte au plus ~1 600 jetons, quel que soit son poids : bien
 * au-delà de 4 000 jetons de consigne + 2 500 par photo, c'est un texte.
 */
export function verifierImagesVues(usage: Usage, nbPhotos: number): void {
  const lus = Number((usage as Record<string, unknown> | null)?.input_tokens ?? 0);
  const plafond = 4_000 + 2_500 * Math.max(1, nbPhotos);
  if (lus > plafond) {
    throw new AgentError(SAY.notReady, `Claude a lu ${lus} jetons pour ${nbPhotos} photo(s) (plus de ${plafond}) : les images lui arrivent en texte, probablement par l'intermédiaire (ANTHROPIC_BASE_URL). Une clé Anthropic directe règle cela.`);
  }
}

/**
 * Claude reçoit-il les photos ? Oui chez Anthropic. Derrière un intermédiaire
 * (ANTHROPIC_BASE_URL), non par défaut : il lit l'image comme du texte ou
 * l'ignore (essais du 17/11), le relais prend alors le repérage. À remettre à
 * `1` (CLAUDE_VOIT_LES_IMAGES) si l'intermédiaire change et qu'il les passe.
 */
export const claudeVoitLesImages = (): boolean => !anthropicViaIntermediaire() || env('CLAUDE_VOIT_LES_IMAGES') === '1';

/**
 * Un appel Gemini qui regarde des photos et répond en JSON (texte), niveau de
 * réflexion minimal. Même clé et même adresse que la découpe. Sert au relais
 * (observations) et au repérage par Gemini seul.
 */
async function geminiVoit(input: { sources: Img[]; texte: string; systeme?: string; model?: string; signal?: AbortSignal }): Promise<{ texte: string; usage: Usage; model: string }> {
  const acces = accesGoogle();
  if (!acces.cle) throw new AgentError(SAY.notReady, `${acces.nomCle} absente des secrets Supabase`);
  const model = input.model ?? MODELS.vision;
  const url = geminiUrl(model, 'generateContent', acces.base);
  const parts = [
    ...input.sources.map((s) => ({ inline_data: { mime_type: s.mime, data: b64(s.bytes) } })),
    { text: input.texte },
  ];
  // 19/11 : un repérage tient d'habitude en 12 à 26 s. Un appel resté pendu
  // (80 s sans réponse) faisait échouer la photo : on coupe à 45 s (ou plus
  // tôt quand un relais a déjà répondu, `input.signal`).
  const call = (thinking: boolean) => fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': acces.cle! },
    signal: input.signal ? AbortSignal.any([AbortSignal.timeout(45_000), input.signal]) : AbortSignal.timeout(45_000),
    body: JSON.stringify({
      ...(input.systeme ? { systemInstruction: { parts: [{ text: input.systeme }] } } : {}),
      contents: [{ parts }],
      generationConfig: { responseMimeType: 'application/json', ...(thinking ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}) },
    }),
  });
  const appel = async (): Promise<Response> => {
    let res: Response;
    try {
      res = await call(true);
      // Un modèle qui refuse le niveau de réflexion : on reprend sans.
      if (res.status === 400 && /think/i.test(await res.clone().text())) res = await call(false);
    } catch (err) {
      throw new AgentError(SAY.failed, `Gemini (vision) injoignable : ${err instanceof Error ? err.message : err}`, true);
    }
    if (!res.ok) throw httpError('Gemini (vision)', res.status, await res.text());
    return res;
  };
  const res = await appel();
  const body = await res.json();
  const candidate = body?.candidates?.[0];
  const blocked = body?.promptFeedback?.blockReason ?? (/SAFETY|PROHIBITED|BLOCK/.test(candidate?.finishReason ?? '') ? candidate.finishReason : null);
  if (blocked) throw new AgentError(SAY.refused, `Gemini (vision) a refusé : ${blocked}`);
  const texte = ((candidate?.content?.parts ?? []) as { text?: string; thought?: boolean }[])
    .filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();
  if (!texte) throw new AgentError(SAY.failed, 'Gemini (vision) : réponse vide');
  return { texte, usage: body?.usageMetadata ?? null, model };
}

/** Le relais, première moitié : Gemini regarde les photos et rend ses observations (JSON, en texte). */
export const observer = (input: { sources: Img[]; hint: string }) =>
  geminiVoit({ sources: input.sources, texte: observationPrompt({ hint: input.hint, photos: input.sources.length }) });

/** Les jetons d'un appel Gemini, dans la forme que l'agent compte (entrée, sortie réflexion comprise). */
const jetonsGemini = (u: Usage): Usage => {
  const x = (u ?? {}) as Record<string, number | undefined>;
  return { input_tokens: x.promptTokenCount ?? 0, output_tokens: (x.candidatesTokenCount ?? 0) + (x.thoughtsTokenCount ?? 0) };
};

/**
 * Le repérage par Gemini seul (17/11) : mêmes règles, même schéma, un seul
 * appel, sans intermédiaire de vision. Essai comparatif du 17/11 : mêmes pièces,
 * types et saisons que le relais Gemini puis Claude, trois fois moins cher et
 * deux fois plus rapide. Une réponse illisible est redemandée une fois.
 */
export function surveyGemini(
  input: { sources: Img[]; hint: string; gender: string | null },
  modeles: string[] = modelesDeVision(),
  opts: { relais?: number } = {},
): Promise<SurveyResult> {
  const systeme = `${SURVEY_SYSTEM}\n\nFORMAT DE RÉPONSE : réponds UNIQUEMENT par un objet JSON valide, sans phrase avant ni après et sans bloc de code, qui respecte ce schéma JSON :\n${JSON.stringify(SURVEY_SCHEMA)}`;
  const valide = (d: unknown) => Array.isArray(d) || Array.isArray((d as { pieces?: unknown })?.pieces);
  const course = new AbortController();
  const delai = opts.relais ?? relaisMs();

  // Un maillon : un modèle, une réponse illisible redemandée une fois.
  const essai = async (model: string): Promise<SurveyResult> => {
    let dernier = '';
    for (let fois = 0; fois < 2; fois++) {
      const r = await geminiVoit({ sources: input.sources, texte: surveyUserText(input), systeme, model, signal: course.signal });
      const data = lireJson(r.texte);
      if (data !== undefined && valide(data)) return lireSurvey(data, jetonsGemini(r.usage), 'google', r.model);
      dernier = r.texte.replace(/\s+/g, ' ').slice(0, 160);
    }
    throw new AgentError(SAY.failed, `Gemini ${model} : JSON illisible (${dernier})`);
  };

  return new Promise((resolve, reject) => {
    const erreurs: unknown[] = [];
    let suivant = 0;
    let enCours = 0;
    let fini = false;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    const finir = () => { fini = true; clearTimeout(minuterie); course.abort(); };
    const lancer = () => {
      if (fini || suivant >= modeles.length) return;
      const model = modeles[suivant++];
      enCours++;
      clearTimeout(minuterie);
      // Pas de réponse dans le délai : le relais suivant part en parallèle.
      if (suivant < modeles.length) minuterie = setTimeout(() => {
        console.warn(`repérage : ${model} n'a pas répondu en ${delai} ms, relais ${modeles[suivant]} lancé en parallèle`);
        lancer();
      }, delai);
      essai(model).then((r) => {
        if (fini) return;
        finir();
        resolve(r);
      }, (err) => {
        enCours--;
        if (fini) return;
        erreurs.push(err);
        console.warn(`repérage : ${model} en échec (${err instanceof AgentError ? err.detail ?? err.message : err})`);
        if (suivant < modeles.length) return lancer();
        if (enCours > 0) return;
        finir();
        // Une panne passagère parmi les échecs : la tâche repartira en file.
        reject(erreurs.find(passager) ?? erreurs[0]);
      });
    };
    lancer();
  });
}

type SurveyResult = { pieces: Target[]; note: string; usage: Usage; fournisseur: 'google' | 'anthropic'; modele: string };

/** Le JSON d'un repérage remis d'aplomb : pièces connues et bornées, une liste seule vaut la liste des pièces. */
function lireSurvey(data: unknown, usage: Usage, fournisseur: SurveyResult['fournisseur'], modele: string): SurveyResult {
  const o = (Array.isArray(data) ? { pieces: data } : data ?? {}) as { pieces?: unknown; note?: unknown };
  const pieces = (Array.isArray(o.pieces) ? o.pieces : [])
    .map(cleanTarget)
    .filter((p): p is Target => p !== null)
    .slice(0, MAX_PIECES);
  return { pieces, note: String(o.note ?? '').trim(), usage, fournisseur, modele };
}

/**
 * Qui repère les pièces : `gemini` (défaut depuis le 17/11) ou `claude`
 * (SURVEY_PROVIDER). Claude reste pour Kodi ; pour le repérage il demande une
 * clé Anthropic directe (derrière un intermédiaire, il ne voit pas les photos).
 */
export const fournisseurDuReperage = (): 'gemini' | 'claude' => (env('SURVEY_PROVIDER') === 'claude' ? 'claude' : 'gemini');

/** Le repérage des pièces d'une photo : un seul appel rapide, la découpe se fait ensuite pièce par pièce. */
export async function survey(input: { sources: Img[]; hint: string; gender: string | null }): Promise<SurveyResult> {
  if (fournisseurDuReperage() === 'gemini') return surveyGemini(input);
  const relais = !claudeVoitLesImages();
  let observation = '';
  if (relais) observation = (await observer(input)).texte;
  const { data, usage } = await askJson({
    model: MODELS.survey,
    effort: EFFORT.survey,
    system: relais ? SURVEY_SYSTEM + RELAIS_SYSTEM : SURVEY_SYSTEM,
    schema: SURVEY_SCHEMA,
    content: relais
      ? [{ type: 'text', text: `Observations de ton collègue sur ${input.sources.length > 1 ? `les ${input.sources.length} photos` : 'la photo'} :\n${observation}\n\n${surveyUserText(input)}` }]
      : [...input.sources.map(imageBlock), { type: 'text', text: surveyUserText(input) }],
    maxTokens: 8_000,
    valide: (d) => Array.isArray(d) || Array.isArray((d as { pieces?: unknown })?.pieces),
    // Reprise : photos en 1568 px, au cas où l'image n'aurait pas passé (inutile pour le relais, sans image).
    reprise: relais ? undefined : () => [...input.sources.map((s) => imageBlock(alleger(s))), { type: 'text', text: surveyUserText(input) }],
  });
  if (!relais) verifierImagesVues(usage, input.sources.length);
  return lireSurvey(data, usage, 'anthropic', MODELS.survey);
}

// ---------------------------------------------------------------- Gemini : segmentation

/**
 * Le masque de segmentation d'UNE pièce (Gemini, modèle de texte et de vision,
 * pas de génération d'image : les pixels restent ceux de la photo). `strong`
 * prend le modèle le plus fort et ne donne pas le cadre de Kodi, pour la
 * reprise après un « rendu incorrect ».
 */
export async function segment(
  photo: Img,
  target: Target,
  opts: { strong: boolean; model?: string; thinking?: Reflexion },
): Promise<{ segments: Segment[]; usage: Usage; model: string; reflexion: Reflexion }> {
  // Chez Google directement quand `GOOGLE_API_KEY` existe, sinon comme le dessin.
  const acces = accesGoogle();
  if (!acces.cle) throw new AgentError(SAY.notReady, `${acces.nomCle} absente des secrets Supabase`);
  const key = acces.cle;
  const model = opts.model ?? (opts.strong ? MODELS.segmentStrong : MODELS.segment);
  const url = geminiUrl(model, 'generateContent', acces.base);

  const hint = !opts.strong && target.box
    ? ` It is roughly inside the box [y0, x0, y1, x1] = [${[target.box[1], target.box[0], target.box[1] + target.box[3], target.box[0] + target.box[2]].map((v) => Math.round(v * 1000)).join(', ')}] (0-1000), but that box is only approximate.`
    : '';
  const text = `Give the segmentation mask of ONE single item in this photo: "${target.name}"${target.where ? ` (${target.where})` : ''}.${hint} Include the whole visible item. Leave out the person (skin, hair, face, hands), the background, every other item even where it touches or overlaps this one, and cast shadows. If the item is a pair (shoes, earrings, gloves), include both. Output a JSON list with exactly one entry: the 2D bounding box in "box_2d" as [y0, x0, y1, x1] normalised to 0-1000, the segmentation mask in "mask", and the text label in "label".`;

  const parts = [
    { inline_data: { mime_type: photo.mime, data: b64(photo.bytes) } },
    { text },
  ];
  const call = (thinking: Reflexion) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ contents: [{ parts }], generationConfig: segmentConfig(model, thinking) }),
    });

  // Le réglage de réflexion demandé, puis, si le modèle le refuse, les suivants
  // de sa famille (un modèle fort ne se laisse pas toujours couper la réflexion).
  const essais = [...new Set([opts.thinking ?? reflexionPour(model), ...(/^gemini-2\.5/.test(model) ? ['aucun' as const] : REPLIS_REFLEXION)])];
  let res: Response;
  let reflexion: Reflexion = essais[0];
  try {
    res = await call(reflexion);
    for (const suivant of essais.slice(1)) {
      if (res.status !== 400) break;
      const body = await res.text();
      if (!/think/i.test(body)) throw httpError('Gemini (découpe)', 400, body);
      reflexion = suivant;
      res = await call(reflexion);
    }
  } catch (err) {
    if (err instanceof AgentError) throw err;
    throw new AgentError(SAY.failed, `Gemini (découpe) injoignable : ${err instanceof Error ? err.message : err}`, true);
  }
  if (!res.ok) throw httpError('Gemini (découpe)', res.status, await res.text());

  const body = await res.json();
  const candidate = body?.candidates?.[0];
  const blocked = body?.promptFeedback?.blockReason ?? (/SAFETY|PROHIBITED|BLOCK/.test(candidate?.finishReason ?? '') ? candidate.finishReason : null);
  if (blocked) throw new AgentError(SAY.refused, `Gemini (découpe) a refusé : ${blocked}`);

  const answer = ((candidate?.content?.parts ?? []) as { text?: string; thought?: boolean }[])
    .filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  return { segments: parseSegments(answer), usage: body?.usageMetadata ?? null, model, reflexion };
}

/**
 * La réflexion d'un modèle Gemini pendant la découpe. Les modèles 2.5 se
 * règlent par un budget (0 : aucune) ; les suivants (3.x, 4) par un niveau
 * (`minimal`, `low`…) et refusent le budget. `aucun` n'envoie rien : le
 * modèle garde son réglage par défaut.
 */
export type Reflexion = 'budget0' | 'minimal' | 'low' | 'aucun';
const REPLIS_REFLEXION: Reflexion[] = ['minimal', 'low', 'aucun'];

export function reflexionPour(model: string): Reflexion {
  const voulu = env('GEMINI_SEGMENT_THINKING');
  if (voulu && ['budget0', 'minimal', 'low', 'aucun'].includes(voulu)) return voulu as Reflexion;
  return /^gemini-2\.5/.test(model) ? 'budget0' : 'minimal';
}

/** La configuration de génération de la découpe. La température 0 ne vaut que pour les 2.5 : Google la déconseille ensuite. */
export function segmentConfig(model: string, r: Reflexion): Record<string, unknown> {
  const ancien = /^gemini-2\.5/.test(model);
  return {
    ...(ancien ? { temperature: 0 } : {}),
    responseMimeType: 'application/json',
    ...(r === 'budget0' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    ...(r === 'minimal' || r === 'low' ? { thinkingConfig: { thinkingLevel: r } } : {}),
  };
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
  name: SecretName,
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

  const claude = anthropicBase();
  const gemini = geminiBase();

  // Chez le fournisseur lui-même, on lit la fiche du modèle. Un intermédiaire
  // n'offre en général que la liste de ses modèles (GET /v1/models) : on y
  // cherche le modèle. Dans les deux cas, aucune génération.
  const listeDe = (base: string) => async (k: string): Promise<string[]> => {
    const b = await (await fetch(`${base}/v1/models?limit=1000`, { headers: headers(k), signal: timeout() })).json();
    return (b.data ?? []).map((m: { id: string }) => m.id).sort();
  };
  const ficheParListe = (base: string, model: string) => async (k: string): Promise<Response> => {
    const res = await fetch(`${base}/v1/models?limit=1000`, { headers: headers(k), signal: timeout() });
    if (!res.ok) return res;
    const ids = ((await res.json()).data ?? []).map((m: { id: string }) => m.id);
    return new Response('{}', { status: ids.includes(model) ? 200 : 404 });
  };

  const claudeProbe = (model: string) => probe(
    'ANTHROPIC_API_KEY', model,
    anthropicViaIntermediaire()
      ? ficheParListe(claude, model)
      : (k) => fetch(`${claude}/v1/models/${model}`, { headers: headers(k), signal: timeout() }),
    listeDe(claude),
  );

  const geminiProbe = (model: string, nomCle: SecretName, base: string) => {
    const chezGoogle = base === GEMINI_OFFICIEL;
    return probe(
      nomCle, model,
      chezGoogle
        ? (k) => fetch(`${base}/v1beta/models/${model}`, { headers: { 'x-goog-api-key': k }, signal: timeout() })
        : ficheParListe(base, model),
      chezGoogle
        ? async (k: string) => {
          const b = await (await fetch(`${base}/v1beta/models?pageSize=1000`, { headers: { 'x-goog-api-key': k }, signal: timeout() })).json();
          return (b.models ?? []).map((m: { name: string }) => m.name.replace(/^models\//, '')).sort();
        }
        : listeDe(base),
    );
  };

  // La découpe a parfois sa propre clé, chez Google (GOOGLE_API_KEY) ; le dessin garde la sienne.
  const dec = accesGoogle();
  const [decoupe, decoupeFort, dessin, repérage] = await Promise.all([
    geminiProbe(MODELS.segment, dec.nomCle, dec.base),
    geminiProbe(MODELS.segmentStrong, dec.nomCle, dec.base),
    geminiProbe(MODELS.gemini, 'GEMINI_API_KEY', gemini),
    claudeProbe(MODELS.survey),
  ]);

  const pret = [decoupe, decoupeFort, dessin, repérage].every((p) => p.cle === 'valide' && p.modele_trouve === true);
  // Seul le fait de passer par un intermédiaire se dit : jamais son adresse
  // (cette route est ouverte).
  return {
    pret,
    intermediaire: { claude: anthropicViaIntermediaire(), dessin: geminiViaIntermediaire(), decoupe: dec.base !== GEMINI_OFFICIEL },
    decoupe, decoupeFort, dessin, reperage: repérage,
  };
}
