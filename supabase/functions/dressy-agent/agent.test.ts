/**
 * node supabase/functions/dressy-agent/agent.test.ts
 *
 * Ne teste que les modules sans dépendance (détourage, décisions, fond) :
 * ils tournent à l'identique sous Node et dans l'Edge Function.
 */
import { cutoutBackground, alphaRatio, cropToContent, contentBox, downscale, type Raster } from './cutout.ts';
import { planRun, normaliseVerdict, isValidated, bestByScore, MAX_RUNS, type Candidate } from './decide.ts';
import { backdropFor, cleanTarget, cleanBox } from './prompts.ts';

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
check('fond gris pour une pièce blanche', backdropFor(['blanc', 'noir']), '#808080');
check('fond gris pour une pièce crème', backdropFor(['creme']), '#808080');
check('fond gris si le blanc est en second', backdropFor(['marine', 'blanc']), '#808080');
check('fond vert pour une pièce blanche ET grise', backdropFor(['blanc', 'gris']), '#00B140');
check('fond gris pour un bijou argenté', backdropFor(['argente']), '#808080');
check('fond blanc si aucune couleur', backdropFor([]), '#FFFFFF');

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
check('fiche : catégorie inconnue → accessoires', cleanTarget({ category: 'lingerie', prompt: 'x' })?.category, 'accessoires');
check('cadre en millièmes → fractions', cleanBox({ x: 250, y: 100, w: 500, h: 400 }), [0.25, 0.1, 0.5, 0.4]);
check('cadre qui déborde → ramené dans la photo', cleanBox({ x: 800, y: 900, w: 500, h: 400 }), [0.8, 0.9, 0.2, 0.1]);
check('cadre minuscule ou illisible → ignoré', [cleanBox({ x: 10, y: 10, w: 5, h: 300 }), cleanBox({ x: 'a' })], [null, null]);
check('fiche : cadre repris', cleanTarget({ name: 'Veste', category: 'vestes', prompt: 'x', box: { x: 100, y: 200, w: 300, h: 400 } })?.box, [0.1, 0.2, 0.3, 0.4]);
check('fiche sans consigne → écartée', cleanTarget({ name: 'Pull', category: 'hauts', prompt: '  ' }), null);

// ---------------------------------------------------------------- verdict

const perfect = { type_coupe: 98, couleurs: 97, motifs: 100, matiere: 96, details: 95, proportions: 97 };

check('verdict ≥ seuil, fond uni, pièce entière → validé',
  isValidated(normaliseVerdict({ criteres: perfect, score: 90, fond_uni: true, piece_entiere: true, ecarts: [] })), true);
check('verdict juste sous le seuil → refusé',
  isValidated(normaliseVerdict({ criteres: perfect, score: 87, fond_uni: true, piece_entiere: true })), false);
check('score 99 mais fond non uni → refusé',
  isValidated(normaliseVerdict({ criteres: perfect, score: 99, fond_uni: false, piece_entiere: true })), false);
check('score plafonné au critère le plus faible + 5',
  normaliseVerdict({ criteres: { ...perfect, couleurs: 70 }, score: 97, fond_uni: true, piece_entiere: true }).score, 75);
check('réponse abîmée → 0 et refus, pas de plantage',
  isValidated(normaliseVerdict({ score: 'beaucoup' })), false);

// ---------------------------------------------------------------- plan

const cand = (attempt: number, score: number | null, extra: Partial<Candidate> = {}): Candidate => ({
  id: `c${attempt}`, attempt, storage_path: `s/j/essai-${attempt}.png`, mime: 'image/png',
  prompt: `p${attempt}`, score, validated: false, chosen: false, ecarts: [], ...extra,
});

check('rien encore → essai 1', planRun(1, []), { kind: 'attempt', attempt: 1, previous: null });

const p2 = planRun(2, [cand(1, 80, { ecarts: ['col trop large'] })]);
check('essai 1 refusé → essai 2', p2.kind === 'attempt' && p2.attempt, 2);
check('essai 2 reçoit la critique du 1', p2.kind === 'attempt' && p2.previous?.ecarts, ['col trop large']);

check('essai 2 validé → rangement',
  planRun(3, [cand(1, 80), cand(2, 90, { validated: true })]).kind, 'finalize');
check('image générée mais pas jugée → juger, pas régénérer',
  planRun(3, [cand(1, 80), cand(2, null)]), { kind: 'judge', candidate: cand(2, null) });
check('2 essais refusés → le contrôle choisit, pas de 3e essai',
  planRun(3, [cand(1, 80), cand(2, 85)]).kind, 'select');
check('choix déjà fait → rangement sans redemander',
  planRun(5, [cand(1, 80), cand(2, 85, { chosen: true })]),
  { kind: 'finalize', candidate: cand(2, 85, { chosen: true }) });
check('trop de passages → échec', planRun(MAX_RUNS + 1, []).kind, 'fail');
check('repli : meilleure note', bestByScore([cand(1, 80), cand(2, 91), cand(3, 85)]).attempt, 2);
check('repli : à égalité, le plus récent', bestByScore([cand(1, 88), cand(2, 88)]).attempt, 2);

console.log(fails === 0 ? '\nTOUT PASSE' : `\n${fails} ÉCHEC(S)`);
process.exit(fails ? 1 : 0);
