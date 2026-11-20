/**
 * node supabase/functions/dressy-agent/sam.test.ts
 *
 * Le détourage par SAM 3 sans réseau (20/11) : consigne, zone envoyée, choix
 * des masques (une pièce, une paire, sans cadre), lecture d'un masque, de la
 * réponse de fal.ai et de ses erreurs (fetch simulé). Aucun module à
 * dépendance, comme les autres tests de l'agent.
 */
import type { Raster } from './cutout.ts';
import { KINDS } from './prompts.ts';
import { cadreDansZone, carteDuMasque, choisirMasques, estPaire, reunir, SAM_KIND, samPrompt, zoneSam } from './sam.ts';
import { FalError, lireReponseSam, octetsDuMasque, segmenterSam } from './fal.ts';
import { cutFromMask, cleanSpecks } from './segment.ts';
import { runChecks } from './checks.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` : attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
};

// ---------------------------------------------------------------- consigne

const tous = Object.values(KINDS).flat();
check('chaque type de pièce a son nom anglais', tous.filter((k) => !SAM_KIND[k]), []);
check('veste → jacket', samPrompt({ kind: 'veste', category: 'vestes' }), 'jacket');
check('type inconnu → la catégorie', samPrompt({ kind: 'kimono', category: 'vestes' }), 'jacket');
check('sans type → la catégorie', samPrompt({ kind: null, category: 'chaussures' }), 'shoe');
check('chaussures : une paire', estPaire({ kind: 'baskets', category: 'chaussures' }), true);
check('boucles : une paire', estPaire({ kind: 'boucles', category: 'bijoux' }), true);
check('collier : une pièce', estPaire({ kind: 'collier', category: 'bijoux' }), false);

// ---------------------------------------------------------------- zone

check('sans cadre : toute la photo', zoneSam(null, 1000, 800), { x: 0, y: 0, w: 1000, h: 800 });
// Cadre 0,4 × 0,5 en (0,3 ; 0,2) : 25 % de marge de chaque côté (0,1 et 0,125).
check('cadre élargi de 25 %', zoneSam([0.3, 0.2, 0.4, 0.5], 1000, 1000), { x: 200, y: 75, w: 600, h: 750 });
check('élargi, mais borné à la photo', zoneSam([0, 0, 0.5, 1], 1000, 1000), { x: 0, y: 0, w: 625, h: 1000 });
check('petit cadre : au moins 4 % de la photo de marge', zoneSam([0.5, 0.5, 0.04, 0.04], 1000, 1000), { x: 460, y: 460, w: 120, h: 120 });
const z = zoneSam([0.3, 0.2, 0.4, 0.5], 1000, 1000);
check('le cadre dans la zone', cadreDansZone([0.3, 0.2, 0.4, 0.5], z, 1000, 1000).map((v) => Math.round(v * 1000) / 1000), [0.167, 0.167, 0.667, 0.667]);

// ---------------------------------------------------------------- choix des masques

// Cadres SAM : [cx, cy, l, h] en fractions de l'image envoyée.
const cadre = [0.2, 0.2, 0.6, 0.6];
const veste = { box: [0.5, 0.5, 0.58, 0.58], score: 0.8 };
const autreVeste = { box: [0.1, 0.9, 0.15, 0.15], score: 0.95 };
const manche = { box: [0.3, 0.5, 0.1, 0.3], score: 0.9 };
check('une pièce : celle qui remplit le cadre, pas la plus sûre ailleurs', choisirMasques([autreVeste, manche, veste], cadre, false)[0], [2]);
check('une pièce : trois choix au plus', choisirMasques([autreVeste, manche, veste, veste, veste], cadre, false).length <= 3, true);
check('une pièce : hors du cadre, jamais en premier quand il y a mieux', choisirMasques([autreVeste, veste], cadre, false).flat().includes(0), false);

const gauche = { box: [0.35, 0.6, 0.25, 0.3], score: 0.85 };
const droite = { box: [0.65, 0.6, 0.25, 0.3], score: 0.8 };
const loin = { box: [0.9, 0.1, 0.1, 0.1], score: 0.99 };
check('une paire : les deux chaussures du cadre réunies', choisirMasques([loin, gauche, droite], cadre, true)[0], [1, 2]);
check('une paire : un seul masque dedans reste un choix', choisirMasques([loin, gauche], cadre, true)[0], [1]);

check('sans cadre : par confiance', choisirMasques([{ box: [0.5, 0.5, 0.2, 0.2], score: 0.4 }, { box: [0.5, 0.5, 0.1, 0.1], score: 0.9 }], null, false)[0], [1]);
check('sans cadre, paire : les masques sûrs réunis', choisirMasques([gauche, droite, { box: null, score: 0.2 }], null, true)[0], [0, 1]);
check('aucun masque : aucun choix', choisirMasques([], cadre, false), []);

// ---------------------------------------------------------------- masque → pièce

