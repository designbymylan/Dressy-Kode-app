/**
 * node supabase/functions/dressy-agent/decoupe.test.ts
 *
 * La chaîne de découpe sans réseau : lecture de la réponse de Gemini,
 * masque → pièce, nettoyage, contrôles automatiques, couleur, mise au
 * format fixe. Même contrainte que agent.test.ts : aucun module à dépendance.
 */
import type { Raster } from './cutout.ts';
import { contentBox } from './cutout.ts';
import { CUTOUT } from './config.ts';
import { deltaE2000, dominantColour } from './color.ts';
import { exifOrientation, fitOnCanvas, orient } from './normalize.ts';
import { cleanSpecks, cutFromMask, overlap, parseSegments, pickSegment, pixelBox } from './segment.ts';
import { runChecks } from './checks.ts';
import { lab } from './prompts.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` : attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
};
const near = (label: string, got: number, want: number, tol: number) => check(label, Math.abs(got - want) <= tol, true);

const solid = (w: number, h: number, rgba: number[]): Raster => {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return { width: w, height: h, data };
};
const paint = (r: Raster, x0: number, y0: number, x1: number, y1: number, rgba: number[]) => {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) r.data.set(rgba, (y * r.width + x) * 4);
};
const alphaAt = (r: Raster, x: number, y: number) => r.data[(y * r.width + x) * 4 + 3];

// ---------------------------------------------------------------- ΔE 2000
// Paires de référence de Sharma, Wu et Dalal (2005).

near('ΔE2000 Sharma #1', deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485]), 2.0425, 0.001);
near('ΔE2000 Sharma #7 (teintes proches du bleu)', deltaE2000([50, 2.5, 0], [73, 25, -18]), 27.1492, 0.001);
near('ΔE2000 identique = 0', deltaE2000(lab([180, 120, 60]), lab([180, 120, 60])), 0, 1e-9);
check('ΔE2000 blanc/noir ≈ 100', Math.round(deltaE2000(lab([255, 255, 255]), lab([0, 0, 0]))), 100);

// ---------------------------------------------------------------- couleur dominante

const tee = solid(60, 60, [0, 0, 0, 0]);
paint(tee, 10, 10, 50, 50, [176, 131, 63, 255]); // camel
paint(tee, 20, 20, 30, 30, [250, 250, 250, 255]); // un imprimé blanc
const dom = dominantColour(tee, 1);
check('dominante : le camel, pas l\'imprimé', dom?.hex, '#B0833F');
check('dominante : rien d\'opaque → null', dominantColour(solid(40, 40, [9, 9, 9, 0])), null);

// Un tissu uni a des ombres et des plis : la dominante en tient compte.
const shaded = solid(60, 60, [0, 0, 0, 0]);
for (let y = 10; y < 50; y++) for (let x = 10; x < 50; x++) {
  const v = 150 + ((x + y) % 7) * 3;
  shaded.data.set([v, 40, 40, 255], (y * 60 + x) * 4);
}
const rd = dominantColour(shaded, 1)!;
near('dominante d\'un uni ombré : rouge moyen', rd.rgb[0], 159, 8);

// ---------------------------------------------------------------- réponse de Gemini

const reponse = '```json\n[{"box_2d":[100,200,600,800],"label":"jean","mask":"data:image/png;base64,AAAA"},{"box_2d":[0,0,5,5],"mask":"x"},{"box_2d":"?"}]\n```';
const segs = parseSegments(reponse);
check('réponse lue malgré les balises ; cadre minuscule et entrée abîmée écartés', segs.length, 1);
check('cadre [y0,x0,y1,x1] en millièmes → [x,y,w,h] en fractions', segs[0].box.map((v) => Math.round(v * 1000) / 1000), [0.2, 0.1, 0.6, 0.5]);
check('préfixe data: retiré du masque', segs[0].mask, 'AAAA');
check('texte sans liste → rien', parseSegments('Je ne vois rien.'), []);
check('JSON cassé → rien', parseSegments('[{"box_2d": [1,2'), []);

check('recouvrement : mêmes cadres', overlap([0.1, 0.1, 0.4, 0.4], [0.1, 0.1, 0.4, 0.4]), 1);
check('recouvrement : cadres disjoints', overlap([0, 0, 0.2, 0.2], [0.5, 0.5, 0.2, 0.2]), 0);
const deux = [
  { box: [0.0, 0.0, 0.3, 0.3] as [number, number, number, number], mask: 'a', label: 'haut' },
  { box: [0.5, 0.5, 0.4, 0.4] as [number, number, number, number], mask: 'b', label: 'bas' },
];
check('segment choisi : celui du cadre de Kodi', pickSegment(deux, [0.55, 0.5, 0.35, 0.4])?.label, 'bas');
check('segment choisi sans cadre : le plus grand', pickSegment(deux, null)?.label, 'bas');
check('aucun masque utilisable → null', pickSegment([{ box: [0, 0, 1, 1], mask: null, label: '' }], null), null);

