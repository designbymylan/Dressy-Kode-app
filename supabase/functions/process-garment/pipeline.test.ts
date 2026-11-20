/**
 * Le pipeline d'ajout sans réseau : faux détoureur, faux modèle, faux
 * encodeur. Contrôle qualité, sortie standard, reprises du fournisseur,
 * étiquetage invalide (critère de la spec), parallélisme.
 *
 *   node supabase/functions/process-garment/pipeline.test.ts
 */
import type { Raster } from '../dressy-agent/cutout.ts';
import { FalError } from '../dressy-agent/fal.ts';
import { detourer } from './detoureurs.ts';
import { etiqueter, type Appel } from './etiquetage.ts';
import { analyser, etirer, opaciteDe } from './masque.ts';
import { couleurMediane, decouper } from './normaliser.ts';
import { traiter, type Ports } from './pipeline.ts';
import { decider, MESSAGES } from './qualite.ts';

let echecs = 0;
function check(nom: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs++;
  console.log(`${ok ? 'ok ' : 'ÉCHEC'} ${nom}${ok ? '' : `\n     obtenu  ${JSON.stringify(obtenu)}\n     attendu ${JSON.stringify(attendu)}`}`);
}

// ---- images de test : une photo unie avec une « pièce » rouge, et son masque
const W = 400, H = 300;
function photo(): Raster {
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { data[i * 4] = 230; data[i * 4 + 1] = 230; data[i * 4 + 2] = 225; data[i * 4 + 3] = 255; }
  for (let y = 60; y < 240; y++) for (let x = 100; x < 300; x++) { const o = (y * W + x) * 4; data[o] = 180; data[o + 1] = 30; data[o + 2] = 40; }
  return { width: W, height: H, data };
}
/** Un masque en niveaux de gris (comme BiRefNet « masque seul ») avec les rectangles donnés. */
function masqueGris(rects: [number, number, number, number][], w = W, h = H): Raster {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = 255;
  for (const [x0, y0, rw, rh] of rects) for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) { const o = (y * w + x) * 4; data[o] = data[o + 1] = data[o + 2] = 255; }
  return { width: w, height: h, data };
}

const ETIQ = {
  piece_unique: true, categorie: 'hauts', type: 'pull', couleur: 'rouge', couleur_2: null, matiere: 'laine',
  motif: 'uni', coupe: 'droite', saisons: ['automne', 'hiver'], habillage: 2, confiance: 0.9,
};

function fauxPorts(opts: {
  masque?: Raster; etiquettes?: unknown; detourer?: Ports['detourer']; etiqueter?: Ports['etiqueter']; photo?: Raster; journal?: string[];
} = {}): Ports {
  const journal = opts.journal ?? [];
  return {
    decoderJpeg: () => opts.photo ?? photo(),
    decoderPng: () => opts.masque ?? masqueGris([[100, 60, 200, 180]]),
    encoderWebp: async (r, q) => new Uint8Array([r.width >> 8, r.width & 255, r.height >> 8, r.height & 255, q]),
    detourer: opts.detourer ?? (async () => { journal.push('détourage'); return { png: new Uint8Array([1]), essais: 1, erreurs: [] }; }),
    etiqueter: opts.etiqueter ?? (async () => { journal.push('étiquetage'); return etiqueter(async () => ({ brut: opts.etiquettes ?? ETIQ, modele: 'faux', coutUsd: 0.0002 })); }),
    maintenant: () => Date.now(),
  };
}
const original = new Uint8Array([0xff, 0xd8, 0xff]);

// ---- une bonne photo
{
  const s = await traiter(original, fauxPorts());
  check('bonne photo : ready', s.statut, 'ready');
  if (s.statut === 'ready') {
    // Pièce de 200 × 180, marge de 4 % du grand côté (8 px) de chaque côté.
    check('recadrage sur la pièce + 4 %', [s.largeur, s.hauteur], [216, 196]);
    check('couleur médiane calculée par le code', s.couleurHex, '#b41e28');
    check('fiche validée', s.etiquettes?.type, 'pull');
    check('vignette et cutout encodés (qualité 85 et 90)', [s.cutout[4], s.thumb[4]], [90, 85]);
    check('étiquetage compté', [s.mesures.essais_etiquetage, s.mesures.cout_etiquetage_usd], [1, 0.0002]);
  }
}

// ---- la sortie garde les pixels de la photo, sans fond caché
{
  const p = photo();
  const { analyse, propre } = analyser({ largeur: W, hauteur: H, alpha: opaciteDe(masqueGris([[100, 60, 200, 180]])) });
  const c = decouper(p, propre, analyse.boite!, 0.04);
  const centre = ((98) * c.width + 108) * 4;
  check('aucune correction de couleur', [...c.data.slice(centre, centre + 4)], [180, 30, 40, 255]);
  check('sous un pixel transparent, rien du fond', [...c.data.slice(0, 4)], [0, 0, 0, 0]);
  check('couleur médiane sans pixel opaque : null', couleurMediane({ width: 2, height: 1, data: new Uint8Array(8) }), null);
}

