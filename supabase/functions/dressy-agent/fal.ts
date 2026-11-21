/**
 * L'appel à fal.ai (20/11) : SAM 3, qui rend les masques d'une pièce sur une
 * photo. Sans dépendance ni accès à l'environnement (la clé et `fetch` sont
 * passés en paramètres) : ce fichier tourne tel quel dans les tests (Node).
 *
 * Un seul appel par pièce, aucune relance ici : une panne passagère (délai,
 * réseau, 429, 5xx) remonte comme telle et la tâche repart en file au passage
 * suivant (`passager`, index.ts), trois passages au plus.
 *
 * Ce que fal.ai garde (documentation lue le 20/11) :
 * - `X-Fal-Store-IO: 0` : la requête (donc la photo) n'est PAS gardée dans
 *   l'historique du compte, où elle resterait 90 jours par défaut ;
 * - `sync_mode` : les masques reviennent dans la réponse (data URI), sans
 *   second téléchargement ; si un fichier passe malgré tout par leur CDN, il
 *   expire au bout d'une heure (`X-Fal-Object-Lifecycle-Preference`, sinon
 *   gardé sans limite par défaut).
 * Restent chez eux les métadonnées (identifiant, durée, facturation). Une
 * rétention nulle garantie (ZDR) se demande à leur équipe commerciale.
 */

export const SAM_MODELE = 'fal-ai/sam-3/image';
/** Prix public relevé le 20/11 (page du modèle) ; le secret COST_SAM_USD le remplace. */
export const SAM_PRIX = 0.005;
const URL_SAM = `https://fal.run/${SAM_MODELE}`;

export class FalError extends Error {
  // Champs déclarés à part : Node (tests) n'accepte pas les propriétés de paramètre.
  readonly status: number | null;
  readonly passager: boolean;
  constructor(message: string, status: number | null, passager: boolean) {
    super(message);
    this.status = status;
    this.passager = passager;
  }
}

/** Ce qu'une réponse de SAM 3 dit d'un masque. `source` : data URI ou adresse https. */
export type MasqueSam = { source: string; box: number[] | null; score: number | null };

/** Lit la réponse de SAM 3, quelle que soit la forme des métadonnées (`metadata`, ou `scores` et `boxes`). */
export function lireReponseSam(json: unknown): MasqueSam[] {
  const r = (json ?? {}) as { masks?: { url?: string }[]; metadata?: { index?: number; box?: number[] | null; score?: number | null }[] | null; scores?: (number | null)[] | null; boxes?: (number[] | null)[] | null };
  const masques = Array.isArray(r.masks) ? r.masks : [];
  const meta = Array.isArray(r.metadata) ? r.metadata : [];
  const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const cadre = (v: unknown) => (Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? v as number[] : null);
  return masques.flatMap((m, i) => {
    if (!m?.url || typeof m.url !== 'string') return [];
    const md = meta.find((x) => x?.index === i) ?? meta[i] ?? null;
    return [{
      source: m.url,
      box: cadre(md?.box) ?? cadre(r.boxes?.[i]),
      score: nombre(md?.score) ?? nombre(r.scores?.[i]),
    }];
  });
}

