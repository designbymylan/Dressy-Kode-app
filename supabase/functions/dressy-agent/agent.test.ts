/**
 * node supabase/functions/dressy-agent/agent.test.ts
 *
 * Ne teste que les modules sans dépendance (détourage, fond, fiche) :
 * ils tournent à l'identique sous Node et dans l'Edge Function.
 */
import { cutoutBackground, alphaRatio, cropToContent, contentBox, downscale, type Raster } from './cutout.ts';
import { backdropFor, cleanTarget, cleanBox, deltaE, isMetal, stripClauses } from './prompts.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` : attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
};

// ---------------------------------------------------------------- détourage
//
// Le cas qui compte : une chemise IVOIRE sur fond BLANC. Un seuil global
// effacerait l'intérieur du vêtement ; le remplissage depuis les bords doit
// le conserver.

const W = 120, H = 120;

function shirt(): Raster {
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let r = 255, g = 255, b = 255;
      const inShape = x >= 30 && x < 90 && y >= 20 && y < 100;
      const onEdge = inShape && (x === 30 || x === 89 || y === 20 || y === 99);
      if (onEdge) { r = 200; g = 190; b = 178; }
      else if (inShape) { r = 247; g = 243; b = 238; }
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}

const alphaAt = (r: Raster, x: number, y: number) => r.data[(y * r.width + x) * 4 + 3];
const cut = cutoutBackground(shirt());

check('coin haut-gauche transparent', alphaAt(cut, 2, 2), 0);
check('coin bas-droit transparent', alphaAt(cut, W - 3, H - 3), 0);
check('bord du vêtement opaque', alphaAt(cut, 30, 60), 255);
check('INTÉRIEUR ivoire conservé', alphaAt(cut, 60, 60), 255);
check('ivoire près du bord conservé', alphaAt(cut, 32, 22), 255);
check('juste hors du vêtement transparent', alphaAt(cut, 28, 60), 0);

// fond ≈ 120² − 60×80 = 9600 px, soit 66,7 %
const ratio = alphaRatio(cut);
check('part transparente ≈ 66,7 %', ratio > 0.6 && ratio < 0.72, true);

// La pièce fait 60×80 : marge de 6 % du grand côté = 5 px de chaque côté.
const framed = cropToContent(cut);
check('recadrage sur la pièce + marge', [framed.width, framed.height], [70, 90]);
check('recadrage garde la pièce opaque', alphaAt(framed, 35, 45), 255);
check('recadrage garde une marge transparente', alphaAt(framed, 1, 1), 0);

// Le cadre gardé pour le « détourage révélé » : même découpe que le recadrage.
check('cadre de découpe : position et taille', contentBox(cut), { x: 25, y: 15, w: 70, h: 90 });

const small = downscale(framed, 45);
check('vignette : grand côté ramené à 45', Math.max(small.width, small.height), 45);
check('vignette : proportions gardées', small.width, 35);
check('vignette : centre opaque', alphaAt(small, 17, 22), 255);

// Un pixel transparent (souvent blanc) ne doit pas éclaircir la vignette.
const pair: Raster = { width: 2, height: 1, data: new Uint8Array([20, 20, 20, 255, 255, 255, 255, 0]) };
const one = downscale(pair, 1);
check('moyenne pondérée par l\'alpha : couleur de la partie opaque', one.data[0], 20);
check('moyenne pondérée par l\'alpha : alpha moyen', one.data[3], 128);

// ---------------------------------------------------------------- fond
//
// Le fond doit s'éloigner de TOUTES les couleurs de la pièce, pas seulement
// de la dominante : une marinière marine et blanche sur fond blanc perdrait
// ses rayures au détourage.

