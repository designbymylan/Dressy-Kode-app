import { Buffer } from 'node:buffer';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { downscale, type Raster } from './cutout.ts';

/** Le type annoncé par une API n'est pas toujours le bon : on lit la signature. */
export function sniffMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  return null;
}

export function decode(bytes: Uint8Array, mime: string): Raster {
  if (mime === 'image/png') {
    const png = PNG.sync.read(Buffer.from(bytes));
    return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
  }
  if (mime === 'image/jpeg') {
    // Pas de copie : avec `useTArray`, `img.data` est déjà un Uint8Array (12 Mo de moins pour 3 Mpx).
    const img = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
    return { width: img.width, height: img.height, data: img.data as Uint8Array };
  }
  throw new Error(`format d'image non géré : ${mime}`);
}

/**
 * Largeur et hauteur d'une photo lues dans son en-tête, sans la décoder (JPEG :
 * marqueur SOF ; PNG : bloc IHDR). `null` si l'en-tête n'est pas lisible.
 * Sert à refuser une photo trop grande AVANT de la décoder : jpeg-js demande
 * environ 55 octets par pixel au pic, et une Edge Function plafonne à 256 Mo.
 */
export function tailleImage(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes.length >= 24) {
    const u32 = (o: number) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
    return { width: u32(16), height: u32(20) };
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let p = 2;
  while (p + 9 < bytes.length) {
    if (bytes[p] !== 0xff) { p++; continue; }
    const marker = bytes[p + 1];
    if (marker === 0xff) { p++; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (bytes[p + 5] << 8) | bytes[p + 6], width: (bytes[p + 7] << 8) | bytes[p + 8] };
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { p += 2; continue; }
    p += 2 + ((bytes[p + 2] << 8) | bytes[p + 3]);
  }
  return null;
}

export function encodePng(r: Raster): Uint8Array {
  const png = new PNG({ width: r.width, height: r.height });
  png.data.set(r.data);
  return new Uint8Array(PNG.sync.write(png));
}

/**
 * La photo en version légère pour le repérage : 1568 px au plus, JPEG. C'est
 * la taille que Claude lit pleinement ; au-delà, un intermédiaire peut refuser
 * le corps de la requête ou perdre l'image. Le cadre des pièces est en
 * fractions, il ne dépend pas de la taille. Une image illisible (WebP) est
 * rendue telle quelle.
 */
export function alleger(img: { bytes: Uint8Array; mime: string }, cote = 1568): { bytes: Uint8Array; mime: string } {
  try {
    const r = downscale(decode(img.bytes, img.mime), cote);
    const jpg = jpeg.encode({ data: r.data, width: r.width, height: r.height }, 80);
    return { bytes: new Uint8Array(jpg.data), mime: 'image/jpeg' };
  } catch {
    return img;
  }
}