/** Les octets d'un masque : décodés d'un data URI, ou téléchargés. */
export async function octetsDuMasque(source: string, f: typeof fetch = fetch): Promise<Uint8Array> {
  const data = /^data:[^;,]+;base64,(.*)$/s.exec(source);
  if (data) return Uint8Array.from(atob(data[1]), (c) => c.charCodeAt(0));
  if (!/^https:\/\//.test(source)) throw new FalError('masque illisible', null, false);
  const r = await f(source, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new FalError(`téléchargement du masque : ${r.status}`, r.status, r.status >= 500 || r.status === 429);
  return new Uint8Array(await r.arrayBuffer());
}

const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/**
 * Demande à SAM 3 les masques de `prompt` sur une image (JPEG ou PNG).
 * Jusqu'à six masques, avec leur cadre et leur confiance.
 */
export async function segmenterSam(
  image: { bytes: Uint8Array; mime: string },
  prompt: string,
  opts: { cle: string; fetch?: typeof fetch; delaiMs?: number; maxMasques?: number },
): Promise<{ masques: MasqueSam[]; ms: number }> {
  const f = opts.fetch ?? fetch;
  const t = Date.now();
  let res: Response;
  try {
    res = await f(URL_SAM, {
      method: 'POST',
      headers: {
        Authorization: `Key ${opts.cle}`,
        'Content-Type': 'application/json',
        'X-Fal-Store-IO': '0',
        'X-Fal-Object-Lifecycle-Preference': JSON.stringify({ expiration_duration_seconds: 3600 }),
      },
      body: JSON.stringify({
        image_url: `data:${image.mime};base64,${b64(image.bytes)}`,
        prompt,
        apply_mask: false,
        sync_mode: true,
        output_format: 'png',
        return_multiple_masks: true,
        max_masks: opts.maxMasques ?? 6,
        include_scores: true,
        include_boxes: true,
      }),
      signal: AbortSignal.timeout(opts.delaiMs ?? 45_000),
    });
  } catch (err) {
    // Délai dépassé ou réseau coupé : passager.
    throw new FalError(`SAM 3 injoignable : ${err instanceof Error ? err.message : err}`, null, true);
  }
  const texte = await res.text();
  if (!res.ok) {
    const detail = `SAM 3 ${res.status} : ${texte.replace(/\s+/g, ' ').slice(0, 300)}`;
    throw new FalError(detail, res.status, res.status === 429 || res.status >= 500);
  }
  let json: unknown;
  try {
    json = JSON.parse(texte);
  } catch {
    throw new FalError(`SAM 3 : réponse illisible (${texte.slice(0, 120)})`, res.status, true);
  }
  return { masques: lireReponseSam(json), ms: Date.now() - t };
}

/**
 * Le repérage chez fal.ai (21/11, demandé par l'utilisateur) : un modèle de
 * vision (Gemini par défaut) qui regarde la photo et répond en texte, par le
 * routeur `openrouter/router/vision`. Même compte, même clé et mêmes garanties
 * que SAM 3 et le dessin : requête non gardée (`X-Fal-Store-IO: 0`). Ce routeur
 * n'a pas de sortie JSON stricte : le schéma passe dans la consigne et la
 * réponse est lue avec tolérance (`lireJson`). Le secret `REPERAGE_FAL` choisit
 * le modèle, ou `0` pour ne plus passer par fal.
 */
export const VISION_FAL = 'openrouter/router/vision';
export const REPERAGE_FAL_DEFAUT = 'google/gemini-2.5-flash';

export async function voirFal(opts: {
  cle: string;
  modele: string;
  texte: string;
  systeme?: string;
  images: { bytes: Uint8Array; mime: string }[];
  signal?: AbortSignal;
  fetch?: typeof fetch;
  delaiMs?: number;
}): Promise<{ texte: string; ms: number; usage: { prompt_tokens: number; completion_tokens: number } | null }> {
  const f = opts.fetch ?? fetch;
  const t = Date.now();
  const delai = AbortSignal.timeout(opts.delaiMs ?? 45_000);
  let res: Response;
  try {
    res = await f(`https://fal.run/${VISION_FAL}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${opts.cle}`,
        'Content-Type': 'application/json',
        'X-Fal-Store-IO': '0',
        'X-Fal-Object-Lifecycle-Preference': JSON.stringify({ expiration_duration_seconds: 3600 }),
      },
      body: JSON.stringify({
        model: opts.modele,
        prompt: opts.texte,
        ...(opts.systeme ? { system_prompt: opts.systeme } : {}),
        image_urls: opts.images.map((i) => `data:${i.mime};base64,${b64(i.bytes)}`),
        reasoning: false,
        // Un repérage doit donner la même fiche pour la même photo : peu de hasard.
        temperature: 0.2,
        max_tokens: 8000,
      }),
      signal: opts.signal ? AbortSignal.any([delai, opts.signal]) : delai,
    });
  } catch (err) {
    throw new FalError(`repérage fal ${opts.modele} injoignable : ${err instanceof Error ? err.message : err}`, null, true);
  }
  const texte = await res.text();
  if (!res.ok) {
    throw new FalError(`repérage fal ${opts.modele} ${res.status} : ${texte.replace(/\s+/g, ' ').slice(0, 300)}`, res.status, res.status === 429 || res.status >= 500);
  }
  let json: { output?: unknown; usage?: { prompt_tokens?: number; completion_tokens?: number } | null };
  try {
    json = JSON.parse(texte);
  } catch {
    throw new FalError(`repérage fal ${opts.modele} : réponse illisible (${texte.slice(0, 120)})`, res.status, true);
  }
  const sortie = typeof json.output === 'string' ? json.output.trim() : '';
  if (!sortie) throw new FalError(`repérage fal ${opts.modele} : réponse vide`, 200, true);
  const u = json.usage;
  return { texte: sortie, ms: Date.now() - t, usage: u ? { prompt_tokens: u.prompt_tokens ?? 0, completion_tokens: u.completion_tokens ?? 0 } : null };
}

