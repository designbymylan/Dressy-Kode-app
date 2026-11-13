/**
 * Le banc d'essai de l'agent photo (13/11), lancé par `_shared/banc.ts` :
 *
 * - `sonde` : ce que le fournisseur sait faire pour l'agent, par l'appel le
 *   moins cher qui le prouve : le vrai repérage (image en entrée, sorties
 *   structurées), les masques de segmentation modèle par modèle, une image
 *   générée (`imageConfig`), les vecteurs de la mémoire de Kodi ;
 * - `decoupe` (F1) : une photo de test, le vrai repérage, puis la vraie
 *   découpe (decoupage.ts) de chaque pièce avec plusieurs modèles de
 *   segmentation, et le détourage par contraste seul pour comparer. Les
 *   pièces découpées sont rangées dans le bucket `banc`, avec un lien signé.
 *
 * Jamais une photo d'utilisateur : seulement des images de test envoyées
 * avec l'essai.
 */
import { survey, segment, generate, checkSetup, MODELS, type Reflexion } from './steps.ts';
import { decouper, ouvrir } from './decoupage.ts';
import { fitOnCanvas } from './normalize.ts';
import { downscale } from './cutout.ts';
import { decode, encodePng } from './codec.ts';
import { vectoriser } from '../_shared/embeddings.ts';
import { geminiViaIntermediaire, anthropicViaIntermediaire } from '../_shared/fournisseurs.ts';
import type { Banc, Modes, Rendu } from '../_shared/banc.ts';

/** Ordres de grandeur en dollars (tarifs publics) : un intermédiaire peut facturer autrement. */
const coutClaude = (u: unknown) => {
  const x = (u ?? {}) as Record<string, number | undefined>;
  return ((x.input_tokens ?? 0) * 2 + (x.output_tokens ?? 0) * 10) / 1e6;
};
const coutGemini = (u: unknown) => {
  const x = (u ?? {}) as Record<string, number | undefined>;
  return ((x.promptTokenCount ?? 0) * 0.3 + ((x.candidatesTokenCount ?? 0) + (x.thoughtsTokenCount ?? 0)) * 2.5) / 1e6;
};
const coutImage = (model: string) => (/2\.1/.test(model) ? 0.034 : 0.067);

const court = (e: unknown) => (e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e)).replace(/\s+/g, ' ').slice(0, 400);

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/**
 * Paramètres : { photo, indice?, modeles: ['gemini-3.6-flash:minimal', …],
 *   contraste?: boolean (vrai par défaut), max_pieces?: number (2) }
 */
async function essaiDecoupe(b: Banc, p: Record<string, unknown>): Promise<Rendu> {
  const photo = String(p.photo ?? '');
  const img = await b.lire(photo);
  let t = Date.now();
  const raster = ouvrir(img);
  const decodage = Date.now() - t;

  t = Date.now();
  const rep = await survey({ sources: [img], hint: String(p.indice ?? ''), gender: null });
  const reperage = Date.now() - t;
  let cost = coutClaude(rep.usage);
  const pieces = rep.pieces.slice(0, Number(p.max_pieces ?? 2));

  const specs = ((p.modeles as string[] | undefined) ?? []).map((s) => s.split(':') as [string, Reflexion | undefined]);
  const essais: [string | null, Reflexion | undefined][] = [...specs, ...(p.contraste === false ? [] : [[null, undefined] as [null, undefined]])];
  const lignes: unknown[] = [];

  for (const [i, piece] of pieces.entries()) {
    for (const [model, thinking] of essais) {
      const nom = model ?? 'contraste';
      try {
        const d = await decouper(img, raster, piece, { strong: false, model: model ?? undefined, thinking, sansMasque: !model }, b.log);
        if (d.segmentation) cost += coutGemini(d.segmentation.usage);
        const url = d.best
          ? await b.ranger(`${slug(photo)}-${i}-${slug(nom)}.png`, encodePng(downscale(fitOnCanvas(d.best.cut), 384)), 'image/png')
          : null;
        lignes.push({
          piece: piece.name, kind: piece.kind, hex: piece.hex, modele: nom, reflexion: d.segmentation?.reflexion ?? null,
          masque: d.segmentation?.masque ?? false, methode: d.best?.method ?? null, ok: d.best?.checks.ok ?? false,
          echecs: d.best?.checks.failed ?? null, valeurs: d.best?.checks.values ?? null, essais: d.essais, ms: d.ms, url,
        });
      } catch (e) {
        lignes.push({ piece: piece.name, modele: nom, erreur: e instanceof Error ? e.message.slice(0, 300) : String(e) });
      }
    }
  }
  return {
    result: { photo, taille: `${raster.width}×${raster.height}`, ms: { decodage, reperage }, reperees: rep.pieces.map((x) => x.name), lignes },
    cost,
  };
}

