/**
 * L'appel au modèle de Kodi, partagé par la fonction `kode` et le banc
 * d'essai (`banc-ia`) : même client, mêmes réglages, même lecture de la
 * réponse. Rien ici ne lit la base.
 *
 * Le client passe par `_shared/fournisseurs.ts` (13/11) : l'adresse de l'API
 * vient du secret ANTHROPIC_BASE_URL quand il existe (intermédiaire), sinon
 * celle d'Anthropic. Avant, Kodi comptait sur la lecture implicite de cette
 * variable par le SDK.
 */
import Anthropic from '@anthropic-ai/sdk';
import { anthropicBase, anthropicViaIntermediaire, lireCle } from '../_shared/fournisseurs.ts';

// Sonnet 5 depuis le 17/11 (décision de l'utilisateur, comparatif au banc : 4,20 de justesse contre 4,11 pour
// Opus 5, 13 s contre 29 s, 0,033 $ contre 0,060 $ la réponse). `KODE_MODEL` le remplace.
export const MODEL = Deno.env.get('KODE_MODEL')?.trim() || 'claude-sonnet-5';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const effortDe = (nom: string, defaut: Effort): Effort => {
  const v = Deno.env.get(nom)?.trim() as Effort | undefined;
  return v && EFFORTS.includes(v) ? v : defaut;
};

/** L'effort par usage : la conversation, la planification de plusieurs jours. */
export const EFFORT = {
  reponse: effortDe('KODE_EFFORT', 'medium'),
  planifier: effortDe('KODE_EFFORT_PLANIFIER', 'medium'),
};

/** Erreur dont le message peut être montré tel quel dans la conversation. */
export class KodeError extends Error {
  constructor(message: string, readonly status = 400, readonly code?: string) {
    super(message);
  }
}

/**
 * Les modèles qui acceptent le repli côté serveur sur un refus de leurs
 * filtres (`server-side-fallback-2026-07-01`, `fallbacks: 'default'`). Avant
 * le 13/11, seul `claude-opus-5` l'avait : passer à Opus 5.5 l'aurait coupé
 * sans bruit.
 */
const AVEC_REPLI = new Set(['claude-opus-5', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5', 'claude-fable-5-1', 'claude-fable-5-2']);

/** Le repli est-il demandé pour ce modèle ? `KODE_REPLI=non` le coupe (intermédiaire qui le refuse). */
export function avecRepli(model: string): boolean {
  if (Deno.env.get('KODE_REPLI')?.trim() === 'non') return false;
  return AVEC_REPLI.has(model);
}

/** Une fois refusé ou fautif chez le fournisseur, le repli n'est plus demandé jusqu'au prochain démarrage. */
let repliRefuse = false;

export type Turn = { role: 'user' | 'assistant'; content: string };
type Schema = Record<string, unknown>;

export type Appel = {
  model?: string;
  effort?: Effort;
  timeout?: number;
  retries?: number;
  maxTokens?: number;
};

const anthropic = (apiKey: string, timeout: number, retries: number) =>
  new Anthropic({ apiKey, baseURL: anthropicBase(), timeout, maxRetries: retries });

/** Ce qu'on lit d'une réponse, qu'elle vienne de l'appel standard ou bêta. */
export type Reponse = {
  model: string;
  stop_reason: string | null;
  content: { type: string; text?: string }[];
  usage: Anthropic.Usage;
};

const texteDe = (r: Reponse) => r.content.map((b) => (b.type === 'text' ? b.text ?? '' : '')).join('');
const estJson = (t: string) => {
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
};

/**
 * Un appel dont la réponse suit `schema` (sorties structurées). Les règles
 * puis le contexte (dressing, profil) : ils bougent peu d'une question à
 * l'autre, le cache évite de les repayer à chaque bulle.
 *
 * Le repli sur refus passe par l'API bêta. Sonde du 13/11 : à travers
 * l'intermédiaire, cet appel perd le format JSON (le modèle répond en texte
 * libre). Le repli n'est donc demandé qu'en direct chez Anthropic, et s'il
 * casse le format malgré tout, il est coupé jusqu'au prochain démarrage et
 * la question repart sans lui.
 */
export async function askClaude(system: string, context: string, turns: Turn[], schema: Schema, opts: Appel = {}): Promise<Reponse> {
  const apiKey = lireCle('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY absent des secrets Supabase');
    throw new KodeError('Kodi n’est pas encore disponible. Réessaie un peu plus tard.', 503);
  }
  const model = opts.model ?? MODEL;
  const c = anthropic(apiKey, opts.timeout ?? 60_000, opts.retries ?? 1);
  // Derrière un intermédiaire (essai du 17/11) : le format JSON strict est ignoré en silence et la
  // réponse arrive en bloc de code. Le schéma passe alors dans la consigne, l'effort reste réglé,
  // et readJson lit la réponse même enrobée. `KODE_FORMAT=schema` rétablit le format strict.
  const dansLaConsigne = anthropicViaIntermediaire() && Deno.env.get('KODE_FORMAT')?.trim() !== 'schema';
  const effort = opts.effort ?? EFFORT.reponse;
  const body = {
    model,
    max_tokens: opts.maxTokens ?? 16000,
    system: [
      { type: 'text' as const, text: dansLaConsigne ? `${system}${formatDansLaConsigne(schema)}` : system },
      { type: 'text' as const, text: context, cache_control: { type: 'ephemeral' as const } },
    ],
    messages: turns,
    output_config: dansLaConsigne ? { effort } : { effort, format: { type: 'json_schema' as const, schema } },
  };
  const standard = async () => (await c.messages.create(body)) as unknown as Reponse;
  // Sans le format strict (intermédiaire), 1 réponse sur 20 environ est un JSON invalide (essai du 17/11,
  // 2 sur 40) : on redemande une fois avant d'échouer.
  const standardLisible = async () => {
    const res = await standard();
    if (dansLaConsigne && res.stop_reason === 'end_turn' && !reponseLisible(res)) {
      console.warn('réponse illisible, appel refait une fois');
      return await standard();
    }
    return res;
  };
  // Si les filtres du modèle refusent la question, l'API la rejoue sur le
  // modèle de repli recommandé au lieu de la perdre.
  const avecLeRepli = async () =>
    (await c.beta.messages.create({ ...body, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })) as unknown as Reponse;

  const repli = avecRepli(model) && !repliRefuse && !anthropicViaIntermediaire();
  try {
    if (!repli) return await standardLisible();
    let res: Reponse;
    try {
      res = await avecLeRepli();
    } catch (err) {
      // Un fournisseur peut refuser l'en-tête bêta ou le champ `fallbacks`.
      if (err instanceof Anthropic.BadRequestError && /fallback|beta/i.test(err.message)) {
        repliRefuse = true;
        console.warn(`repli sur refus refusé par le fournisseur : ${err.message.slice(0, 200)}`);
        return await standard();
      }
      throw err;
    }
    if (res.stop_reason === 'end_turn' && !estJson(texteDe(res))) {
      repliRefuse = true;
      console.warn('repli sur refus : le format JSON n’est pas tenu, appel refait sans repli');
      return await standard();
    }
    return res;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error('Claude refuse la clé :', err.message);
      throw new KodeError('Kodi n’est pas disponible pour le moment. Réessaie un peu plus tard.', 503);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new KodeError('Kodi est très demandé en ce moment. Réessaie dans une minute.', 503);
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      throw new KodeError('Kodi a mis trop de temps à répondre. Réessaie.', 504);
    }
    if (err instanceof Anthropic.APIError) {
      // Un crédit épuisé arrive ici (400) : le détail part dans les journaux.
      console.error(`Claude ${err.status} :`, err.message);
      throw new KodeError('Kodi n’a pas pu répondre. Réessaie dans un moment.', 502);
    }
    throw err;
  }
}