/**
 * Le dessin chez fal.ai (21/11) : le même Nano Banana 2.1, par un autre accès
 * que l'intermédiaire, qui répondait 429 (« service occupé ») à tous les
 * modèles d'image le 21/11 au matin. Mêmes garanties que SAM 3 : requête non
 * gardée (`X-Fal-Store-IO: 0`), image rendue dans la réponse (`sync_mode`),
 * fichier éventuel de leur CDN effacé après une heure. Le secret `DESSIN_FAL`
 * choisit un autre modèle de fal, ou `0` pour ne plus passer par fal.
 */
export const DESSIN_FAL_DEFAUT = 'google/nano-banana-2.1/edit';

export async function dessinerFal(
  prompt: string,
  images: { bytes: Uint8Array; mime: string }[],
  opts: { cle: string; modele?: string; resolution: '1K' | '2K'; recherche?: boolean; signal?: AbortSignal; fetch?: typeof fetch; delaiMs?: number },
): Promise<{ bytes: Uint8Array; ms: number; description: string }> {
  const f = opts.fetch ?? fetch;
  const t = Date.now();
  const modele = opts.modele ?? DESSIN_FAL_DEFAUT;
  const delai = AbortSignal.timeout(opts.delaiMs ?? 75_000);
  let res: Response;
  try {
    res = await f(`https://fal.run/${modele}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${opts.cle}`,
        'Content-Type': 'application/json',
        'X-Fal-Store-IO': '0',
        'X-Fal-Object-Lifecycle-Preference': JSON.stringify({ expiration_duration_seconds: 3600 }),
      },
      body: JSON.stringify({
        prompt,
        image_urls: images.map((i) => `data:${i.mime};base64,${b64(i.bytes)}`),
        num_images: 1,
        resolution: opts.resolution,
        aspect_ratio: '1:1',
        output_format: 'png',
        sync_mode: true,
        enable_web_search: Boolean(opts.recherche),
      }),
      signal: opts.signal ? AbortSignal.any([delai, opts.signal]) : delai,
    });
  } catch (err) {
    throw new FalError(`dessin fal ${modele} injoignable : ${err instanceof Error ? err.message : err}`, null, true);
  }
  const texte = await res.text();
  if (!res.ok) {
    throw new FalError(`dessin fal ${modele} ${res.status} : ${texte.replace(/\s+/g, ' ').slice(0, 300)}`, res.status, res.status === 429 || res.status >= 500);
  }
  let json: { images?: { url?: string }[]; description?: string };
  try {
    json = JSON.parse(texte);
  } catch {
    throw new FalError(`dessin fal ${modele} : réponse illisible (${texte.slice(0, 120)})`, res.status, true);
  }
  const source = json.images?.[0]?.url;
  // Aucune image : la consigne ou la photo a été refusée (statut 200 sans image).
  if (!source) throw new FalError(`dessin fal ${modele} : aucune image (${String(json.description ?? '').slice(0, 160)})`, 200, false);
  return { bytes: await octetsDuMasque(source, f), ms: Date.now() - t, description: String(json.description ?? '') };
}