// ---- contrôle qualité : seuils de la spec
{
  const trop = await traiter(original, fauxPorts({ masque: masqueGris([[190, 140, 20, 20]]) }));
  check('pièce sous 10 % : mask_too_small', trop.statut === 'needs_retake' && trop.raison, 'mask_too_small');
  const large = await traiter(original, fauxPorts({ masque: masqueGris([[0, 0, 400, 290]]) }));
  check('pièce au-delà de 85 % : mask_too_large', large.statut === 'needs_retake' && large.raison, 'mask_too_large');
  const vide = await traiter(original, fauxPorts({ masque: masqueGris([]) }));
  check('masque vide : mask_too_small', vide.statut === 'needs_retake' && vide.raison, 'mask_too_small');
  const deux = await traiter(original, fauxPorts({ masque: masqueGris([[20, 60, 150, 180], [230, 60, 150, 180]]) }));
  check('deux morceaux égaux : multiple_items', deux.statut === 'needs_retake' && deux.raison, 'multiple_items');
  const paire = await traiter(original, fauxPorts({ masque: masqueGris([[20, 60, 150, 180], [230, 60, 150, 180]]), etiquettes: { ...ETIQ, categorie: 'chaussures', type: 'baskets', coupe: 'sans_objet' } }));
  check('une paire de baskets en deux morceaux : ready', paire.statut, 'ready');
  const plusieurs = await traiter(original, fauxPorts({ etiquettes: { ...ETIQ, piece_unique: false } }));
  check('le modèle voit plusieurs pièces : multiple_items', plusieurs.statut === 'needs_retake' && plusieurs.raison, 'multiple_items');
  check('message précis', MESSAGES.multiple_items, 'Une seule pièce par photo');
}

// ---- poussières : ignorées dans le calcul, effacées de l'image
{
  const m = masqueGris([[100, 60, 200, 180], [10, 10, 3, 3], [380, 280, 4, 4]]);
  const { analyse, propre } = analyser({ largeur: W, hauteur: H, alpha: opaciteDe(m) });
  check('poussières : un seul morceau', [analyse.morceaux, analyse.plusGros], [1, 1]);
  check('poussières effacées', propre.alpha[11 * W + 11], 0);
  check('cadre sans les poussières', analyse.boite, { x: 100, y: 60, w: 200, h: 180 });
}

// ---- masque : canal lu et taille
{
  const rgba: Raster = { width: 2, height: 1, data: new Uint8Array([10, 20, 30, 0, 10, 20, 30, 255]) };
  check('pièce détourée (alpha) : on lit l’alpha', [...opaciteDe(rgba)], [0, 255]);
  check('masque gris : on lit le rouge', [...opaciteDe({ width: 2, height: 1, data: new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]) })], [0, 255]);
  check('masque étiré à la taille de la photo', etirer(new Uint8Array([0, 255]), 2, 1, 4, 1).length, 4);
  const petit = await traiter(original, fauxPorts({ masque: masqueGris([[50, 30, 100, 90]], 200, 150) }));
  check('masque rendu en plus petit : même cadre', petit.statut === 'ready' && [petit.largeur, petit.hauteur], [216, 196]);
}

// ---- photo trop grande : ramenée à 1024 px
{
  const grande: Raster = { width: 2048, height: 1536, data: new Uint8Array(2048 * 1536 * 4).fill(200) };
  const s = await traiter(original, fauxPorts({ photo: grande, masque: masqueGris([[100, 60, 200, 180]]) }));
  check('photo de 2048 px : traitée en 1024', s.statut === 'ready' && s.largeur <= 1024, true);
}

