/**
 * La découpe d'une pièce dans sa photo, sans base ni rangement : partagée par
 * l'agent (index.ts) et son banc d'essai (banc.ts), qui essaie plusieurs
 * modèles sur les mêmes photos avec exactement ce code.
 *
 * Depuis le 20/11, avec la clé `FAL_KEY` : SAM 3 d'abord (sam.ts, fal.ts), un
 * seul appel, dont les masques sont départagés par les contrôles automatiques.
 * S'il ne rend rien d'utilisable : détourage par contraste du cadre repéré
 * (local, gratuit), sans autre appel d'IA. Sans clé fal.ai : masque de Gemini
 * (clé Google directe seulement), puis contraste ; le meilleur est gardé. Une
 * image sans couverture ou trop petite n'est jamais gardée.
 */
import { garmentRgbs, type Target } from './prompts.ts';
import { segment, AgentError, SAY, type Img, type Reflexion, type Usage } from './steps.ts';
import { cutoutBackground, crop, downscale, type Raster } from './cutout.ts';
import { decode, encodeJpeg, sniffMime } from './codec.ts';
import { exifOrientation, orient } from './normalize.ts';
import { cleanSpecks, cutFromMask, pickSegment, pixelBox } from './segment.ts';
import { BLOCKING, runChecks, type Checks } from './checks.ts';
import { accesGoogle, GEMINI_OFFICIEL, lireCle } from '../_shared/fournisseurs.ts';
import { FalError, octetsDuMasque, segmenterSam, SAM_MODELE } from './fal.ts';
import { cadreDansZone, carteDuMasque, choisirMasques, estPaire, reunir, samPrompt, zoneSam } from './sam.ts';

export type Cand = { method: 'sam' | 'masque' | 'contraste'; cut: Raster; checks: Checks };

/** Ce que l'appel à SAM 3 a donné, pour le journal de la pièce et les mesures. */
export type InfoSam = { model: string; prompt: string; masques: number; scores: (number | null)[]; choix: number[] | null; zone: string; ok: boolean };

export type Decoupe = {
  best: Cand | null;
  cands: Cand[];
  ms: Record<string, number>;
  /** L'appel de segmentation, quand il a eu lieu (pour les mesures). */
  segmentation: { model: string; usage: Usage; reflexion: Reflexion; masque: boolean } | null;
  /** L'appel à SAM 3, quand il a eu lieu (même sans masque utilisable : il est payé). */
  sam: InfoSam | null;
  essais: { methode: string; echecs: string[] }[];
};

/** La clé fal.ai : avec elle, la découpe passe par SAM 3 (20/11). */
export const cleFal = (): string | undefined => lireCle('FAL_KEY');

const bloque = (c: Cand) => c.checks.failed.some((f) => BLOCKING.includes(f));

/** Au-delà, la zone est réduite avant l'envoi : SAM 3 travaille vers 1 000 px, le masque est étiré ensuite. */
const COTE_SAM = 1536;

/**
 * SAM 3 sur la zone de la pièce : un appel, puis les trois masques les plus
 * probables découpés et contrôlés, jusqu'au premier qui passe tous les
 * contrôles. Les pixels viennent de la photo à pleine résolution.
 */
