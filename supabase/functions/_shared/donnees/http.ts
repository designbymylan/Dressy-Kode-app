/**
 * Un appel HTTP vers une source : 8 secondes au plus, une identification
 * claire (MET Norway, Nominatim et Wikimedia la demandent), et une erreur
 * lisible dans les journaux quand ça ne répond pas.
 */

export const DELAI_MS = 8000;

type EnvLike = { get(name: string): string | undefined };
const denoEnv = (globalThis as { Deno?: { env: EnvLike } }).Deno?.env;
const nodeEnv = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;

/** Une variable d'environnement côté serveur, sous Deno (Edge Functions) comme sous Node (tests). */
export function env(name: string): string | undefined {
  return (denoEnv ? denoEnv.get(name) : nodeEnv?.[name])?.trim() || undefined;
}

/** L'identité envoyée aux sources. Changeable sans toucher au code : secret DATA_USER_AGENT. */
export const userAgent = () => env('DATA_USER_AGENT') ?? 'Dresskode/0.1 (designbymylan@gmail.com)';

export class ErreurSource extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.status = status;
  }
}

export async function getJson<T = unknown>(url: string, headers: Record<string, string> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': userAgent(), Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(DELAI_MS),
    });
  } catch (e) {
    const nom = (e as Error).name;
    throw new ErreurSource(nom === 'TimeoutError' || nom === 'AbortError' ? `pas de réponse en ${DELAI_MS / 1000} s` : `réseau : ${(e as Error).message}`);
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new ErreurSource(`HTTP ${res.status}`, res.status);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ErreurSource('réponse illisible (JSON attendu)', res.status);
  }
}

/** Arrête la lecture d'une réponse dont un champ attendu manque : la source a changé de format. */
export function exiger<T>(valeur: T | null | undefined, champ: string): T {
  if (valeur === null || valeur === undefined || (typeof valeur === 'number' && Number.isNaN(valeur))) {
    throw new ErreurSource(`champ manquant : ${champ}`);
  }
  return valeur;
}

/** Fait tourner des appels avec au plus `n` en même temps (Wikimedia refuse les rafales). */
export async function parLots<A, R>(items: A[], n: number, f: (a: A) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const k = i++;
      try {
        out[k] = { status: 'fulfilled', value: await f(items[k]) };
      } catch (reason) {
        out[k] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}
