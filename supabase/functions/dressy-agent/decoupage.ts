/**
 * La découpe d'une pièce dans sa photo, sans base ni rangement : partagée par
 * l'agent (index.ts) et son banc d'essai (banc.ts), qui essaie plusieurs
 * modèles sur les mêmes photos avec exactement ce code.
 *
 * Masque de Gemini d'abord ; si les contrôles automatiques le refusent, un
 * détourage par contraste du cadre repéré ; le meilleur des deux est gardé.
 * Une image sans couverture ou trop petite n'est jamais gardée.
 */
import { garmentRgbs, type Target } from './prompts.ts';
import { segment, AgentError, SAY, type Img, type Reflexion, type Usage } from './steps.ts';
import { cutoutBackground, crop, downscale, type Raster } from './cutout.ts';
import { decode, sniffMime } from './codec.ts';
import { exifOrientation, orient } from './normalize.ts';
import { cleanSpecks, cutFromMask, pickSegment, pixelBox } from './segment.ts';
import { BLOCKING, runChecks, type Checks } from './checks.ts';

export type Cand = { method: 'masque' | 'contraste'; cut: Raster; checks: Checks };

export type Decoupe = {
  best: Cand | null;
  cands: Cand[];
  ms: Record<string, number>;
  /** L'appel de segmentation, quand il a eu lieu (pour les mesures). */
  segmentation: { model: string; usage: Usage; reflexion: Reflexion; masque: boolean } | null;
  essais: { methode: string; echecs: string[] }[];
};

const bytesOf = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
/** Erreurs qui arrêtent tout : inutile de tenter le contraste, la tâche doit être reprise plus tard. */
export const fatal = (err: unknown) => err instanceof AgentError && (err.message === SAY.busy || err.message === SAY.notReady);

/**
 * La photo, décodée, remise debout (jpeg-js ne lit pas l'orientation EXIF) et
 * ramenée à 1 800 px au plus : la pièce finit sur un canevas de 1 024 px, et
 * le temps de calcul d'une Edge Function est compté (un iPhone envoie 12 Mpx).
 */
export function ouvrir(photo: Img): Raster {
  if (photo.mime !== 'image/jpeg' && photo.mime !== 'image/png') throw new AgentError(SAY.photo, `format non géré : ${photo.mime}`);
  const raster = decode(photo.bytes, photo.mime);
  const upright = photo.mime === 'image/jpeg' ? orient(raster, exifOrientation(photo.bytes)) : raster;
  return Math.max(upright.width, upright.height) > 2000 ? downscale(upright, 1800) : upright;
}

/**
 * Découpe `target` dans `photo`. `strong` : reprise après un « rendu
 * incorrect » (modèle fort, sans le cadre du repérage). `model` et `thinking`
 * forcent un modèle et un réglage de réflexion (banc d'essai).
 */
export async function decouper(
  photo: Img,
  raster: Raster,
  target: Target,
  opts: { strong: boolean; model?: string; thinking?: Reflexion; sansMasque?: boolean },
  log: (m: string) => void = () => {},
): Promise<Decoupe> {
  const ms: Record<string, number> = {};
  const expected = target.hex?.[0] ?? null;
  const cands: Cand[] = [];
  let segmentation: Decoupe['segmentation'] = null;

  if (!opts.sansMasque) try {
    let t = Date.now();
    const seg = await segment(photo, target, opts);
    ms.segmentation = Date.now() - t;
    const chosen = pickSegment(seg.segments, opts.strong ? null : target.box);
    segmentation = { model: seg.model, usage: seg.usage, reflexion: seg.reflexion, masque: !!chosen?.mask };
    if (!chosen?.mask) {
      log(`segmentation (${seg.model}) : aucun masque`);
    } else {
      t = Date.now();
      const maskBytes = bytesOf(chosen.mask);
      const mask = decode(maskBytes, sniffMime(maskBytes) ?? 'image/png');
      const region = pixelBox(chosen.box, raster.width, raster.height);
      const { cut, oneShare } = cleanSpecks(cutFromMask(raster, mask, chosen.box, region));
      cands.push({ method: 'masque', cut, checks: runChecks(cut, oneShare, expected) });
      ms.masque = Date.now() - t;
      log(`segmentation (${seg.model}) : ${ms.segmentation} ms, contrôles ${cands[0].checks.ok ? 'ok' : cands[0].checks.failed.join(', ')}`);
    }
  } catch (err) {
    if (fatal(err)) throw err;
    log(`segmentation impossible (${err instanceof AgentError ? err.detail ?? err.message : err instanceof Error ? err.message : err}) : repli sur le contraste`);
  }

  if (!cands.some((c) => c.checks.ok)) {
    const t = Date.now();
    const region = target.box ? pixelBox(target.box, raster.width, raster.height, 0.08) : { x: 0, y: 0, w: raster.width, h: raster.height };
    const lit = cutoutBackground(crop(raster, region), { garment: garmentRgbs(target.colors, target.hex) });
    const { cut, oneShare } = cleanSpecks(lit);
    cands.push({ method: 'contraste', cut, checks: runChecks(cut, oneShare, expected) });
    ms.contraste = Date.now() - t;
    log(`détourage par contraste : contrôles ${cands.at(-1)!.checks.ok ? 'ok' : cands.at(-1)!.checks.failed.join(', ')}`);
  }

  const essais = cands.map((c) => ({ methode: c.method, echecs: c.checks.failed }));
  const usable = cands.filter((c) => !c.checks.failed.some((f) => BLOCKING.includes(f)));
  const best = usable.find((c) => c.checks.ok) ?? [...usable].sort((a, b) => a.checks.failed.length - b.checks.failed.length)[0] ?? null;
  return { best, cands, ms, segmentation, essais };
}
