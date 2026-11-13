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

export const MODEL = Deno.env.get('KODE_MODEL')?.trim() || 'claude-opus-5';

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

/** Une fois refusé par le fournisseur, le repli n'est plus demandé jusqu'au prochain démarrage. */
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

/**
 * Un appel dont la réponse suit `schema` (sorties structurées). Les règles
 * puis le contexte (dressing, profil) : ils bougent peu d'une question à
 * l'autre, le cache évite de les repayer à chaque bulle.
 */
export async function askClaude(system: string, context: string, turns: Turn[], schema: Schema, opts: Appel = {}) {
  const apiKey = lireCle('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY absent des secrets Supabase');
    throw new KodeError('Kodi n’est pas encore disponible. Réessaie un peu plus tard.', 503);
  }
  const model = opts.model ?? MODEL;
  const c = anthropic(apiKey, opts.timeout ?? 60_000, opts.retries ?? 1);
  const body = (repli: boolean) => ({
    model,
    max_tokens: opts.maxTokens ?? 16000,
    system: [
      { type: 'text' as const, text: system },
      { type: 'text' as const, text: context, cache_control: { type: 'ephemeral' as const } },
    ],
    messages: turns,
    output_config: { effort: opts.effort ?? EFFORT.reponse, format: { type: 'json_schema' as const, schema } },
    // Si les filtres du modèle refusent la question, l'API la rejoue sur le
    // modèle de repli recommandé au lieu de la perdre.
    ...(repli ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  });

  const repli = avecRepli(model) && !repliRefuse;
  try {
    try {
      return await c.beta.messages.create(body(repli));
    } catch (err) {
      // Un intermédiaire peut refuser l'en-tête bêta ou le champ `fallbacks` :
      // on le note une fois et on repart sans, plutôt que de perdre la question.
      if (repli && err instanceof Anthropic.BadRequestError && /fallback|beta/i.test(err.message)) {
        repliRefuse = true;
        console.warn(`repli sur refus refusé par le fournisseur${anthropicViaIntermediaire() ? ' (intermédiaire)' : ''} : ${err.message.slice(0, 200)}`);
        return await c.beta.messages.create(body(false));
      }
      throw err;
    }
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

/** La réponse en JSON ; le refus se lit avant le contenu. */
export function readJson<T>(res: Anthropic.Beta.BetaMessage): Partial<T> {
  if (res.stop_reason === 'refusal') {
    throw new KodeError('Kodi ne peut pas répondre à cette question. Reformule-la autour de tes vêtements.', 422);
  }
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  try {
    return JSON.parse(text);
  } catch {
    console.error(`réponse illisible (${res.stop_reason}) :`, text.slice(0, 300));
    throw new KodeError('La réponse de Kodi est arrivée incomplète. Réessaie.', 502);
  }
}

/** Le modèle qui a vraiment répondu : celui du repli quand il a pris la main. */
export function servedBy(res: Anthropic.Beta.BetaMessage): string {
  const blocs = res.content as unknown as { type: string; to?: { model?: string } }[];
  const repli = blocs.filter((b) => b.type === 'fallback').at(-1)?.to?.model;
  return repli ?? res.model;
}
