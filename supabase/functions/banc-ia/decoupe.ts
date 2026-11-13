/**
 * Essai de découpe (F1, 13/11) : une photo de test, le vrai repérage, puis la
 * vraie découpe (decoupage.ts) de chaque pièce avec plusieurs modèles de
 * segmentation, et le détourage par contraste seul pour comparer. Les pièces
 * découpées sont rangées dans le bucket `banc`, avec un lien signé.
 *
 * Paramètres : { photo, indice?, modeles: ['gemini-3.6-flash:minimal', …],
 *   contraste?: boolean (vrai par défaut), max_pieces?: number (2) }
 */
import { survey, MODELS, type Reflexion } from '../dressy-agent/steps.ts';
import { decouper, ouvrir } from '../dressy-agent/decoupage.ts';
import { fitOnCanvas } from '../dressy-agent/normalize.ts';
import { downscale } from '../dressy-agent/cutout.ts';
import { encodePng } from '../dressy-agent/codec.ts';
import { coutClaude, coutGemini } from './tarifs.ts';
import type { Banc, Rendu } from './index.ts';

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export async function essaiDecoupe(b: Banc, p: Record<string, unknown>): Promise<Rendu> {
  const photo = String(p.photo ?? '');
  const img = await b.lire(photo);
  let t = Date.now();
  const raster = ouvrir(img);
  const decodage = Date.now() - t;

  t = Date.now();
  const rep = await survey({ sources: [img], hint: String(p.indice ?? ''), gender: null });
  const reperage = Date.now() - t;
  let cost = coutClaude(MODELS.survey, rep.usage);
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
