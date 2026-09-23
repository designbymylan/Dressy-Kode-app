/**
 * node supabase/functions/dressy-agent/agent.test.ts
 *
 * Ne teste que les modules sans dépendance (détourage, décisions, fond) :
 * ils tournent à l'identique sous Node et dans l'Edge Function.
 */
import { cutoutBackground, alphaRatio, cropToContent, downscale, type Raster } from './cutout.ts';
import { planRun, normaliseVerdict, isValidated, bestByScore, MAX_RUNS, type Candidate } from './decide.ts';
import { backdropFor } from './prompts.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` — attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
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

check('fond blanc pour une pièce sombre', backdropFor(['marine']), '#FFFFFF');
check('fond gris pour une pièce blanche', backdropFor(['blanc', 'noir']), '#808080');
check('fond gris pour une pièce crème', backdropFor(['creme']), '#808080');
check('fond blanc si aucune couleur', backdropFor([]), '#FFFFFF');

// ---------------------------------------------------------------- verdict

const perfect = { type_coupe: 98, couleurs: 97, motifs: 100, matiere: 96, details: 95, proportions: 97 };

check('verdict ≥ 95, fond uni, pièce entière → validé',
  isValidated(normaliseVerdict({ criteres: perfect, score: 96, fond_uni: true, piece_entiere: true, ecarts: [] })), true);
check('verdict à 94 → refusé',
  isValidated(normaliseVerdict({ criteres: perfect, score: 94, fond_uni: true, piece_entiere: true })), false);
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
  planRun(3, [cand(1, 80), cand(2, 96, { validated: true })]).kind, 'finalize');
check('image générée mais pas jugée → juger, pas régénérer',
  planRun(3, [cand(1, 80), cand(2, null)]), { kind: 'judge', candidate: cand(2, null) });
check('3 essais refusés → Claude choisit',
  planRun(4, [cand(1, 80), cand(2, 90), cand(3, 85)]).kind, 'select');
check('choix déjà fait → rangement sans redemander',
  planRun(5, [cand(1, 80), cand(2, 90, { chosen: true }), cand(3, 85)]),
  { kind: 'finalize', candidate: cand(2, 90, { chosen: true }) });
check('trop de passages → échec', planRun(MAX_RUNS + 1, []).kind, 'fail');
check('repli : meilleure note', bestByScore([cand(1, 80), cand(2, 91), cand(3, 85)]).attempt, 2);
check('repli : à égalité, le plus récent', bestByScore([cand(1, 88), cand(2, 88)]).attempt, 2);

console.log(fails === 0 ? '\nTOUT PASSE' : `\n${fails} ÉCHEC(S)`);
process.exit(fails ? 1 : 0);
