/**
 * La sortie standard d'une pièce (spec) : le détourage recadré sur la pièce
 * avec 4 % de marge, 1024 px au plus, la vignette de 256 px, et la couleur
 * médiane des pixels opaques. Logique pure : les pixels viennent de la photo
 * d'origine, seule l'opacité vient du masque. Aucune correction de couleur,
 * aucun fond, aucune ombre (l'app les dessine).
 */
import { downscale, type Raster } from '../dressy-agent/cutout.ts';
import type { Boite, Masque } from './masque.ts';
import { SORTIE } from './reglages.ts';

/**
 * La pièce découpée dans la photo, recadrée sur `boite` plus la marge. Sous un
 * pixel transparent, les couleurs sont mises à zéro : rien du fond ne reste
 * caché dans le fichier.
 */
export function decouper(photo: Raster, masque: Masque, boite: Boite, marge: number = SORTIE.marge): Raster {
  if (photo.width !== masque.largeur || photo.height !== masque.hauteur) throw new Error('masque et photo de tailles différentes');
  const m = Math.round(Math.max(boite.w, boite.h) * marge);
  const W = boite.w + 2 * m, H = boite.h + 2 * m;
  const out = new Uint8Array(W * H * 4);
  const ox = boite.x - m, oy = boite.y - m;
  for (let y = 0; y < H; y++) {
    const sy = oy + y;
    if (sy < 0 || sy >= photo.height) continue;
    for (let x = 0; x < W; x++) {
      const sx = ox + x;
      if (sx < 0 || sx >= photo.width) continue;
      const a = masque.alpha[sy * photo.width + sx];
      if (!a) continue;
      const s = (sy * photo.width + sx) * 4, d = (y * W + x) * 4;
      out[d] = photo.data[s];
      out[d + 1] = photo.data[s + 1];
      out[d + 2] = photo.data[s + 2];
      out[d + 3] = a;
    }
  }
  return { width: W, height: H, data: out };
}

/** Réduit sans jamais agrandir (moyenne pondérée par l'opacité : pas de liseré sombre). */
export const reduire = (r: Raster, cote: number): Raster => downscale(r, cote);

const mediane = (h: Uint32Array, n: number) => {
  let cumul = 0;
  for (let v = 0; v < 256; v++) {
    cumul += h[v];
    if (cumul * 2 >= n) return v;
  }
  return 255;
};

/**
 * La couleur médiane des pixels opaques, canal par canal, en « #rrggbb » (spec :
 * calculée par le code, jamais par le modèle). Null si rien n'est opaque.
 */
export function couleurMediane(r: Raster, seuil = 200): string | null {
  const hr = new Uint32Array(256), hg = new Uint32Array(256), hb = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < r.width * r.height; i++) {
    const o = i * 4;
    if (r.data[o + 3] < seuil) continue;
    hr[r.data[o]]++; hg[r.data[o + 1]]++; hb[r.data[o + 2]]++;
    n++;
  }
  if (!n) return null;
  return `#${[hr, hg, hb].map((h) => mediane(h, n).toString(16).padStart(2, '0')).join('')}`;
}
