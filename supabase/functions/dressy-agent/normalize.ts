/**
 * Mise au format fixe de toutes les pièces : même canevas carré, même marge,
 * pièce centrée et mise à l'échelle. C'est ce qui rend un dressing régulier
 * (une écharpe et un manteau occupent le même cadre). Sans dépendance.
 */
import { contentBox, crop, downscale, type Raster } from './cutout.ts';
import { CUTOUT } from './config.ts';

/**
 * Agrandissement bilinéaire en alpha prémultiplié : sans cela, les pixels
 * transparents (souvent noirs) assombriraient le contour de la pièce.
 */
export function upscale(r: Raster, w: number, h: number): Raster {
  const { width: sw, height: sh, data } = r;
  const out = new Uint8Array(w * h * 4);
  const px = (x: number, y: number, c: number) => {
    const i = (Math.min(sh - 1, Math.max(0, y)) * sw + Math.min(sw - 1, Math.max(0, x))) * 4;
    return c === 3 ? data[i + 3] : data[i + c] * data[i + 3] / 255;
  };
  for (let y = 0; y < h; y++) {
    const fy = ((y + 0.5) * sh) / h - 0.5;
    const y0 = Math.floor(fy), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = ((x + 0.5) * sw) / w - 0.5;
      const x0 = Math.floor(fx), tx = fx - x0;
      const mix = (c: number) =>
        (px(x0, y0, c) * (1 - tx) + px(x0 + 1, y0, c) * tx) * (1 - ty) +
        (px(x0, y0 + 1, c) * (1 - tx) + px(x0 + 1, y0 + 1, c) * tx) * ty;
      const a = mix(3);
      const o = (y * w + x) * 4;
      if (a > 0.5) {
        out[o] = Math.min(255, Math.round((mix(0) * 255) / a));
        out[o + 1] = Math.min(255, Math.round((mix(1) * 255) / a));
        out[o + 2] = Math.min(255, Math.round((mix(2) * 255) / a));
      }
      out[o + 3] = Math.round(a);
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * Recadre au plus juste sur la pièce, la met à l'échelle pour qu'elle
 * remplisse le cadre moins les marges, et la centre sur un canevas carré
 * transparent.
 */
export function fitOnCanvas(cut: Raster, size = CUTOUT.canvas, margin = CUTOUT.margin): Raster {
  const box = contentBox(cut, 0);
  const tight = box ? crop(cut, box) : cut;
  const room = Math.round(size * (1 - 2 * margin));
  const scale = Math.min(room / tight.width, room / tight.height, CUTOUT.maxUpscale);

  const w = Math.max(1, Math.round(tight.width * scale));
  const h = Math.max(1, Math.round(tight.height * scale));
  const fitted = scale < 1
    ? downscale(tight, Math.max(w, h))
    : scale > 1 ? upscale(tight, w, h) : tight;

  const out = new Uint8Array(size * size * 4);
  const ox = Math.floor((size - fitted.width) / 2);
  const oy = Math.floor((size - fitted.height) / 2);
  for (let y = 0; y < fitted.height; y++) {
    const from = y * fitted.width * 4;
    out.set(fitted.data.subarray(from, from + fitted.width * 4), ((oy + y) * size + ox) * 4);
  }
  return { width: size, height: size, data: out };
}

/** L'orientation EXIF d'un JPEG (1 à 8) ; 1 si absente. jpeg-js ne la lit pas. */
export function exifOrientation(bytes: Uint8Array): number {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let p = 2;
  while (p + 4 < bytes.length) {
    if (bytes[p] !== 0xff) return 1;
    const marker = bytes[p + 1];
    const len = (bytes[p + 2] << 8) | bytes[p + 3];
    if (marker === 0xe1 && bytes[p + 4] === 0x45 && bytes[p + 5] === 0x78) {
      const t = p + 10; // début du TIFF, après « Exif\0\0 »
      const le = bytes[t] === 0x49;
      const u16 = (o: number) => (le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
      const u32 = (o: number) => (le ? (u16(o) | (u16(o + 2) << 16)) >>> 0 : ((u16(o) << 16) | u16(o + 2)) >>> 0);
      const ifd = t + u32(t + 4);
      const count = u16(ifd);
      for (let k = 0; k < count; k++) {
        const e = ifd + 2 + k * 12;
        if (e + 12 > bytes.length) return 1;
        if (u16(e) === 0x0112) {
          const v = u16(e + 8);
          return v >= 1 && v <= 8 ? v : 1;
        }
      }
      return 1;
    }
    if (marker === 0xda) return 1; // début des données image
    p += 2 + len;
  }
  return 1;
}

/** Remet une photo debout d'après son orientation EXIF. */
export function orient(r: Raster, o: number): Raster {
  if (o <= 1 || o > 8) return r;
  const { width: w, height: h, data } = r;
  const swap = o >= 5;
  const nw = swap ? h : w, nh = swap ? w : h;
  const out = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let nx = x, ny = y;
      switch (o) {
        case 2: nx = w - 1 - x; break;
        case 3: nx = w - 1 - x; ny = h - 1 - y; break;
        case 4: ny = h - 1 - y; break;
        case 5: nx = y; ny = x; break;
        case 6: nx = h - 1 - y; ny = x; break;
        case 7: nx = h - 1 - y; ny = w - 1 - x; break;
        case 8: nx = y; ny = w - 1 - x; break;
      }
      const from = (y * w + x) * 4, to = (ny * nw + nx) * 4;
      out[to] = data[from]; out[to + 1] = data[from + 1]; out[to + 2] = data[from + 2]; out[to + 3] = data[from + 3];
    }
  }
  return { width: nw, height: nh, data: out };
}