// ---- étiquetage
{
  const appels: string[] = [];
  const invalide: Appel = async (c) => { appels.push(c.includes('rejetée') ? 'relance' : 'premier'); return { brut: { ...ETIQ, type: 'bomber' }, modele: 'faux', coutUsd: 0.0001 }; };
  const r = await etiqueter(invalide);
  check('réponse hors liste deux fois : fiche vide', [r.etiquettes, r.essais, appels], [null, 2, ['premier', 'relance']]);
  check('la relance dit pourquoi', r.erreurs[0].includes('type hors liste : bomber'), true);
  let n = 0;
  const puisBon: Appel = async () => ({ brut: n++ ? ETIQ : { ...ETIQ, couleur: 'navy' }, modele: 'faux', coutUsd: 0.0001 });
  const r2 = await etiqueter(puisBon);
  check('hors liste puis valide : gardée au second essai', [r2.etiquettes?.couleur, r2.essais, r2.coutUsd], ['rouge', 2, 0.0002]);
  const r3 = await etiqueter(async () => { throw new Error('modèle en panne'); });
  check('modèle en erreur : fiche vide', [r3.etiquettes, r3.erreurs.length], [null, 2]);

  const sansFiche = await traiter(original, fauxPorts({ etiqueter: async () => etiqueter(invalide) }));
  check('étiquetage en échec : ready avec fiche vide', [sansFiche.statut, sansFiche.statut === 'ready' && sansFiche.etiquettes], ['ready', null]);
  const t = Date.now();
  const lent = await traiter(original, fauxPorts({ etiqueter: () => new Promise((r) => setTimeout(() => r({ etiquettes: null, essais: 1, modele: null, coutUsd: 0, erreurs: [] }), 5_000)) }), { plafondEtiquetageMs: 200 });
  check('étiquetage trop lent : on n’attend pas', [lent.statut, Date.now() - t < 2_000], ['ready', true]);
  const casse = await traiter(original, fauxPorts({ etiqueter: async () => { throw new Error('boum'); } }));
  check('étiquetage qui lève : ready quand même', casse.statut, 'ready');
}

// ---- détourage et ses reprises (spec : 15 s, puis 2 s et 5 s)
{
  const attentes: number[] = [];
  const dormir = async (ms: number) => { attentes.push(ms); };
  let n = 0;
  const panne = (async () => { n++; return new Response('surcharge', { status: 503 }); }) as unknown as typeof fetch;
  let essais = 0, erreur = '';
  try { await detourer('birefnet', original, { cle: 'x', fetch: panne, dormir }); } catch (e) { essais = (e as { essais: number }).essais; erreur = String(e); }
  check('panne du service : 3 tentatives, attentes 2 s puis 5 s', [n, essais, attentes], [3, 3, [2000, 5000]]);
  check('panne : erreur passagère', erreur.includes('503'), true);

  n = 0; attentes.length = 0;
  const cle = (async () => { n++; return new Response('clé refusée', { status: 401 }); }) as unknown as typeof fetch;
  try { await detourer('bria', original, { cle: 'x', fetch: cle, dormir }); } catch { /* attendu */ }
  check('clé refusée : pas de nouvelle tentative', [n, attentes], [1, []]);

  n = 0; attentes.length = 0;
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const puisBon = (async () => (n++ ? Response.json({ image: { url: png } }) : Promise.reject(new Error('délai dépassé')))) as unknown as typeof fetch;
  const ok = await detourer('birefnet', original, { cle: 'x', fetch: puisBon, dormir });
  check('délai puis réponse : seconde tentative gardée', [ok.essais, attentes, ok.png.length], [2, [2000], 8]);

  const corps: unknown[] = [];
  const espion = (async (_u: string, init: RequestInit) => { corps.push(JSON.parse(String(init.body))); return Response.json({ image: { url: png } }); }) as unknown as typeof fetch;
  await detourer('birefnet', original, { cle: 'x', fetch: espion, dormir });
  check('BiRefNet : masque seul, pas d’historique chez fal', [(corps[0] as { mask_only: boolean }).mask_only, (corps[0] as { sync_mode: boolean }).sync_mode], [true, true]);

  const s = await traiter(original, fauxPorts({ detourer: () => Promise.reject(Object.assign(new FalError('birefnet 503', 503, true), { essais: 3, erreurs: ['a', 'b', 'c'] })) }));
  check('fournisseur en panne : failed provider_error', [s.statut, s.statut === 'failed' && s.raison, s.mesures.essais_detourage], ['failed', 'provider_error', 3]);
}

// ---- détourage et étiquetage partent ensemble
{
  const ordre: string[] = [];
  let lacher!: () => void;
  const verrou = new Promise<void>((r) => { lacher = r; });
  const p = traiter(original, fauxPorts({
    detourer: async () => { ordre.push('détourage parti'); await verrou; return { png: new Uint8Array([1]), essais: 1, erreurs: [] }; },
    etiqueter: async () => { ordre.push('étiquetage parti'); return etiqueter(async () => ({ brut: ETIQ, modele: 'faux', coutUsd: 0 })); },
  }));
  await new Promise((r) => setTimeout(r, 20));
  check('les deux appels partent avant toute réponse', ordre, ['détourage parti', 'étiquetage parti']);
  lacher();
  check('puis la pièce est prête', (await p).statut, 'ready');
}

// ---- décision : la paire ne sauve pas deux pièces différentes vues par le modèle
check('paire vue comme plusieurs pièces : refusée', decider({ couverture: 0.3, plusGros: 0.5, deuxPlusGros: 1, morceaux: 2, boite: { x: 0, y: 0, w: 1, h: 1 } }, { ...ETIQ, type: 'baskets', categorie: 'chaussures', piece_unique: false } as never), { statut: 'needs_retake', raison: 'multiple_items' });

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log('\nPipeline : tout passe.');
