/**
 * Les modèles d'étiquetage, branchés sur `etiquetage.ts` :
 *
 *   claude : Claude Haiku 5.5 (`claude-haiku-5-5`, choix de la spec), sortie
 *            structurée imposée par le schéma de la taxonomie. Il ne voit les
 *            photos qu'avec une clé Anthropic directe : derrière l'intermédiaire
 *            actuel (ANTHROPIC_BASE_URL), Claude lit l'image comme du texte
 *            (constaté le 17/11).
 *   gemini : Gemini Flash-Lite en chaîne de relais (le premier qui répond
 *            gagne), qui voit bien les photos par l'intermédiaire.
 *
 * Qui étiquette : le secret ETIQUETEUR (`claude` ou `gemini`) ; sans lui,
 * Claude dès que la clé Anthropic est directe (ou CLAUDE_VOIT_LES_IMAGES=1),
 * Gemini sinon. Rien de la personne ne part avec la photo (ni nom, ni e-mail).
 */
import Anthropic from '@anthropic-ai/sdk';
import { accesGoogle, anthropicBase, anthropicViaIntermediaire, geminiUrl, lireCle } from '../_shared/fournisseurs.ts';
import { course, listeDeModeles } from '../_shared/relais.ts';
import { schemaEtiquetage } from '../_shared/taxonomy.ts';
import { price, tokenCost } from '../dressy-agent/quota.ts';
import type { Appel } from './etiquetage.ts';
import { ETIQUETAGE } from './reglages.ts';

export const HAIKU = 'claude-haiku-5-5';
export const RELAIS_ETIQUETAGE = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-3.5-flash'];

const env = (nom: string) => Deno.env.get(nom)?.trim() || undefined;

export function etiqueteur(): 'claude' | 'gemini' {
  const choix = env('ETIQUETEUR');
  if (choix === 'claude' || choix === 'gemini') return choix;
  return !anthropicViaIntermediaire() || env('CLAUDE_VOIT_LES_IMAGES') === '1' ? 'claude' : 'gemini';
}

const PRIX = {
  claude: { in: price(env('COST_HAIKU_IN_PER_M_USD'), 0.10), out: price(env('COST_HAIKU_OUT_PER_M_USD'), 0.50) },
  gemini: { in: price(env('COST_GEMINI_IN_PER_M_USD'), 0.3), out: price(env('COST_GEMINI_OUT_PER_M_USD'), 2.5) },
};

const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Le JSON d'une réponse, même entouré d'un bloc de code ou d'une phrase. */
export function lireObjet(texte: string): unknown {
  const debut = texte.indexOf('{');
  const fin = texte.lastIndexOf('}');
  if (debut < 0 || fin <= debut) return undefined;
  try {
    return JSON.parse(texte.slice(debut, fin + 1));
  } catch {
    return undefined;
  }
}

const FORMAT = (schema: unknown) =>
  `\n\nFORMAT DE RÉPONSE : réponds UNIQUEMENT par un objet JSON valide, sans phrase ni bloc de code, qui respecte ce schéma JSON :\n${JSON.stringify(schema)}`;

// ---------------------------------------------------------------- Claude

let client: Anthropic | null = null;

export function appelClaude(jpeg: Uint8Array): Appel {
  const cle = lireCle('ANTHROPIC_API_KEY');
  return async (consigne) => {
    if (!cle) throw new Error('ANTHROPIC_API_KEY absente des secrets');
    client ??= new Anthropic({ apiKey: cle, baseURL: anthropicBase(), timeout: ETIQUETAGE.delaiMs, maxRetries: 0 });
    const res = await client.messages.create({
      model: env('ETIQUETAGE_MODELE_CLAUDE') ?? HAIKU,
      max_tokens: 1024,
      // Une classification courte : sans réflexion (accepté par Haiku 5.5 à l'effort par défaut).
      thinking: { type: 'disabled' },
      system: consigne,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64(jpeg) } },
          { type: 'text', text: 'Étiquette cette pièce.' },
        ],
      }],
      output_config: { format: { type: 'json_schema', schema: schemaEtiquetage() as unknown as Record<string, unknown> } },
    } as Anthropic.MessageCreateParamsNonStreaming);
    if (res.stop_reason === 'refusal') throw new Error(`Claude a refusé (${JSON.stringify(res.stop_details ?? null)})`);
    if (res.stop_reason === 'max_tokens') throw new Error('Claude : réponse coupée');
    const texte = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    return {
      brut: lireObjet(texte),
      modele: res.model ?? HAIKU,
      coutUsd: tokenCost(res.usage?.input_tokens, res.usage?.output_tokens, PRIX.claude),
    };
  };
}

// ---------------------------------------------------------------- Gemini

/** Un fournisseur qui refuse `responseJsonSchema` : on ne le lui redemande plus (par instance). */
let sansSchemaNatif = false;

async function unAppelGemini(model: string, jpeg: Uint8Array, consigne: string, signal: AbortSignal) {
  const acces = accesGoogle();
  if (!acces.cle) throw new Error(`${acces.nomCle} absente des secrets`);
  const schema = schemaEtiquetage();
  const appeler = (natif: boolean, reflexion: boolean) => fetch(geminiUrl(model, 'generateContent', acces.base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': acces.cle! },
    signal: AbortSignal.any([AbortSignal.timeout(ETIQUETAGE.delaiMs), signal]),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: consigne + FORMAT(schema) }] },
      contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: b64(jpeg) } }, { text: 'Étiquette cette pièce.' }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        ...(natif ? { responseJsonSchema: schema } : {}),
        ...(reflexion ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
      },
    }),
  });
  let res = await appeler(!sansSchemaNatif, true);
  if (res.status === 400) {
    const t = await res.clone().text();
    if (/schema/i.test(t) && !sansSchemaNatif) { sansSchemaNatif = true; res = await appeler(false, true); }
    else if (/think/i.test(t)) res = await appeler(!sansSchemaNatif, false);
  }
  if (!res.ok) throw new Error(`Gemini ${model} ${res.status} : ${(await res.text()).replace(/\s+/g, ' ').slice(0, 200)}`);
  const body = await res.json();
  const c = body?.candidates?.[0];
  const bloque = body?.promptFeedback?.blockReason ?? (/SAFETY|PROHIBITED|BLOCK/.test(c?.finishReason ?? '') ? c.finishReason : null);
  if (bloque) throw new Error(`Gemini ${model} a refusé : ${bloque}`);
  const texte = ((c?.content?.parts ?? []) as { text?: string; thought?: boolean }[]).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  const u = body?.usageMetadata ?? {};
  return {
    brut: lireObjet(texte),
    modele: model,
    coutUsd: tokenCost(u.promptTokenCount, (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0), PRIX.gemini),
  };
}

export function appelGemini(jpeg: Uint8Array): Appel {
  const modeles = listeDeModeles(env('ETIQUETAGE_MODELES'), RELAIS_ETIQUETAGE);
  return (consigne) => course('étiquetage', modeles, (model, signal) => unAppelGemini(model, jpeg, consigne, signal), ETIQUETAGE.relaisMs);
}

export const appelPour = (qui: 'claude' | 'gemini', jpeg: Uint8Array): Appel => (qui === 'claude' ? appelClaude(jpeg) : appelGemini(jpeg));