/** La consigne de format quand le schéma ne passe pas par l'option de l'API. */
export const formatDansLaConsigne = (schema: Schema): string =>
  `\n\nFORMAT DE RÉPONSE : réponds UNIQUEMENT par un objet JSON valide, sans phrase avant ni après et sans bloc de code, qui respecte ce schéma JSON :\n${JSON.stringify(schema)}`;

/**
 * Le JSON d'une réponse, même enrobée (17/11) : bloc ```json, phrase avant ou
 * après. Un intermédiaire qui ne tient pas le format strict rend ce genre de
 * réponse, correcte sur le fond. `undefined` si rien de lisible.
 */
export function lireJson(text: string): unknown {
  const brut = text.trim();
  try {
    return JSON.parse(brut);
  } catch { /* enrobé : on cherche le JSON dedans */ }
  const bloc = brut.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  for (const c of [bloc, brut].filter((x): x is string => Boolean(x))) {
    try {
      return JSON.parse(c);
    } catch { /* suite */ }
    const debut = c.indexOf('{');
    const fin = c.lastIndexOf('}');
    if (debut < 0 || fin <= debut) continue;
    try {
      return JSON.parse(c.slice(debut, fin + 1));
    } catch { /* suite */ }
  }
  return undefined;
}

/** La réponse contient-elle un objet JSON lisible ? */
export function reponseLisible(res: Reponse): boolean {
  const data = lireJson(texteDe(res));
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

/** La réponse en JSON ; le refus se lit avant le contenu. */
export function readJson<T>(res: Reponse): Partial<T> {
  if (res.stop_reason === 'refusal') {
    throw new KodeError('Kodi ne peut pas répondre à cette question. Reformule-la autour de tes vêtements.', 422);
  }
  const text = texteDe(res);
  const data = lireJson(text);
  if (data !== undefined && typeof data === 'object' && data !== null && !Array.isArray(data)) return data as Partial<T>;
  console.error(`réponse illisible (${res.stop_reason}) :`, text.slice(0, 300));
  throw new KodeError('La réponse de Kodi est arrivée incomplète. Réessaie.', 502);
}

/** Le modèle qui a vraiment répondu : celui du repli quand il a pris la main. */
export function servedBy(res: Reponse): string {
  const blocs = res.content as unknown as { type: string; to?: { model?: string } }[];
  const repli = blocs.filter((b) => b.type === 'fallback').at(-1)?.to?.model;
  return repli ?? res.model;
}
