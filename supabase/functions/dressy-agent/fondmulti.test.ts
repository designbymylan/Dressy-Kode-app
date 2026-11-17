/**
 * deno run -A --config deno.json fondmulti.test.ts
 *
 * Un fond de plusieurs teintes (parquet : lattes beige clair et moyen, joints
 * sombres) : le détourage doit garder la pièce et retirer les lattes (17/11 :
 * des bandes beiges restaient autour d'un sweat posé sur un parquet).
 */
import { cutoutBackground, backgroundPalette, type Raster } from './cutout.ts';

let fails = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` : ${detail}`}`);
};

const W = 400, H = 300;
const NAVY: [number, number, number] = [28, 35, 53], BLUE: [number, number, number] = [74, 107, 140], SKY: [number, number, number] = [157, 182, 214];
const floor = (x: number, y: number): [number, number, number] => {
  const board = Math.floor(x / 37);
  if (x % 37 < 2) return [58, 46, 36]; // joint sombre
  return board % 2 ? [221, 203, 168] : [201, 178, 140]; // deux lattes
};
const inside = (x: number, y: number) => x > 110 && x < 290 && y > 40 && y < 260;
const garment = (x: number, y: number): [number, number, number] => (x < 170 ? NAVY : x < 230 ? BLUE : SKY);

function photo(): Raster {
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = inside(x, y) ? garment(x, y) : floor(x, y);
    const n = ((x * 7 + y * 13) % 9) - 4; // grain
    const i = (y * W + x) * 4;
    data[i] = c[0] + n; data[i + 1] = c[1] + n; data[i + 2] = c[2] + n; data[i + 3] = 255;
  }
  return { width: W, height: H, data };
}

const r = photo();
const pal = backgroundPalette(r, [NAVY, BLUE], 78);
check('le pourtour n’est pas uni : une palette est apprise', !!pal && pal.length >= 2, JSON.stringify(pal));
check('le joint sombre (proche du marine) n’entre pas dans la palette', !!pal && pal.every((c) => Math.abs(c[0] - 58) + Math.abs(c[1] - 46) + Math.abs(c[2] - 36) > 30), JSON.stringify(pal));

const sans = cutoutBackground(r, { garment: [NAVY, BLUE] });
const avec = cutoutBackground(r, { garment: [NAVY, BLUE], multi: true });
const stats = (out: Raster) => {
  let pieceKept = 0, pieceTotal = 0, bgKept = 0, bgTotal = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const solid = out.data[(y * W + x) * 4 + 3] >= 128;
    if (inside(x, y)) { pieceTotal++; if (solid) pieceKept++; } else { bgTotal++; if (solid) bgKept++; }
  }
  return { piece: pieceKept / pieceTotal, fond: bgKept / bgTotal };
};
const a = stats(sans), b = stats(avec);
console.log(`     sans palette : pièce gardée ${(a.piece * 100).toFixed(1)} %, fond resté ${(a.fond * 100).toFixed(1)} %`);
console.log(`     avec palette : pièce gardée ${(b.piece * 100).toFixed(1)} %, fond resté ${(b.fond * 100).toFixed(1)} %`);
check('la pièce reste entière (au moins 97 %, panneau clair compris)', b.piece >= 0.97, `${b.piece}`);
check('le fond multicolore est retiré, joints compris (moins de 1 % reste)', b.fond < 0.01, `${b.fond}`);
check('sans la palette, des lattes restaient (c’est le défaut corrigé)', a.fond > b.fond + 0.1, `${a.fond} contre ${b.fond}`);

// Un fond uni garde son chemin d'avant : même résultat avec ou sans `multi`.
const uni: Raster = { width: 100, height: 100, data: new Uint8Array(100 * 100 * 4) };
for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
  const c = x > 30 && x < 70 && y > 30 && y < 70 ? NAVY : [240, 240, 240];
  uni.data.set([c[0], c[1], c[2], 255], (y * 100 + x) * 4);
}
check('fond uni : `multi` ne change rien', JSON.stringify(Array.from(cutoutBackground(uni, { garment: [NAVY] }).data)) === JSON.stringify(Array.from(cutoutBackground(uni, { garment: [NAVY], multi: true }).data)));

console.log(fails ? `\n${fails} échec(s)` : '\ntout est bon');
if (fails) Deno.exit(1);