const pb = pixelBox([0.1, 0.2, 0.5, 0.4], 1000, 500, 0);
check('cadre en pixels', pb, { x: 100, y: 100, w: 500, h: 200 });
const pb2 = pixelBox([0, 0, 1, 1], 1000, 500, 0.04);
check('cadre élargi borné à la photo', pb2, { x: 0, y: 0, w: 1000, h: 500 });

// ---------------------------------------------------------------- masque → pièce
// Photo 200×100 fond gris, une veste rouge dans [60,20]-[140,90]. Le masque
// rendu par Gemini est plus petit que le cadre (32×32) : on l'étire.

const photo = solid(200, 100, [120, 120, 120, 255]);
paint(photo, 60, 20, 140, 90, [180, 30, 40, 255]);
const mask = solid(32, 32, [0, 0, 0, 255]);
paint(mask, 2, 2, 30, 30, [255, 255, 255, 255]); // probabilité 255 au centre
const box = [0.3, 0.2, 0.4, 0.7] as const;
const region = pixelBox(box, 200, 100, 0.1);
const cutRaw = cutFromMask(photo, mask, box, region);
const mid = cutRaw.data.subarray(((50 - region.y) * region.w + (100 - region.x)) * 4, ((50 - region.y) * region.w + (100 - region.x)) * 4 + 4);
check('les pixels sont ceux de la photo, opaques au centre', Array.from(mid), [180, 30, 40, 255]);
check('hors du cadre du segment : transparent', alphaAt(cutRaw, 0, 0), 0);
const edgeA = alphaAt(cutRaw, 60 - region.x + 1, 55 - region.y);
check('le bord est adouci (ni tout noir ni tout blanc)', edgeA >= 0 && edgeA < 255, true);

// ---------------------------------------------------------------- poussière et trous

const brut = solid(100, 100, [200, 50, 50, 0]);
paint(brut, 20, 20, 80, 80, [200, 50, 50, 255]);    // la pièce
paint(brut, 45, 45, 49, 49, [200, 50, 50, 0]);      // petit trou (reflet)
paint(brut, 90, 5, 93, 8, [200, 50, 50, 255]);       // poussière
const net = cleanSpecks(brut);
check('poussière effacée', alphaAt(net.cut, 91, 6), 0);
check('petit trou rebouché', alphaAt(net.cut, 46, 46), 255);
check('pièce intacte', alphaAt(net.cut, 30, 30), 255);
near('part des morceaux principaux ≈ 99,7 %', net.oneShare, 0.997, 0.003);

// Une anse (grand trou) reste ouverte ; une paire garde ses deux pièces.
const anse = solid(100, 100, [10, 10, 10, 0]);
paint(anse, 20, 40, 80, 90, [10, 10, 10, 255]);
paint(anse, 30, 10, 70, 40, [10, 10, 10, 255]);
paint(anse, 40, 20, 60, 40, [10, 10, 10, 0]);
check('anse ouverte conservée', alphaAt(cleanSpecks(anse).cut, 50, 25), 0);

const paire = solid(100, 40, [10, 10, 10, 0]);
paint(paire, 5, 5, 40, 35, [10, 10, 10, 255]);
paint(paire, 60, 5, 95, 35, [10, 10, 10, 255]);
const p = cleanSpecks(paire);
check('paire : les deux pièces gardées', [alphaAt(p.cut, 20, 20), alphaAt(p.cut, 80, 20)], [255, 255]);
check('paire : une seule pièce au sens du contrôle', p.oneShare, 1);

// ---------------------------------------------------------------- contrôles automatiques

const bonne = solid(120, 160, [0, 0, 0, 0]);
paint(bonne, 10, 10, 110, 150, [176, 131, 63, 255]);
// Une vraie pièce n'emplit jamais son cadre : les angles sont vides.
for (const [x, y] of [[10, 10], [109, 10], [10, 149], [109, 149]]) for (let k = 0; k < 8; k++) for (let m = 0; m < 8 - k; m++) {
  bonne.data[((y === 10 ? y + k : y - k) * 120 + (x === 10 ? x + m : x - m)) * 4 + 3] = 0;
}
const ok = runChecks(bonne, 1, '#B0833F');
check('pièce propre : tous les contrôles passent', [ok.ok, ok.failed], [true, []]);
check('couleur mesurée rendue', ok.values.mesuree, '#B0833F');

check('mauvaise couleur attendue → échec « couleur »', runChecks(bonne, 1, '#2040A0').failed, ['couleur']);
check('sans teinte attendue → pas de contrôle de couleur', runChecks(bonne, 1, null).values.couleur, null);
check('plusieurs morceaux étrangers → « une_seule_piece »', runChecks(bonne, 0.7, '#B0833F').failed, ['une_seule_piece']);

