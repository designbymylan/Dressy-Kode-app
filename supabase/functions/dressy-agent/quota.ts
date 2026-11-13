/**
 * Les générations d'image (Nano Banana), comptées, plafonnées et mises en
 * cache. Module pur, sans réseau ni base : tout passe par les `ports`
 * que l'agent branche, ce qui permet de tester les règles du brief v6
 * (quota.test.ts) sans rien appeler.
 *
 * Les règles :
 *  - une image déjà dessinée pour la même clé est rendue, sans appel au
 *    générateur et sans rien décompter ;
 *  - sans génération restante, le générateur n'est pas appelé ;
 *  - une génération est prise AVANT l'appel, et rendue si l'appel échoue
 *    ou est refusé ;
 *  - jamais de relance automatique : une erreur remonte telle quelle.
 */

/** À changer quand la consigne de dessin change : l'ancien cache ne sert plus. */
export const PROMPT_VERSION = 'dessin-2'; // 13/11 : « Image propre » part de la pièce découpée

export type Status = 'succes' | 'echec' | 'rejet';

export type Reservation =
  | { ok: true; logId: string; plan: string }
  | { ok: false; plan: string };

export type Ports<I> = {
  /** L'image déjà dessinée pour cette clé, ou null. */
  cacheGet(key: string): Promise<I | null>;
  cachePut(key: string, image: I): Promise<void>;
  /** Prend une génération. { ok: false } : il n'en reste plus. */
  reserve(): Promise<Reservation>;
  /** Clôt la génération : seule une réussite reste décomptée. */
  settle(logId: string, status: Status, costUsd: number): Promise<void>;
  /** Note un appel qui ne prend rien au compteur (image en cache). */
  noteCacheHit(plan: string): Promise<void>;
  /** L'unique appel au générateur. */
  call(plan: string): Promise<I>;
  /** Une erreur du générateur est-elle un refus (contenu bloqué) plutôt qu'une panne ? */
  isRejection(err: unknown): boolean;
  /** Coût estimé en dollars d'une génération pour cette offre. */
  cost(plan: string): number;
};

export type Draw<I> =
  | { kind: 'cache'; image: I }
  | { kind: 'drawn'; image: I; plan: string }
  | { kind: 'empty'; plan: string };

export async function drawWithQuota<I>(key: string, ports: Ports<I>, planHint: string): Promise<Draw<I>> {
  const cached = await ports.cacheGet(key);
  if (cached) {
    await ports.noteCacheHit(planHint).catch(() => undefined);
    return { kind: 'cache', image: cached };
  }

  const taken = await ports.reserve();
  if (!taken.ok) return { kind: 'empty', plan: taken.plan };

  let image: I;
  try {
    image = await ports.call(taken.plan);
  } catch (err) {
    // Rendue : une génération ratée ou refusée ne coûte rien à la personne.
    await ports.settle(taken.logId, ports.isRejection(err) ? 'rejet' : 'echec', 0).catch(() => undefined);
    throw err;
  }
  await ports.settle(taken.logId, 'succes', ports.cost(taken.plan)).catch(() => undefined);
  await ports.cachePut(key, image).catch(() => undefined);
  return { kind: 'drawn', image, plan: taken.plan };
}

/** La clé de cache : photo, pièce visée, modèle, version de la consigne. */
export function cacheKey(parts: { photoHash: string; pieceHash: string; model: string; promptVersion?: string }): string {
  return [parts.photoHash, parts.pieceHash, parts.model, parts.promptVersion ?? PROMPT_VERSION].join(':');
}

/** Les modèles et la taille d'image : le gratuit en 1K (Lite), les abonnées en 2K. */
export function imageSettings(plan: string, models: { free: string; paid: string }): { model: string; size: '1K' | '2K' } {
  return plan === 'decouverte' ? { model: models.free, size: '1K' } : { model: models.paid, size: '2K' };
}

/** Un prix en dollars lu dans l'environnement ; une valeur absente ou illisible prend le repli. */
export function price(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return raw && Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Coût estimé d'un appel de texte, d'après les jetons comptés par le fournisseur. */
export function tokenCost(inTokens: unknown, outTokens: unknown, perMillion: { in: number; out: number }): number {
  const i = Number(inTokens) || 0;
  const o = Number(outTokens) || 0;
  return (i * perMillion.in + o * perMillion.out) / 1_000_000;
}