check('fond blanc pour une pièce sombre', backdropFor(['marine']), '#FFFFFF');
check('fond vert pour une pièce blanche et noire (ses ombres grises resteraient sur gris)', backdropFor(['blanc', 'noir']), '#00B140');
check('fond vert pour une pièce crème', backdropFor(['creme']), '#00B140');
check('fond vert si le blanc est en second', backdropFor(['marine', 'blanc']), '#00B140');
check('fond vert pour une pièce blanche ET grise', backdropFor(['blanc', 'gris']), '#00B140');
check('fond gris pour un bijou argenté (le vert s\'y refléterait)', backdropFor(['argente']), '#808080');
check('métal reconnu à la catégorie ou à la matière', [isMetal({ category: 'bijoux', colors: ['noir'] }), isMetal({ category: 'accessoires', colors: ['noir'], material: 'métal noir' }), isMetal({ category: 'hauts', colors: ['blanc'], material: 'coton' })], [true, true, false]);
check('jean clair délavé à déchirures blanches → vert, pas gris', backdropFor(['ciel', 'blanc'], ['#A8C0D8', '#F4F4F2']), '#00B140');
check('jean clair sans blanc → vert (ses reflets frôlent le blanc)', backdropFor(['ciel'], ['#B8CCE0']), '#00B140');
check('camel → blanc', backdropFor(['camel'], ['#B0833F']), '#FFFFFF');
check('fond blanc si aucune couleur', backdropFor([]), '#FFFFFF');

// Les vraies teintes mesurées comptent plus que l'étiquette (04/10) : un denim
// menthe délavé n'est pas le « vert » foncé de la palette.
check('ΔE blanc / noir ≈ 100', Math.round(deltaE([255, 255, 255], [0, 0, 0])), 100);
check('short menthe délavé (teintes mesurées) → vert d\'incrustation', backdropFor(['vert', 'creme'], ['#A9C4B5', '#F0E9DC']), '#00B140');
check('jean gris-écru délavé → vert d\'incrustation', backdropFor(['gris', 'creme'], ['#B4B2AA', '#E8E2D4']), '#00B140');
check('pièce verte, blanche et grise → magenta', backdropFor(['vert', 'blanc', 'gris']), '#FF00FF');
check('codes hex illisibles → étiquettes de couleur', backdropFor(['marine'], ['vert', '#12']), '#FFFFFF');

// ---------------------------------------------------------------- fond d'incrustation

/** Fond vert bruité, un jean gris-écru, ses franges et son ombre portée. */
function jorts(): Raster {
  const w = 120, h = 120;
  const data = new Uint8Array(w * h * 4);
  let seed = 7;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 7) - 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let c = [0, 177 + noise(), 64 + noise()];
      if (x >= 30 && x < 90 && y >= 20 && y < 80) c = x === 30 ? [168, 192, 152] : [180, 178, 170]; // le jean, bord teinté de vert
      else if (x >= 32 && x < 88 && y >= 80 && y < 92 && x % 4 === 0) c = [150, 186, 132]; // frange teintée de vert
      else if (x >= 30 && x < 90 && y >= 92 && y < 100) c = [0, 100, 36]; // ombre portée sur le vert
      data[i] = Math.max(0, c[0]); data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}
const j = cutoutBackground(jorts(), { garment: [[180, 178, 170], [232, 226, 212]] });
const jA = (x: number, y: number) => j.data[(y * 120 + x) * 4 + 3];
const jPx = (x: number, y: number) => Array.from(j.data.subarray((y * 120 + x) * 4, (y * 120 + x) * 4 + 3));
check('incrustation : coin transparent', jA(2, 2), 0);
check('incrustation : jean opaque, teinte intacte', [jA(60, 50), ...jPx(60, 50)], [255, 180, 178, 170]);
check('incrustation : ombre portée verte retirée', jA(60, 96), 0);
const fringe = jPx(84, 86);
check('incrustation : frange sans reflet vert (ou retirée)', jA(84, 86) === 0 || fringe[1] - Math.max(fringe[0], fringe[2]) <= 6, true);
const rim = jPx(30, 50);
check('incrustation : bord du jean sans reflet vert', rim[1] - Math.max(rim[0], rim[2]) <= 6, true);

/** Un tissu menthe sur fond vert : sa propre pointe de vert doit rester. */
function mint(): Raster {
  const w = 80, h = 80;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const c = x >= 20 && x < 60 && y >= 20 && y < 60 ? [160, 196, 176] : [0, 177, 64];
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}
const m = cutoutBackground(mint(), { garment: [[160, 196, 176]] });
const mPx = (x: number, y: number) => Array.from(m.data.subarray((y * 80 + x) * 4, (y * 80 + x) * 4 + 4));
check('menthe : intérieur opaque et vert gardé', mPx(40, 40), [160, 196, 176, 255]);
check('menthe : près du bord, vert gardé aussi', mPx(21, 40), [160, 196, 176, 255]);
check('menthe : fond retiré', mPx(5, 5)[3], 0);

// ---------------------------------------------------------------- fiche (suite)