async function parSam(raster: Raster, target: Target, strong: boolean, cle: string, log: (m: string) => void): Promise<{ cands: Cand[]; info: InfoSam; ms: Record<string, number> }> {
  const ms: Record<string, number> = {};
  const zone = zoneSam(strong ? null : target.box, raster.width, raster.height);
  const region = crop(raster, zone);
  const envoi = Math.max(region.width, region.height) > COTE_SAM ? downscale(region, COTE_SAM) : region;
  const prompt = samPrompt(target);

  const r = await segmenterSam({ bytes: encodeJpeg(envoi, 90), mime: 'image/jpeg' }, prompt, { cle });
  ms.sam = r.ms;
  const cadre = !strong && target.box ? cadreDansZone(target.box, zone, raster.width, raster.height) : null;
  const choix = choisirMasques(r.masques, cadre, estPaire(target));
  const info: InfoSam = {
    model: SAM_MODELE, prompt, masques: r.masques.length, scores: r.masques.map((m) => m.score),
    choix: null, zone: `${zone.w}×${zone.h}`, ok: false,
  };

  const t = Date.now();
  const cartes = new Map<number, Raster>();
  const carte = async (i: number) => {
    if (!cartes.has(i)) {
      const bytes = await octetsDuMasque(r.masques[i].source);
      cartes.set(i, carteDuMasque(decode(bytes, sniffMime(bytes) ?? 'image/png')));
    }
    return cartes.get(i)!;
  };
  const expected = target.hex?.[0] ?? null;
  const cands: Cand[] = [];
  for (const c of choix) {
    const masque = reunir(await Promise.all(c.map(carte)));
    const { cut, oneShare } = cleanSpecks(cutFromMask(region, masque, [0, 0, 1, 1], { x: 0, y: 0, w: region.width, h: region.height }));
    const cand: Cand = { method: 'sam', cut, checks: runChecks(cut, oneShare, expected) };
    cands.push(cand);
    if (!info.choix && !bloque(cand)) info.choix = c;
    if (cand.checks.ok) {
      info.choix = c;
      break;
    }
  }
  ms.masque = Date.now() - t;
  info.ok = cands.some((c) => !bloque(c));
  const best = cands.find((c) => c.checks.ok) ?? cands.find((c) => !bloque(c));
  log(`SAM 3 « ${prompt} » sur ${info.zone} : ${r.masques.length} masque(s) en ${r.ms} ms, ${best ? `contrôles ${best.checks.ok ? 'ok' : best.checks.failed.join(', ')}` : 'aucun utilisable'}`);
  return { cands, info, ms };
}

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
  opts: { strong: boolean; model?: string; thinking?: Reflexion; sansMasque?: boolean; sam?: boolean; relancerSiPanne?: boolean },
  log: (m: string) => void = () => {},
): Promise<Decoupe> {
  const ms: Record<string, number> = {};
  const expected = target.hex?.[0] ?? null;
  const cands: Cand[] = [];
  let segmentation: Decoupe['segmentation'] = null;
  let sam: InfoSam | null = null;

  // SAM 3 (20/11) : par défaut dès que la clé fal.ai est là ; le banc le force
  // (`sam: true`, SAM seul) ou l'écarte (un modèle Gemini nommé, ou le contraste seul).
  const cle = cleFal();
  const avecSam = !!cle && (opts.sam ?? (!opts.model && !opts.sansMasque));
  if (avecSam) {
    try {
      const r = await parSam(raster, target, opts.strong, cle!, log);
      cands.push(...r.cands);
      Object.assign(ms, r.ms);
      sam = r.info;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      sam = { model: SAM_MODELE, prompt: samPrompt(target), masques: 0, scores: [], choix: null, zone: '', ok: false };
      // Clé refusée : rien ne marchera, la tâche échoue et le dit (journaux).
      if (err instanceof FalError && (err.status === 401 || err.status === 403)) throw new AgentError(SAY.notReady, `fal.ai refuse la clé : ${detail}`);
      // Panne passagère : la tâche repart en file, sauf au dernier passage (repli ci-dessous).
      if (err instanceof FalError && err.passager && opts.relancerSiPanne) throw new AgentError(SAY.busy, detail, true);
      log(`SAM 3 impossible (${detail}) : repli`);
    }
  }
  const samBon = cands.find((c) => c.method === 'sam' && c.checks.ok) ?? cands.find((c) => c.method === 'sam' && !bloque(c));
  if (samBon || opts.sam) {
    // SAM 3 a rendu une pièce utilisable (même si un contrôle secondaire tique,
    // la couleur sous un éclairage chaud par exemple) : rien d'autre n'est appelé.
    return { best: samBon ?? null, cands, ms, segmentation, sam, essais: cands.map((c) => ({ methode: c.method, echecs: c.checks.failed })) };
  }

  // Chez un intermédiaire, Gemini rend le cadre mais jamais le masque (essais du
  // 17/11, 8 modèles, 23 à 60 s l'appel) : on passe directement au contraste.
  // Une clé Google directe (GOOGLE_API_KEY) rend les masques ; `model` forcé (banc) les essaie quand même.
  const sansMasque = opts.sansMasque || (!opts.model && accesGoogle().base !== GEMINI_OFFICIEL);
  if (!sansMasque && !avecSam) try {
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
  return { best, cands, ms, segmentation, sam, essais };
}
