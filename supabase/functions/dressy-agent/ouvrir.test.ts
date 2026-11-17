/**
 * deno run -A --config deno.json ouvrir.test.ts
 *
 * La photo qu'on décode : refusée AVANT le décodage quand elle est trop grande
 * ou n'est pas un JPEG, car le décodage d'une photo de 3 Mpx dépassait les
 * 256 Mo de l'Edge Function, tuée sans pouvoir noter l'échec (17/11).
 */
import jpeg from 'jpeg-js';
import { ouvrir, MAX_PIXELS } from './decoupage.ts';
import { tailleImage } from './codec.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` : attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
};
const msg = (f: () => unknown) => { try { f(); return ''; } catch (e) { return (e as Error).message; } };
const flat = (width: number, height: number) =>
  new Uint8Array(jpeg.encode({ data: new Uint8Array(width * height * 4).fill(200), width, height }, 70).data);

const petite = flat(1200, 1600); // 1,9 Mpx : ce que l'app envoie
const grande = flat(1800, 1400); // 2,5 Mpx : trop pour la mémoire de la fonction
check('taille lue dans l’en-tête', [tailleImage(petite), tailleImage(grande)], [{ height: 1600, width: 1200 }, { height: 1400, width: 1800 }]);
check('une photo de 1,9 Mpx s’ouvre', msg(() => ouvrir({ bytes: petite, mime: 'image/jpeg' })), '');
check('une photo de 2,5 Mpx est refusée, avec un message lisible', msg(() => ouvrir({ bytes: grande, mime: 'image/jpeg' })).includes('trop grande'), true);
const heic = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, ...new Array(40).fill(0)]);
check('une HEIC annoncée « jpeg » est refusée proprement', msg(() => ouvrir({ bytes: heic, mime: 'image/jpeg' })).includes('format de cette photo'), true);
check('un fichier vide est refusé proprement', msg(() => ouvrir({ bytes: new Uint8Array(0), mime: 'image/jpeg' })).includes('format de cette photo'), true);
check('la limite tient entre l’app (1,9 Mpx) et le seuil mesuré (3,1 Mpx)', MAX_PIXELS > 1_920_000 && MAX_PIXELS < 3_100_000, true);

console.log(fails ? `\n${fails} échec(s)` : '\ntout est bon');
if (fails) Deno.exit(1);
