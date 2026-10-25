/**
 * Mesure de la couleur d'une pièce détourée. Aucune dépendance : tourne
 * telle quelle dans l'Edge Function et dans les tests.
 */
import type { Raster } from './cutout.ts';
import { lab } from './prompts.ts';

/** ΔE 2000 (CIEDE2000) entre deux couleurs CIELAB. */
export function deltaE2000(p: readonly number[], q: readonly number[]): number {
  const [L1, a1, b1] = p, [L2, a2, b2] = q;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number) => {
    if (b === 0 && a === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hue(b1, a1p), h2p = hue(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);

  const Lpm = (L1 + L2) / 2;
  const Cpm = (C1p + C2p) / 2;
  let hpm = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hpm /= 2;
    else hpm = (hpm + (hpm < 360 ? 360 : -360)) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hpm - 30) * rad) + 0.24 * Math.cos(2 * hpm * rad)
    + 0.32 * Math.cos((3 * hpm + 6) * rad) - 0.2 * Math.cos((4 * hpm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2);
  const Sc = 1 + 0.045 * Cpm;
  const Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;

  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

export const toHex = (rgb: readonly number[]) =>
  `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/**
 * La couleur dominante des pixels opaques : la case de 16 niveaux par canal
 * la plus peuplée, puis la moyenne de tous les pixels qui en sont proches
 * (un tissu uni a des ombres et des plis, il ne tient pas dans une case).
 */
export function dominantColour(r: Raster, step = 3): { rgb: [number, number, number]; hex: string; share: number } | null {
  const { width: w, height: h, data } = r;
  const bins = new Uint32Array(4096);
  let n = 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 230) continue;
      bins[((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)]++;
      n++;
    }
  }
  if (n < 20) return null;

  let best = 0;
  for (let b = 1; b < bins.length; b++) if (bins[b] > bins[best]) best = b;
  const centre = [((best >> 8) << 4) + 8, (((best >> 4) & 15) << 4) + 8, ((best & 15) << 4) + 8];
  const labCentre = lab(centre);

  let sum = [0, 0, 0], m = 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 230) continue;
      const px = [data[i], data[i + 1], data[i + 2]];
      if (deltaE2000(lab(px), labCentre) > 14) continue;
      sum = [sum[0] + px[0], sum[1] + px[1], sum[2] + px[2]];
      m++;
    }
  }
  if (!m) return null;
  const rgb = sum.map((v) => Math.round(v / m)) as [number, number, number];
  return { rgb, hex: toHex(rgb), share: m / n };
}