check('rappels de fin retirés avant de les remettre à neuf',
  stripClauses('Reproduce the jacket.\n\nOnly one item must appear in the output: the one described above (x).\n\nBackground: a perfectly flat, solid pure white (#FFFFFF) backdrop.\n\nExact colours of the real item: #000000.'),
  'Reproduce the jacket.');
check('fiche : teintes hex gardées, une par couleur', cleanTarget({ name: 'Short', category: 'bas', colors: ['vert'], hex: ['#a9c4b5', '#zzz', '#F0E9DC'], prompt: 'x' })?.hex, ['#A9C4B5']);

// ---------------------------------------------------------------- détourage fin

/** Fond blanc, un sac marine dont l'anse enferme un carré de fond, et une poussière. */
function bag(): Raster {
  const w = 100, h = 100;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let c = [255, 255, 255];
      const body = x >= 20 && x < 80 && y >= 50 && y < 90;
      const handle = x >= 30 && x < 70 && y >= 15 && y < 50 && !(x >= 38 && x < 62 && y >= 23);
      if (body || handle) c = [38, 51, 77];
      if (x >= 5 && x < 7 && y >= 5 && y < 7) c = [120, 120, 120]; // poussière de 4 px
      if (x === 20 && y >= 60 && y < 70) c = [215, 220, 230]; // bord anticrénelé
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}
const b = cutoutBackground(bag());
const aAt = (x: number, y: number) => b.data[(y * 100 + x) * 4 + 3];
check('anse : le fond enfermé devient transparent', aAt(50, 35), 0);
check('anse : la matière reste opaque', aAt(33, 30), 255);
check('poussière isolée effacée', aAt(5, 5), 0);
check('corps du sac opaque', aAt(50, 70), 255);
const edge = aAt(20, 65);
check('bord anticrénelé : semi-transparent', edge > 0 && edge < 255, true);

// Un imprimé clair ET texturé au milieu d'une pièce sombre n'est pas un trou.
const printed = shirt();
for (let y = 50; y < 70; y++) {
  for (let x = 50; x < 70; x++) {
    const i = (y * W + x) * 4;
    const v = (x + y) % 2 ? 236 : 250; // grain du tissu
    printed.data[i] = v; printed.data[i + 1] = v; printed.data[i + 2] = v;
  }
}
check('imprimé clair texturé conservé', alphaAt(cutoutBackground(printed), 60, 60), 255);

// ---------------------------------------------------------------- fiche

const fiche = cleanTarget({
  name: 'Veste en jean', category: 'vestes', kind: 'jean', colors: ['bleu', 'violetfluo', 'bleu', 'blanc', 'noir', 'gris'],
  material: 'denim', where: 'portée par-dessus le t-shirt', description: '…', prompt: 'Reproduce only the denim jacket…',
});
check('fiche : type incohérent avec la catégorie → null', fiche?.kind, null);
check('fiche : couleurs filtrées, dédoublonnées, 3 au plus', fiche?.colors, ['bleu', 'blanc', 'noir']);
check('fiche : catégorie inconnue → accessoires', cleanTarget({ name: 'Truc', category: 'lingerie', prompt: 'x' })?.category, 'accessoires');
check('cadre en millièmes → fractions', cleanBox({ x: 250, y: 100, w: 500, h: 400 }), [0.25, 0.1, 0.5, 0.4]);
check('cadre qui déborde → ramené dans la photo', cleanBox({ x: 800, y: 900, w: 500, h: 400 }), [0.8, 0.9, 0.2, 0.1]);
check('cadre minuscule ou illisible → ignoré', [cleanBox({ x: 10, y: 10, w: 5, h: 300 }), cleanBox({ x: 'a' })], [null, null]);
check('fiche : cadre repris', cleanTarget({ name: 'Veste', category: 'vestes', prompt: 'x', box: { x: 100, y: 200, w: 300, h: 400 } })?.box, [0.1, 0.2, 0.3, 0.4]);
check('fiche sans consigne → consigne de repli bâtie par gabarit', cleanTarget({ name: 'Pull', category: 'hauts', where: 'sur le lit', description: 'Grey ribbed jumper.' })?.prompt.includes('Grey ribbed jumper.'), true);
check('fiche vide → écartée', cleanTarget({ category: 'hauts' }), null);

console.log(fails === 0 ? '\nTOUT PASSE' : `\n${fails} ÉCHEC(S)`);
process.exit(fails ? 1 : 0);
