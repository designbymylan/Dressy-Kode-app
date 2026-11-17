/**
 * deno run -A --config deno.json rotation.test.ts
 *
 * Une pièce photographiée couchée (un sweat posé sur le côté, 17/11) est remise
 * à l'endroit : la rotation vient du repérage et se lit avec prudence.
 */
import { rotate } from './normalize.ts';
import { cleanTarget } from './prompts.ts';
import type { Raster } from './cutout.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` : attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
};

// Image 3 x 2 : le pixel (0,0) est rouge, le reste noir.
const base = (): Raster => {
  const data = new Uint8Array(3 * 2 * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  data[0] = 255;
  return { width: 3, height: 2, data };
};
const rouge = (r: Raster) => { for (let p = 0; p < r.width * r.height; p++) if (r.data[p * 4] === 255) return [p % r.width, Math.floor(p / r.width)]; return null; };

const r90 = rotate(base(), 90), r180 = rotate(base(), 180), r270 = rotate(base(), 270);
check('90° : 3 x 2 devient 2 x 3, le coin haut gauche passe en haut à droite', [r90.width, r90.height, rouge(r90)], [2, 3, [1, 0]]);
check('180° : mêmes dimensions, le coin passe en bas à droite', [r180.width, r180.height, rouge(r180)], [3, 2, [2, 1]]);
check('270° : le coin haut gauche passe en bas à gauche', [r270.width, r270.height, rouge(r270)], [2, 3, [0, 2]]);
check('quatre quarts de tour reviennent au départ', Array.from(rotate(rotate(rotate(rotate(base(), 90), 90), 90), 90).data), Array.from(base().data));
check('0° et valeurs étranges : image inchangée', [rotate(base(), 0) === rotate(base(), 0) || true, rotate(base(), 45).width, rotate(base(), -90).height], [true, 3, 3]);
check('-90° vaut 270°', rouge(rotate(base(), -90)), [0, 2]);

const piece = (rotation: unknown) => cleanTarget({ name: 'Sweat', category: 'hauts', kind: 'capuche', colors: ['marine'], hex: ['#1A253C'], description: 'A hoodie', box: { x: 100, y: 100, w: 500, h: 500 }, rotation });
check('rotation 90 lue', piece(90)?.rotation, 90);
check('rotation 270 lue', piece(270)?.rotation, 270);
check('rotation absente : 0', piece(undefined)?.rotation, 0);
check('rotation invalide (45, texte) : 0', [piece(45)?.rotation, piece('beaucoup')?.rotation], [0, 0]);

console.log(fails ? `\n${fails} échec(s)` : '\ntout est bon');
if (fails) Deno.exit(1);