const raster = (w: number, h: number, f: (x: number, y: number) => number[]): Raster => {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(f(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
};
// Une photo 200 × 200 : une « veste » rouge (une ellipse) au centre sur un fond beige.
const dansVeste = (x: number, y: number, s: number) => ((x - 100 * s) / (50 * s)) ** 2 + ((y - 105 * s) / (65 * s)) ** 2 <= 1;
const photo = raster(200, 200, (x, y) => (dansVeste(x, y, 1) ? [180, 30, 30, 255] : [220, 200, 170, 255]));
// Le masque de SAM, plus petit (100 × 100), noir et blanc, opaque.
const masqueNB = raster(100, 100, (x, y) => (dansVeste(x + 0.5, y + 0.5, 0.5) ? [255, 255, 255, 255] : [0, 0, 0, 255]));
const carte = carteDuMasque(masqueNB);
const { cut, oneShare } = cleanSpecks(cutFromMask(photo, carte, [0, 0, 1, 1], { x: 0, y: 0, w: 200, h: 200 }));
const c = runChecks(cut, oneShare, '#b41e1e');
check('masque noir et blanc étiré : la pièce passe les contrôles', c.failed, []);
check('le fond est transparent', cut.data[(5 * 200 + 5) * 4 + 3], 0);
check('la pièce garde ses pixels', [...cut.data.subarray((100 * 200 + 100) * 4, (100 * 200 + 100) * 4 + 4)], [180, 30, 30, 255]);

// Un masque « à transparence » (objet opaque, fond vide) se lit par l'opacité, même pour une pièce noire.
const masqueAlpha = raster(100, 100, (x, y) => (x >= 25 && x < 75 && y >= 20 && y < 85 ? [10, 10, 10, 255] : [0, 0, 0, 0]));
check('masque à transparence : lu par l’opacité', [carteDuMasque(masqueAlpha).data[(50 * 100 + 50) * 4], carteDuMasque(masqueAlpha).data[0]], [255, 0]);

const g = raster(10, 10, (x) => (x < 5 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
const d = raster(10, 10, (x) => (x >= 5 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
const r = reunir([carteDuMasque(g), carteDuMasque(d)]);
check('une paire : les masques réunis couvrent les deux', [r.data[0], r.data[9 * 4]], [255, 255]);

// ---------------------------------------------------------------- réponse et erreurs de fal.ai

check('réponse : masques, cadres et confiances par `metadata`', lireReponseSam({
  masks: [{ url: 'data:image/png;base64,AAAA' }, { url: 'https://v3.fal.media/x.png' }],
  metadata: [{ index: 1, box: [0.5, 0.5, 0.2, 0.2], score: 0.7 }, { index: 0, box: [0.1, 0.1, 0.1, 0.1], score: 0.9 }],
}), [
  { source: 'data:image/png;base64,AAAA', box: [0.1, 0.1, 0.1, 0.1], score: 0.9 },
  { source: 'https://v3.fal.media/x.png', box: [0.5, 0.5, 0.2, 0.2], score: 0.7 },
]);
check('réponse : par `scores` et `boxes`', lireReponseSam({ masks: [{ url: 'a' }], scores: [0.4], boxes: [[0.5, 0.5, 1, 1]] }), [{ source: 'a', box: [0.5, 0.5, 1, 1], score: 0.4 }]);
check('réponse vide ou abîmée : aucun masque', [lireReponseSam(null), lireReponseSam({ masks: [{}] })], [[], []]);

const ok = (corps: unknown, status = 200) => (async () => new Response(JSON.stringify(corps), { status })) as unknown as typeof fetch;
const echoue = (status: number) => ok({ detail: 'non' }, status);
const image = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), mime: 'image/jpeg' };

let envoye: Record<string, unknown> = {};
let entete = '';
let garde = '';
const espion = (async (_url: string, init: RequestInit) => {
  envoye = JSON.parse(String(init.body));
  entete = String((init.headers as Record<string, string>).Authorization);
  garde = String((init.headers as Record<string, string>)['X-Fal-Store-IO']);
  return new Response(JSON.stringify({ masks: [{ url: 'data:image/png;base64,AAAA' }], metadata: [{ index: 0, score: 0.5, box: null }] }));
}) as unknown as typeof fetch;
const rendu = await segmenterSam(image, 'jacket', { cle: 'k', fetch: espion });
check('appel : la clé en « Key … »', entete, 'Key k');
check('appel : la photo en data URI, masques bruts, réponse directe', [String(envoye.image_url).slice(0, 23), envoye.prompt, envoye.apply_mask, envoye.sync_mode, envoye.return_multiple_masks], ['data:image/jpeg;base64,', 'jacket', false, true, true]);
check('appel : un masque lu', rendu.masques.length, 1);
check('appel : la photo n’est pas gardée dans l’historique de fal.ai', garde, '0');

const erreur = async (f: typeof fetch) => {
  try {
    await segmenterSam(image, 'jacket', { cle: 'k', fetch: f });
    return 'aucune';
  } catch (e) {
    return e instanceof FalError ? { status: e.status, passager: e.passager } : 'autre';
  }
};
check('clé refusée : pas passagère', await erreur(echoue(401)), { status: 401, passager: false });
check('trop de demandes : passagère', await erreur(echoue(429)), { status: 429, passager: true });
check('panne du serveur : passagère', await erreur(echoue(503)), { status: 503, passager: true });
check('demande refusée (422) : pas passagère', await erreur(echoue(422)), { status: 422, passager: false });
check('réseau coupé : passager', await erreur((async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch), { status: null, passager: true });
check('masque en data URI : décodé sans réseau', [...await octetsDuMasque('data:image/png;base64,AAEC')], [0, 1, 2]);

console.log(fails ? `\n${fails} échec(s)` : '\ntout est bon');
if (fails) process.exit(1);