const plein = solid(120, 160, [200, 200, 200, 255]);
check('cadre entièrement plein (fond resté collé) → « couverture »', runChecks(plein, 1, null).failed.includes('couverture'), true);
const vide = runChecks(solid(50, 50, [0, 0, 0, 0]), 0, null).failed;
check('image vide → « couverture » et « taille »', [vide.includes('couverture'), vide.includes('taille')], [true, true]);

const mini = solid(40, 40, [0, 0, 0, 0]);
paint(mini, 5, 5, 25, 25, [90, 90, 90, 255]);
check('pièce minuscule → « taille »', runChecks(mini, 1, null).failed.includes('taille'), true);

const flou = solid(120, 160, [0, 0, 0, 0]);
paint(flou, 10, 10, 110, 150, [176, 131, 63, 120]);
check('contour flou (demi-transparent partout) → « bord_net »', runChecks(flou, 1, null).failed.includes('bord_net'), true);

// ---------------------------------------------------------------- mise au format fixe

const large = solid(1500, 500, [0, 0, 0, 0]);
paint(large, 250, 100, 1250, 400, [20, 60, 120, 255]);   // 1000×300, bien plus large que haute
const f = fitOnCanvas(large);
const room = Math.round(CUTOUT.canvas * (1 - 2 * CUTOUT.margin));
check('canevas carré fixe', [f.width, f.height], [CUTOUT.canvas, CUTOUT.canvas]);
const fb = contentBox(f, 0)!;
check('le grand côté remplit le cadre moins les marges', fb.w, room);
near('pièce centrée horizontalement', fb.x + fb.w / 2, CUTOUT.canvas / 2, 1);
near('pièce centrée verticalement', fb.y + fb.h / 2, CUTOUT.canvas / 2, 1);
near('proportions gardées (1000:300)', fb.w / fb.h, 1000 / 300, 0.1);
check('couleur conservée au centre', Array.from(f.data.subarray((512 * 1024 + 512) * 4, (512 * 1024 + 512) * 4 + 4)), [20, 60, 120, 255]);
check('marge transparente', alphaAt(f, 5, 5), 0);

const haute = solid(400, 1000, [0, 0, 0, 0]);
paint(haute, 50, 50, 350, 950, [200, 20, 20, 255]);
const fh = contentBox(fitOnCanvas(haute), 0)!;
check('pièce haute : la hauteur remplit le cadre', fh.h, room);

// Une pièce plus petite que le cadre est agrandie jusqu'à le remplir.
const moyenne = solid(450, 150, [0, 0, 0, 0]);
paint(moyenne, 25, 25, 425, 125, [90, 40, 120, 255]);   // 400×100, agrandie 2,2×
check('petite pièce agrandie jusqu\'au cadre', contentBox(fitOnCanvas(moyenne), 0)!.w, room);

// Une petite pièce n'est agrandie que de 3× au plus.
const petite = solid(30, 30, [0, 0, 0, 0]);
paint(petite, 0, 0, 30, 30, [0, 160, 0, 255]);
check('agrandissement plafonné', contentBox(fitOnCanvas(petite), 0)!.w, 90);

// Les bords agrandis ne sont pas noircis par les pixels transparents.
const bord = fitOnCanvas(petite);
const bi = (512 * 1024 + (512 - 45)) * 4;
check('bord agrandi : couleur de la pièce, pas du noir', bord.data[bi + 1] > 100 || bord.data[bi + 3] === 0, true);

// ---------------------------------------------------------------- orientation EXIF

/** JPEG minimal : SOI + APP1 Exif (orientation 6, petit-boutiste) + SOS. */
const exif = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
  0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0xff, 0xda,
]);
check('orientation EXIF lue', exifOrientation(exif), 6);
check('sans EXIF → 1', exifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2])), 1);
check('pas un JPEG → 1', exifOrientation(new Uint8Array([1, 2, 3])), 1);

// 3×2 : pixel (0,0) rouge. Orientation 6 = pivoter de 90° dans le sens horaire.
const tourne = solid(3, 2, [0, 0, 0, 255]);
tourne.data.set([255, 0, 0, 255], 0);
const o6 = orient(tourne, 6);
check('orientation 6 : dimensions échangées', [o6.width, o6.height], [2, 3]);
check('orientation 6 : le coin haut-gauche passe en haut-droite', Array.from(o6.data.subarray((0 * 2 + 1) * 4, (0 * 2 + 1) * 4 + 4)), [255, 0, 0, 255]);
check('orientation 1 : inchangée', orient(tourne, 1), tourne);

console.log(fails === 0 ? '\nTOUT PASSE' : `\n${fails} ÉCHEC(S)`);
process.exit(fails ? 1 : 0);
