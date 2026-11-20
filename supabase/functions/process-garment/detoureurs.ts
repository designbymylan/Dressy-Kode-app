/**
 * Les services de détourage, comparés au banc (spec, étape 3). Les deux sont
 * chez fal.ai (clé `FAL_KEY` déjà en place, contrat à accepter : voir
 * docs/rgpd/README.md) et ne redessinent rien : ils rendent un masque, que
 * l'on applique aux pixels de la photo d'origine.
 *
 *   birefnet : BiRefNet v2, « masque seul » (`mask_only`) : seul le masque
 *              revient, nos pixels ne passent jamais par leur rendu.
 *              Prix : facturé au temps de calcul, page du modèle peu claire
 *              le 20/11 ; COST_BIREFNET_USD règle l'estimation (à vérifier
 *              sur la facture fal).
 *   bria     : RMBG 2.0 de Bria, rend la pièce détourée (PNG avec alpha) ;
 *              0,018 $ l'image (page du modèle, 20/11).
 *
 * Mêmes en-têtes que SAM 3 (fal.ts) : rien n'est gardé dans l'historique du
 * compte, fichiers éventuels de leur CDN effacés après une heure.
 *
 * Sans dépendance ni accès à l'environnement : tourne tel quel dans les tests.
 */
import { FalError, octetsDuMasque } from '../dressy-agent/fal.ts';
import { FOURNISSEUR } from './reglages.ts';

export type IdDetoureur = 'birefnet' | 'bria';

export const DETOUREURS: Record<IdDetoureur, { modele: string; prix: number; corps: (image: string) => Record<string, unknown> }> = {
  birefnet: {
    modele: 'fal-ai/birefnet/v2',
    prix: 0.002,
    corps: (image_url) => ({
      image_url,
      model: 'General Use (Light)',
      operating_resolution: '1024x1024',
      output_format: 'png',
      mask_only: true,
      sync_mode: true,
    }),
  },
  bria: {
    modele: 'fal-ai/bria/background/remove',
    prix: 0.018,
    corps: (image_url) => ({ image_url, sync_mode: true }),
  },
};

export const estDetoureur = (x: unknown): x is IdDetoureur => typeof x === 'string' && x in DETOUREURS;

const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Un appel : l'image (JPEG) part, le PNG du masque (ou de la pièce détourée) revient. */
export async function detourerUneFois(
  id: IdDetoureur,
  jpeg: Uint8Array,
  opts: { cle: string; fetch?: typeof fetch; delaiMs?: number },
): Promise<Uint8Array> {
  const f = opts.fetch ?? fetch;
  const d = DETOUREURS[id];
  let res: Response;
  try {
    res = await f(`https://fal.run/${d.modele}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${opts.cle}`,
        'Content-Type': 'application/json',
        'X-Fal-Store-IO': '0',
        'X-Fal-Object-Lifecycle-Preference': JSON.stringify({ expiration_duration_seconds: 3600 }),
      },
      body: JSON.stringify(d.corps(`data:image/jpeg;base64,${b64(jpeg)}`)),
      signal: AbortSignal.timeout(opts.delaiMs ?? FOURNISSEUR.delaiMs),
    });
  } catch (err) {
    throw new FalError(`${id} injoignable : ${err instanceof Error ? err.message : err}`, null, true);
  }
  const texte = await res.text();
  if (!res.ok) throw new FalError(`${id} ${res.status} : ${texte.replace(/\s+/g, ' ').slice(0, 300)}`, res.status, res.status === 429 || res.status >= 500);
  let json: { image?: { url?: unknown } };
  try {
    json = JSON.parse(texte);
  } catch {
    throw new FalError(`${id} : réponse illisible (${texte.slice(0, 120)})`, res.status, true);
  }
  const url = json?.image?.url;
  if (typeof url !== 'string') throw new FalError(`${id} : pas d'image dans la réponse`, res.status, true);
  return await octetsDuMasque(url, f);
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Le détourage avec ses reprises (spec : délai de 15 s ou erreur du service,
 * deux nouvelles tentatives après 2 s puis 5 s). Une erreur qui ne passera
 * pas en réessayant (clé refusée, image refusée) s'arrête tout de suite.
 */
export async function detourer(
  id: IdDetoureur,
  jpeg: Uint8Array,
  opts: { cle: string; fetch?: typeof fetch; delaiMs?: number; attentes?: readonly number[]; dormir?: (ms: number) => Promise<void> },
): Promise<{ png: Uint8Array; essais: number; erreurs: string[] }> {
  const attentes = opts.attentes ?? FOURNISSEUR.attentes;
  const pause = opts.dormir ?? dormir;
  const erreurs: string[] = [];
  for (let essai = 0; ; essai++) {
    try {
      const png = await detourerUneFois(id, jpeg, opts);
      return { png, essais: essai + 1, erreurs };
    } catch (err) {
      erreurs.push(err instanceof Error ? err.message : String(err));
      const passager = err instanceof FalError ? err.passager : true;
      if (!passager || essai >= attentes.length) {
        throw Object.assign(err instanceof Error ? err : new Error(String(err)), { essais: essai + 1, erreurs });
      }
      await pause(attentes[essai]);
    }
  }
}
