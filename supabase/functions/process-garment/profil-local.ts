// Profil du calcul local (essai, jamais déployé) : où part le temps de calcul d'un traitement.
import { decode, sniffMime } from '../dressy-agent/codec.ts';
import { analyser, etirer, opaciteDe } from './masque.ts';
import { epurer } from './epuration.ts';
import { couleurMediane, decouper, reduire } from './normaliser.ts';
import { encoderWebp } from './webp.ts';
const [photoP, masqueP, samP] = Deno.args;
const photoB = await Deno.readFile(photoP), masqueB = await Deno.readFile(masqueP), samB = await Deno.readFile(samP);
await encoderWebp({ width: 2, height: 2, data: new Uint8Array(16) }, 90); // chargement du wasm, hors mesure
for (let tour = 0; tour < 3; tour++) {
  const t: Record<string, number> = {};
  let t0 = performance.now();
  const mark = (k: string) => { const n = performance.now(); t[k] = Math.round(n - t0); t0 = n; };
  const photo = decode(photoB, 'image/jpeg'); mark('jpeg');
  const rendu = decode(masqueB, sniffMime(masqueB)!); mark('png masque');
  let alpha = etirer(opaciteDe(rendu), rendu.width, rendu.height, photo.width, photo.height); mark('opacité');
  const sams = [0, 1, 2].map(() => { const r = decode(samB, 'image/png'); return { alpha: opaciteDe(r), largeur: r.width, hauteur: r.height, score: 0.9 }; }); mark('sam x3');
  const e = epurer(alpha, sams, photo.width, photo.height); if (e.appliquee) alpha = e.alpha; mark('épuration');
  const { analyse, propre } = analyser({ largeur: photo.width, hauteur: photo.height, alpha }); mark('analyse');
  const piece = reduire(decouper(photo, propre, analyse.boite!, 0.04), 1024); mark('découpe');
  const vignette = reduire(piece, 256); mark('vignette');
  await encoderWebp(piece, 90); mark('webp');
  await encoderWebp(vignette, 85); mark('webp vignette');
  couleurMediane(piece); mark('couleur');
  console.log(JSON.stringify(t), 'total', Object.values(t).reduce((a, b) => a + b, 0));
}
