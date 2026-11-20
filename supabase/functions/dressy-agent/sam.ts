/**
 * Le détourage par SAM 3 (20/11), logique pure : la consigne envoyée au
 * modèle, la zone de la photo à lui montrer, le choix du ou des masques
 * qu'il rend, la lecture d'un masque. Aucun réseau ici (l'appel est dans
 * fal.ts) : ce fichier tourne tel quel dans les tests (Node).
 *
 * Pourquoi SAM 3 : c'est un modèle de segmentation, il rend un masque, pas
 * une image. La pièce est découpée dans la photo de la personne : ses
 * pixels, ses couleurs, ses logos, rien n'est redessiné. 0,005 $ l'appel,
 * quelques secondes, contre 0,03 à 0,05 $ et 30 à 75 s pour un dessin.
 *
 * Une consigne en anglais courant (« jacket », « sneaker ») : SAM 3 trouve
 * TOUTES les occurrences du concept sur l'image. Le cadre relevé au repérage
 * dit laquelle est la pièce (ou lesquelles, pour une paire).
 */
import type { Raster } from './cutout.ts';
import type { Category, Target } from './prompts.ts';

/** Le nom anglais de chaque type de pièce (garments.kind), tel que SAM 3 le comprend le mieux. */
export const SAM_KIND: Record<string, string> = {
  // hauts
  tshirt: 't-shirt', chemise: 'shirt', blouse: 'blouse', polo: 'polo shirt', pull: 'sweater', sweat: 'sweatshirt',
  capuche: 'hoodie', debardeur: 'tank top', top: 'top',
  // bas
  jean: 'jeans', pantalon: 'pants', chino: 'pants', jupe: 'skirt', jupeculotte: 'skirt', short: 'shorts', legging: 'leggings',
  // robes
  robe: 'dress', combinaison: 'jumpsuit', salopette: 'overalls',
  // vestes
  veste: 'jacket', blazer: 'blazer', manteau: 'coat', trench: 'trench coat', doudoune: 'puffer jacket', gilet: 'cardigan',
  // chaussures : SAM 3 rend chaque chaussure à part, la paire est réunie ensuite
  baskets: 'sneaker', bottines: 'boot', bottes: 'boot', escarpins: 'shoe', sandales: 'sandal', mules: 'shoe',
  mocassins: 'shoe', derbies: 'shoe', ballerines: 'shoe',
  // sacs
  sacamain: 'handbag', bandouliere: 'bag', pochette: 'bag', cabas: 'tote bag', sacados: 'backpack',
  // bijoux
  collier: 'necklace', boucles: 'earring', bracelet: 'bracelet', bague: 'ring', montre: 'watch', broche: 'brooch',
  // accessoires
  ceinture: 'belt', bandeau: 'headband', pince: 'hair clip', foulard: 'scarf', echarpe: 'scarf', chapeau: 'hat',
  casquette: 'cap', bonnet: 'beanie', lunettes: 'glasses', gants: 'glove',
};

/** Faute de type connu (tâches anciennes), le nom de la catégorie. */
export const SAM_CATEGORY: Record<Category, string> = {
  hauts: 'top', bas: 'pants', robes: 'dress', vestes: 'jacket', chaussures: 'shoe', sacs: 'bag', bijoux: 'jewelry', accessoires: 'accessory',
};

/** La consigne de SAM 3 pour une pièce. */
export const samPrompt = (t: Pick<Target, 'kind' | 'category'>): string =>
  (t.kind && SAM_KIND[t.kind]) || SAM_CATEGORY[t.category] || 'clothing';

/** Une paire se rend en deux masques (une chaussure, une boucle, un gant) : ils sont réunis. */
export const estPaire = (t: Pick<Target, 'kind' | 'category'>): boolean =>
  t.category === 'chaussures' || t.kind === 'boucles' || t.kind === 'gants';

type Zone = { x: number; y: number; w: number; h: number };

/**
 * La zone de la photo montrée à SAM 3 : le cadre du repérage, élargi de 25 %
 * de chaque côté (le cadre d'un modèle de vision coupe souvent un bord), au
 * moins 4 % de la photo. Sans cadre, ou pour une reprise : toute la photo.
 * Plus la pièce occupe la zone, plus le masque est fin.
 */
