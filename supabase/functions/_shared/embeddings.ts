/**
 * Les vecteurs de sens : chaque souvenir de Kodi (un cœur, une tenue écartée)
 * et chaque question sont transformés en une liste de 768 nombres, pour
 * retrouver les souvenirs proches d'une question (table `kodi_faits`).
 *
 * Fournisseur : l'API Gemini, déjà utilisée pour le dessin des pièces, avec
 * la même clé (`GEMINI_API_KEY`). Seuls des textes courts partent, jamais
 * l'image, le nom ni l'e-mail de la personne.
 *
 * À 768 dimensions, l'API ne normalise pas les vecteurs : on le fait ici,
 * sinon la distance cosinus de la base n'a pas de sens.
 */

export const DIMENSIONS = 768;
const MODELE = 'gemini-embedding-001';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODELE}:batchEmbedContents`;
/** Au-delà, un lot coûte trop cher en un seul appel. */
export const LOT_MAX = 50;

/** Un vecteur de longueur 1, pour que la distance cosinus compare des sens et non des longueurs. */
export function normaliser(v: number[]): number[] {
  const norme = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norme === 0 ? v : v.map((x) => x / norme);
}

/** Le vecteur écrit comme pgvector le lit : « [0.12,-0.3,…] ». */
export const versPgvector = (v: number[]) => `[${v.join(',')}]`;

/**
 * Les vecteurs d'une liste de textes. `RETRIEVAL_DOCUMENT` pour les souvenirs
 * qu'on range, `RETRIEVAL_QUERY` pour la question qu'on pose. Rend `null`
 * si le service ne répond pas : Kodi répond alors sans souvenirs, sans
 * bloquer la conversation.
 */
export async function vectoriser(
  textes: string[],
  tache: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY',
  opts: { timeout?: number } = {},
): Promise<number[][] | null> {
  const cle = Deno.env.get('GEMINI_API_KEY');
  if (!cle || !textes.length) return null;
  if (textes.length > LOT_MAX) throw new Error(`vectoriser : ${textes.length} textes, ${LOT_MAX} au plus par appel`);

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': cle },
      body: JSON.stringify({
        requests: textes.map((text) => ({
          model: `models/${MODELE}`,
          content: { parts: [{ text }] },
          taskType: tache,
          outputDimensionality: DIMENSIONS,
        })),
      }),
      signal: AbortSignal.timeout(opts.timeout ?? 6000),
    });
    if (!res.ok) {
      console.warn(`vectoriser : le service répond ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { embeddings?: { values?: number[] }[] };
    const out = (json.embeddings ?? []).map((e) => normaliser(e.values ?? []));
    if (out.length !== textes.length || out.some((v) => v.length !== DIMENSIONS)) {
      console.warn('vectoriser : réponse inattendue');
      return null;
    }
    return out;
  } catch (err) {
    console.warn('vectoriser :', err instanceof Error ? err.message : err);
    return null;
  }
}
