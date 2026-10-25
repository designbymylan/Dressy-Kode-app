/**
 * Les contrôles automatiques d'une pièce détourée : du code, pas de modèle,
 * donc instantanés et gratuits. Les seuils sont dans config.ts.
 */
import { contentBox, type Raster } from './cutout.ts';
import { CHECKS } from './config.ts';
import { deltaE2000, dominantColour } from './color.ts';
import { hexRgb, lab } from './prompts.ts';

export type CheckName = 'couverture' | 'une_seule_piece' | 'bord_net' | 'taille' | 'couleur';

export type Checks = {
  ok: boolean;
  failed: CheckName[];
  values: {
    couverture: number;
    une_seule_piece: number;
    bord_net: number;
    taille: number;
    /** ΔE2000 entre la couleur mesurée et celle attendue ; null sans teinte attendue. */
    couleur: number | null;
    mesuree: string | null;
  };
};

/**
 * @param cut        la pièce détourée (opacité = détourage)
 * @param oneShare   part de la surface tenue par les morceaux principaux (cleanSpecks) ; 1 si inconnue
 * @param expectedHex teinte attendue (Kodi), facultative
 */
export function runChecks(cut: Raster, oneShare: number, expectedHex?: string | null): Checks {
  const { width: w, height: h, data } = cut;
  let solid = 0, soft = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] >= 128) solid++;
    if (data[i] > 10 && data[i] < 245) soft++;
  }
  const box = contentBox(cut, 0);
  const side = box ? Math.min(box.w, box.h) : 0;
  const coverage = box ? solid / (box.w * box.h) : 0;
  const softShare = solid ? soft / solid : 1;

  const dominant = dominantColour(cut);
  const target = expectedHex ? hexRgb(expectedHex) : null;
  const dE = dominant && target ? deltaE2000(lab(dominant.rgb), lab(target)) : null;

  const failed: CheckName[] = [];
  if (!solid || coverage < CHECKS.coverage[0] || coverage > CHECKS.coverage[1]) failed.push('couverture');
  if (oneShare < CHECKS.oneShare) failed.push('une_seule_piece');
  if (softShare > CHECKS.softEdgeMax) failed.push('bord_net');
  if (side < CHECKS.minSide) failed.push('taille');
  if (dE !== null && dE > CHECKS.deltaEMax) failed.push('couleur');

  const r = (v: number) => Math.round(v * 1000) / 1000;
  return {
    ok: failed.length === 0,
    failed,
    values: {
      couverture: r(coverage),
      une_seule_piece: r(oneShare),
      bord_net: r(softShare),
      taille: side,
      couleur: dE === null ? null : Math.round(dE * 10) / 10,
      mesuree: dominant?.hex ?? null,
    },
  };
}

/** Les contrôles qui rendent une image inutilisable, quoi qu'il arrive. */
export const BLOCKING: CheckName[] = ['couverture', 'taille'];
