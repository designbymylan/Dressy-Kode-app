/**
 * L'encodage WebP avec transparence (spec : cutout en qualité 90, vignette),
 * par libwebp en WebAssembly (@jsquash/webp, dépendance accordée le 20/11).
 * Le .wasm est embarqué (vendor/) et compilé une fois par instance.
 */
import encode, { init } from '@jsquash/webp/encode';
import type { Raster } from '../dressy-agent/cutout.ts';
import { WEBP_ENC_SIMD_B64 } from './vendor/webp_enc_simd.ts';

let pret: Promise<unknown> | null = null;

function charger(): Promise<unknown> {
  pret ??= (async () => {
    const octets = Uint8Array.from(atob(WEBP_ENC_SIMD_B64), (c) => c.charCodeAt(0));
    return await init(await WebAssembly.compile(octets));
  })().catch((err) => {
    pret = null;
    throw err;
  });
  return pret;
}

export async function encoderWebp(r: Raster, qualite: number): Promise<Uint8Array> {
  await charger();
  const data = new Uint8ClampedArray(r.data.buffer, r.data.byteOffset, r.data.byteLength);
  // Méthode 2 (sur 0 à 6) : deux fois plus rapide que la méthode par défaut (4), pour un fichier
  // à peine plus lourd ; le temps de calcul de la fonction est compté (banc du 21/11).
  const sortie = await encode({ data, width: r.width, height: r.height, colorSpace: 'srgb' } as ImageData, { quality: qualite, alpha_quality: 100, method: 2 });
  return new Uint8Array(sortie);
}