export function zoneSam(box: readonly number[] | null | undefined, W: number, H: number, pad = 0.25): Zone {
  if (!box) return { x: 0, y: 0, w: W, h: H };
  const px = Math.max(box[2] * pad, 0.04), py = Math.max(box[3] * pad, 0.04);
  const e = 1e-6; // 0,3 − 0,1 = 0,19999999999999998 : sans cela, le plancher retire un pixel
  const x0 = Math.max(0, Math.floor((box[0] - px) * W + e));
  const y0 = Math.max(0, Math.floor((box[1] - py) * H + e));
  const x1 = Math.min(W, Math.ceil((box[0] + box[2] + px) * W - e));
  const y1 = Math.min(H, Math.ceil((box[1] + box[3] + py) * H - e));
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/** Le cadre du repérage ramené dans la zone, en fractions de la zone : [x, y, largeur, hauteur]. */
export function cadreDansZone(box: readonly number[], zone: Zone, W: number, H: number): [number, number, number, number] {
  const x = (box[0] * W - zone.x) / zone.w, y = (box[1] * H - zone.y) / zone.h;
  return [x, y, (box[2] * W) / zone.w, (box[3] * H) / zone.h];
}

/** Ce que SAM 3 rend pour un masque : son cadre (fractions [cx, cy, l, h] de l'image envoyée) et sa confiance. */
export type MasqueInfo = { box: readonly number[] | null; score: number | null };

const xywh = (b: readonly number[]): [number, number, number, number] => [b[0] - b[2] / 2, b[1] - b[3] / 2, b[2], b[3]];

/** Part de `a` contenue dans `b` (deux cadres [x, y, l, h]). */
function dedans(a: readonly number[], b: readonly number[]): number {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  if (w <= 0 || h <= 0 || a[2] <= 0 || a[3] <= 0) return 0;
  return (w * h) / (a[2] * a[3]);
}

/**
 * Les masques à essayer, du plus probable au moins probable. Chaque choix est
 * une liste d'indices (une paire en réunit plusieurs).
 *
 * - Avec le cadre du repérage : un masque doit être pour moitié au moins
 *   dedans ; on préfère celui qui le remplit le mieux, à confiance voisine.
 * - Une paire : tous les masques bien dedans, réunis (deux au plus de plus
 *   que la paire, pour une chaussure coupée en deux).
 * - Sans cadre : par confiance, puis par taille.
 *
 * Les contrôles automatiques (checks.ts) départagent ensuite les trois
 * premiers choix : du calcul local, sans nouvel appel.
 */
export function choisirMasques(masques: MasqueInfo[], cadre: readonly number[] | null, paire: boolean): number[][] {
  const score = (m: MasqueInfo) => (m.score ?? 0.5);
  const aire = (m: MasqueInfo) => (m.box ? m.box[2] * m.box[3] : 0);
  const idx = masques.map((_, i) => i);

  if (!cadre) {
    const tri = idx.sort((a, b) => score(masques[b]) - score(masques[a]) || aire(masques[b]) - aire(masques[a]));
    if (paire) {
      const sures = tri.filter((i) => score(masques[i]) >= 0.5).slice(0, 4);
      return sures.length ? [sures, ...tri.slice(0, 2).map((i) => [i])] : tri.slice(0, 3).map((i) => [i]);
    }
    return tri.slice(0, 3).map((i) => [i]);
  }

  // Un masque sans cadre ne peut pas être placé : il ne passe qu'en dernier recours.
  const place = idx.map((i) => {
    const m = masques[i];
    if (!m.box) return { i, dedans: 0, remplit: 0 };
    const b = xywh(m.box);
    return { i, dedans: dedans(b, cadre), remplit: dedans(cadre, b) };
  });
  const bien = place.filter((p) => p.dedans >= 0.5);

  if (paire) {
    const tous = bien.filter((p) => p.dedans >= 0.6 && score(masques[p.i]) >= 0.3).sort((a, b) => score(masques[b.i]) - score(masques[a.i])).slice(0, 4).map((p) => p.i);
    const seuls = bien.sort((a, b) => b.remplit - a.remplit).slice(0, 2).map((p) => [p.i]);
    return tous.length ? [tous.sort((a, b) => a - b), ...seuls.filter((s) => !(tous.length === 1 && s[0] === tous[0]))] : seuls;
  }

  const note = (p: (typeof place)[number]) => 0.45 * p.remplit + 0.35 * p.dedans + 0.2 * score(masques[p.i]);
  const tri = (bien.length ? bien : place).sort((a, b) => note(b) - note(a));
  return tri.slice(0, 3).map((p) => [p.i]);
}

/**
 * Un masque rendu par SAM 3, ramené à une carte de probabilité (canal rouge,
 * 0 à 255) que `cutFromMask` sait étirer. Les masques sont en principe en
 * noir et blanc ; un masque à transparence (objet opaque sur fond vide) est
 * lu par son opacité, sinon par sa luminosité.
 */
export function carteDuMasque(m: Raster): Raster {
  const { width: w, height: h, data } = m;
  let opaques = 0, vides = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] >= 128) opaques++;
    else vides++;
  }
  const parOpacite = opaques > 0 && vides > 0;
  const out = new Uint8Array(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const v = parOpacite ? data[i + 3] : Math.round(Math.max(data[i], data[i + 1], data[i + 2]) * (data[i + 3] / 255));
    out[i] = out[i + 1] = out[i + 2] = v;
    out[i + 3] = 255;
  }
  return { width: w, height: h, data: out };
}

/** Plusieurs cartes de même taille réunies (une paire) : le maximum, pixel par pixel. */
export function reunir(cartes: Raster[]): Raster {
  const [premiere, ...autres] = cartes;
  const data = new Uint8Array(premiere.data);
  for (const c of autres) {
    if (c.width !== premiere.width || c.height !== premiere.height) continue;
    for (let i = 0; i < data.length; i += 4) if (c.data[i] > data[i]) data[i] = data[i + 1] = data[i + 2] = c.data[i];
  }
  return { width: premiere.width, height: premiere.height, data };
}
