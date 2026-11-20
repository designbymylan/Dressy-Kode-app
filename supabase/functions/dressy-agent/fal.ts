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