type Sonde = { nom: string; ok: boolean; ms: number; detail: string; donnees?: unknown };

/**
 * Paramètres : { photo, decoupe?: ['modele:reflexion', …], dessin?: modèle d'image (coûte une image), vecteurs?: boolean }
 */
async function sondes(b: Banc, p: Record<string, unknown>): Promise<Rendu> {
  const out: Sonde[] = [];
  let cost = 0;
  const essai = async (nom: string, f: () => Promise<{ ok: boolean; detail: string; donnees?: unknown; cout?: number }>) => {
    const t = Date.now();
    try {
      const r = await f();
      cost += r.cout ?? 0;
      out.push({ nom, ok: r.ok, ms: Date.now() - t, detail: r.detail, donnees: r.donnees });
    } catch (e) {
      out.push({ nom, ok: false, ms: Date.now() - t, detail: court(e) });
    }
    b.log(`${nom} : ${out.at(-1)!.ok ? 'ok' : 'ÉCHEC'} (${out.at(-1)!.ms} ms) ${out.at(-1)!.detail.slice(0, 160)}`);
  };

  const img = await b.lire(String(p.photo ?? ''));
  let cible: Awaited<ReturnType<typeof survey>>['pieces'][number] | null = null;
  await essai(`reperage ${MODELS.survey}`, async () => {
    const r = await survey({ sources: [img], hint: '', gender: null });
    cible = r.pieces[0] ?? null;
    return {
      ok: r.pieces.length > 0,
      detail: `${r.pieces.length} pièce(s) : ${r.pieces.map((x) => `${x.name} (${x.kind ?? '?'}, ${x.hex?.join('/') ?? ''})`).join(', ')}`,
      donnees: { pieces: r.pieces.map(({ prompt: _p, ...x }) => x), usage: r.usage, octets: img.bytes.length },
      cout: coutClaude(r.usage),
    };
  });

  if (cible) {
    const specs = (p.decoupe as string[] | undefined) ?? ['gemini-3.6-flash:minimal', 'gemini-4-hydrogen:minimal', 'gemini-3.5-flash-lite:minimal'];
    for (const spec of specs) {
      const [model, reflexion] = spec.split(':') as [string, Reflexion | undefined];
      await essai(`masque ${spec}`, async () => {
        const r = await segment(img, cible!, { strong: false, model, thinking: reflexion });
        const masques = r.segments.filter((s) => s.mask);
        let taille = '';
        if (masques[0]?.mask) {
          const bytes = Uint8Array.from(atob(masques[0].mask), (c) => c.charCodeAt(0));
          const m = decode(bytes, bytes[0] === 0x89 ? 'image/png' : 'image/jpeg');
          taille = `${m.width}×${m.height}`;
        }
        return {
          ok: masques.length > 0 && !!taille,
          detail: `${r.segments.length} segment(s), ${masques.length} masque(s)${taille ? ` (${taille})` : ''}, réflexion ${r.reflexion}`,
          donnees: { usage: r.usage, cadres: r.segments.map((s) => s.box) },
          cout: coutGemini(r.usage),
        };
      });
    }
  }

  const dessin = typeof p.dessin === 'string' ? p.dessin : null;
  if (dessin) {
    await essai(`dessin ${dessin}`, async () => {
      const r = await generate('Reproduce only the main garment from this photo, flat lay, centred, on a plain pure white background.', [img], { model: dessin, size: '1K' });
      const url = await b.ranger(`dessin-${dessin}.${r.mime === 'image/png' ? 'png' : 'jpg'}`, r.bytes, r.mime);
      return { ok: r.bytes.length > 10_000, detail: `${Math.round(r.bytes.length / 1024)} Ko, ${r.mime}`, donnees: { url, usage: r.usage }, cout: coutImage(dessin) };
    });
  }

  if (p.vecteurs !== false) {
    await essai('vecteurs', async () => {
      const v = await vectoriser(['aime le denim'], 'RETRIEVAL_QUERY', { timeout: 8000 });
      return { ok: !!v, detail: v ? `${v[0].length} dimensions` : 'aucun vecteur (voir les journaux)' };
    });
  }

  return { result: { intermediaire: { claude: anthropicViaIntermediaire(), gemini: geminiViaIntermediaire() }, modeles: MODELS, sondes: out }, cost };
}

/** La vérification des clés et des modèles (`?verifier`), pour le banc depuis qu'elle est réservée au compte créateur. */
const verifier = async (): Promise<Rendu> => ({ result: await checkSetup(), cost: 0 });

export const MODES_AGENT: Modes = { sonde: sondes, decoupe: essaiDecoupe, verifier };
