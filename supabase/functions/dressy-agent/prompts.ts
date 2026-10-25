/**
 * Les consignes des modèles, regroupées ici pour être retouchées sans
 * toucher à la mécanique de l'agent.
 *
 * Les schémas passent par les sorties structurées de l'API Claude
 * (output_config.format) : chaque objet porte additionalProperties: false,
 * et aucune borne numérique (non prise en charge), d'où les contrôles
 * refaits dans cleanTarget.
 */

import { chromaOf, tilt } from './cutout.ts';

export const CATEGORIES = ['hauts', 'bas', 'robes', 'vestes', 'chaussures', 'sacs', 'bijoux', 'accessoires'] as const;
export type Category = (typeof CATEGORIES)[number];

// Même liste que COLOURS dans web/src/lib/onboarding.ts : les couleurs d'une
// pièce et celles du profil doivent pouvoir se comparer.
export const COLOUR_IDS = [
  'noir', 'anthracite', 'gris', 'blanc', 'creme', 'beige', 'camel', 'marron', 'bordeaux', 'rouge',
  'orange', 'moutarde', 'jaune', 'olive', 'vert', 'marine', 'bleu', 'ciel', 'violet', 'rose',
  'dore', 'argente',
] as const;

/** Teintes de référence des couleurs, pour choisir un fond qui ne s'y confond pas. */
export const COLOUR_RGB: Record<(typeof COLOUR_IDS)[number], [number, number, number]> = {
  noir: [13, 13, 14], anthracite: [63, 63, 68], gris: [140, 140, 144], blanc: [255, 255, 255],
  creme: [240, 233, 220], beige: [217, 201, 174], camel: [176, 131, 63], marron: [92, 67, 39],
  bordeaux: [107, 31, 46], rouge: [178, 43, 39], orange: [210, 96, 26], moutarde: [201, 153, 43],
  jaune: [232, 195, 58], olive: [90, 99, 64], vert: [47, 107, 72], marine: [38, 51, 77],
  bleu: [74, 118, 168], ciel: [168, 200, 224], violet: [107, 78, 140], rose: [217, 149, 159],
  dore: [201, 165, 92], argente: [191, 195, 201],
};

// Types de pièce par catégorie : mêmes identifiants que web/src/lib/wardrobe.ts
// (colonne garments.kind, minuscules sans séparateur).
export const KINDS: Record<Category, readonly string[]> = {
  hauts: ['tshirt', 'chemise', 'blouse', 'pull', 'sweat', 'debardeur', 'top'],
  bas: ['jean', 'pantalon', 'jupe', 'short', 'legging'],
  robes: ['robe', 'combinaison'],
  vestes: ['veste', 'blazer', 'manteau', 'trench', 'doudoune', 'gilet'],
  chaussures: ['baskets', 'bottines', 'bottes', 'escarpins', 'sandales', 'mocassins', 'ballerines'],
  sacs: ['sacamain', 'bandouliere', 'pochette', 'cabas', 'sacados'],
  bijoux: ['collier', 'boucles', 'bracelet', 'bague', 'montre', 'broche'],
  accessoires: ['ceinture', 'bandeau', 'pince', 'foulard', 'echarpe', 'chapeau', 'casquette', 'bonnet', 'lunettes', 'gants'],
};
const ALL_KINDS = [...new Set(Object.values(KINDS).flat())];
const KINDS_TEXT = Object.entries(KINDS).map(([c, ks]) => `${c} → ${ks.join(', ')}`).join(' ; ');

/** Au-delà, une photo de groupe ou de penderie coûterait trop cher en une fois. */
export const MAX_PIECES = 6;

// ---------------------------------------------------------------- repérage

export const SURVEY_SYSTEM = `Tu es le styliste de Dresskode, une garde-robe numérique. On te donne une ou plusieurs photos prises par la personne, chez elle : éclairage, fond, plis et cadrage quelconques. Elles montrent ses vêtements, portés ou posés. Tu repères les pièces à ranger dans son dressing, vite et juste : leur image sera découpée dans la photo, pas redessinée.

Règles de repérage :
- Par défaut : TOUTES les pièces visibles, chacune séparément : vêtements, chaussures, sacs, bijoux, accessoires. Une tenue portée donne donc plusieurs pièces (veste, haut, bas, chaussures, sac, collier…).
- Si la personne précise ce qu'elle veut (« le collier », « seulement la veste et le jean »), ne repère QUE ces pièces. Si elle exclut quelque chose (« pas le pull »), ne le repère pas.
- Une paire (chaussures, boucles d'oreilles, gants) est UNE pièce.
- Ignore ce qui est trop caché ou coupé pour être découpé proprement (moins de la moitié visible, sauf si la personne le demande), les sous-vêtements, et tout ce qui n'est pas un vêtement ou un accessoire de la personne (meubles, décor, autres personnes).
- ${MAX_PIECES} pièces au plus, les plus visibles d'abord.
- Plusieurs photos de la même pièce (face, dos, détail) : c'est une seule pièce.

Champs de chaque pièce :
- name : 2 à 4 mots en français (« Trench sable », « Créoles dorées »), jamais de marque ni de texte imprimé sur la pièce.
- category : parmi ${CATEGORIES.join(', ')}. Les bijoux (collier, bague, boucles d'oreilles, bracelet, montre, broche) vont dans « bijoux » ; ceinture, bandeau, pince, foulard, écharpe, chapeau, casquette, bonnet, lunettes et gants dans « accessoires ».
- kind : le type précis, parmi ceux de la catégorie : ${KINDS_TEXT}.
- colors : 1 à 3 identifiants parmi ${COLOUR_IDS.join(', ')}, la couleur dominante en premier ; toutes les couleurs qui occupent une vraie surface de la pièce.
- hex : 1 à 3 codes « #RRGGBB », un par couleur de colors, dans le même ordre : la vraie teinte de chaque zone sous une lumière du jour neutre (corrige la dominante de l'éclairage : lampe chaude, ombre, néon).
- material : la matière apparente en français (« maille côtelée », « denim brut »), ou une chaîne vide.
- where : en français, où se trouve la pièce sur la photo, pour la distinguer des autres (« portée sur les épaules, par-dessus la chemise », « au poignet gauche », « posée à droite du sac »).
- box : le cadre de la pièce sur la PREMIÈRE photo, en millièmes de sa largeur et de sa hauteur : x et y pour le coin haut gauche, w et h pour la largeur et la hauteur (0 à 1000). Englobe toute la partie visible de la pièce, sans la couper. Il guide la découpe.
- description : en ANGLAIS, une à deux phrases factuelles (coupe, longueur, col, manches, fermeture, motifs, marquages visibles). Uniquement ce qui se voit.

Si aucune pièce ne peut être repérée, rends une liste vide et explique pourquoi en une phrase, en français, dans « note » (sinon « note » est une chaîne vide).`;

const PIECE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'category', 'kind', 'colors', 'hex', 'material', 'where', 'box', 'description'],
  properties: {
    name: { type: 'string' },
    category: { type: 'string', enum: [...CATEGORIES] },
    kind: { type: 'string', enum: ALL_KINDS },
    colors: { type: 'array', items: { type: 'string', enum: [...COLOUR_IDS] } },
    hex: { type: 'array', items: { type: 'string' } },
    material: { type: 'string' },
    where: { type: 'string' },
    box: {
      type: 'object',
      additionalProperties: false,
      required: ['x', 'y', 'w', 'h'],
      properties: { x: { type: 'integer' }, y: { type: 'integer' }, w: { type: 'integer' }, h: { type: 'integer' } },
    },
    description: { type: 'string' },
  },
} as const;

export const SURVEY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pieces', 'note'],
  properties: {
    pieces: { type: 'array', items: PIECE_SCHEMA },
    note: { type: 'string' },
  },
} as const;

export function surveyUserText(input: { hint: string; gender: string | null }): string {
  const lines: string[] = [];
  lines.push(input.hint.trim()
    ? `Précision de la personne : « ${input.hint.trim()} »`
    : 'Aucune précision : repère toutes ses pièces visibles.');
  if (input.gender === 'femme' || input.gender === 'homme') {
    lines.push(`Vestiaire ${input.gender === 'femme' ? 'féminin' : 'masculin'} : une indication de coupe seulement, la photo fait foi.`);
  }
  return lines.join('\n');
}

export type Target = {
  name: string;
  category: Category;
  kind: string | null;
  colors: string[];
  /** Les vraies teintes, « #RRGGBB », dans l'ordre de colors. */
  hex?: string[];
  material: string;
  where: string;
  /** Cadre de la pièce sur la première photo, en fractions (0 à 1) : [x, y, largeur, hauteur]. */
  box?: [number, number, number, number] | null;
  description: string;
  /** Consigne du générateur : ne sert qu'au « rendu incorrect » de second niveau. */
  prompt: string;
};


/**
 * Le cadre rendu en millièmes, ramené en fractions de la photo et remis
 * d'aplomb : dans l'image, jamais minuscule. Illisible, il est ignoré.
 */
export function cleanBox(raw: unknown): [number, number, number, number] | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const n = ['x', 'y', 'w', 'h'].map((k) => Number(o[k]));
  if (n.some((v) => !Number.isFinite(v))) return null;
  const f = (v: number) => Math.min(1, Math.max(0, v / 1000));
  const x = f(n[0]), y = f(n[1]);
  const w = Math.min(f(n[2]), 1 - x), h = Math.min(f(n[3]), 1 - y);
  if (w < 0.02 || h < 0.02) return null;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return [r(x), r(y), r(w), r(h)];
}

const keepColours = (v: unknown) => (Array.isArray(v) ? v : [])
  .map(String)
  .filter((c) => (COLOUR_IDS as readonly string[]).includes(c))
  .filter((c, i, all) => all.indexOf(c) === i)
  .slice(0, 3);

const keepHex = (v: unknown) => (Array.isArray(v) ? v : [])
  .map((x) => String(x).trim().toUpperCase())
  .filter((x) => /^#[0-9A-F]{6}$/.test(x))
  .slice(0, 3);

/** La consigne de repli du générateur, bâtie par gabarit à partir de la fiche (jamais écrite à la main). */
export function fallbackPrompt(t: Pick<Target, 'name' | 'category' | 'where' | 'description' | 'hex'>): string {
  const shape = t.category === 'chaussures'
    ? 'the pair, three-quarter view'
    : t.category === 'sacs' ? 'standing upright, seen from the front'
      : t.category === 'bijoux' ? 'laid flat, seen from above, sharp down to the finest detail (links, clasp, stones)'
        : 'laid perfectly flat, seen from the front, symmetrical, wrinkle-free';
  return [
    `Reproduce ONLY this item from the reference photo: "${t.name}"${t.where ? `, location in the photo: "${t.where}"` : ''}. Ignore the person and every other item.`,
    t.description ? `What it is: ${t.description}` : '',
    'Reproduce it exactly: same cut, proportions, colours, wash, patterns, texture and every visible detail (buttons, stitching, pockets). Logos, stripes and lettering that are part of the item stay exactly as they are: same shape, count, colour and place.',
    `Photorealistic e-commerce product photo, ${shape}, whole item centred with a small margin. The item alone: no person, mannequin, hanger, hand, other item, added text or watermark.`,
  ].filter(Boolean).join('\n\n');
}

/** Remet d'aplomb une fiche rendue par le modèle : catégorie connue, type cohérent, textes bornés. */
export function cleanTarget(raw: unknown): Target | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const name = String(o.name ?? '').trim().slice(0, 60);
  const description = String(o.description ?? '').trim().slice(0, 600);
  if (!name && !description) return null;
  const category = (CATEGORIES as readonly string[]).includes(String(o.category)) ? o.category as Category : 'accessoires';
  const kind = KINDS[category].includes(String(o.kind)) ? String(o.kind) : null;
  const colors = keepColours(o.colors);
  const t = {
    name: name || 'Pièce sans nom',
    category,
    kind,
    colors,
    hex: keepHex(o.hex).slice(0, Math.max(1, colors.length)),
    material: String(o.material ?? '').trim().slice(0, 80),
    where: String(o.where ?? '').trim().slice(0, 160),
    box: cleanBox(o.box),
    description,
  };
  return { ...t, prompt: String(o.prompt ?? '').trim().slice(0, 6000) || fallbackPrompt(t) };
}


/** Les rappels que l'agent ajoute en fin de consigne : retirés avant de les remettre à neuf. */
const CLAUSE_STARTS = ['Only one item must appear in the output: the one described above', 'Background: a perfectly flat, solid', 'Exact colours of the real item'];

export function stripClauses(prompt: string): string {
  return prompt
    .split(/\n{2,}/)
    .filter((para) => !CLAUSE_STARTS.some((c) => para.trim().startsWith(c)))
    .join('\n\n')
    .trim();
}

/** Rappel ajouté à toute consigne : sur une photo à plusieurs pièces, le générateur ne doit en dessiner qu'une. */
export function isolationClause(target: Pick<Target, 'name' | 'where'>): string {
  const where = target.where ? `, location in the photo: "${target.where}"` : '';
  return `Only one item must appear in the output: the one described above (French label: "${target.name}"${where}). The reference photo may show a person and other clothes or accessories: ignore all of them.`;
}

// ---------------------------------------------------------------- fond

/**
 * Nano Banana ne produit pas de vraie transparence : on lui impose un fond
 * uni que l'agent retire ensuite. Le fond doit être le plus éloigné possible
 * de TOUTES les teintes de la pièce, sinon le détourage mange ses bords.
 * Blanc d'abord (le rendu produit le plus naturel), puis vert d'incrustation,
 * puis magenta quand la pièce a déjà du vert ; gris moyen en dernier.
 *
 * L'écart se mesure sur les vraies teintes mesurées par Kodi quand il les
 * donne : avec la seule étiquette « vert », un denim menthe délavé passait
 * pour un vert foncé et partait sur fond gris, trop proche de lui (04/10).
 *
 * Le gris ne sert plus qu'aux bijoux et métaux : les ombres d'un vêtement
 * clair (revers d'un jean, plis d'une chemise) passent par le gris moyen et
 * s'y faisaient découper (essai du 04/10). Sur fond vert, le détourage lit la
 * couleur et non la clarté : l'ombre bleutée d'un denim reste à sa place.
 * Un métal, lui, refléterait le vert : il garde le gris.
 */
const WHITE = { hex: '#FFFFFF', name: 'pure white', rgb: [255, 255, 255] } as const;
const GREY = { hex: '#808080', name: 'neutral mid-grey', rgb: [128, 128, 128] } as const;
const GREEN = { hex: '#00B140', name: 'chroma-key green', rgb: [0, 177, 64] } as const;
const MAGENTA = { hex: '#FF00FF', name: 'pure magenta', rgb: [255, 0, 255] } as const;
const BACKDROPS = [WHITE, GREY, GREEN, MAGENTA];

/**
 * Assez loin, selon le fond :
 * - neutre (blanc, gris) : le détourage mesure la distance brute (somme des
 *   trois canaux) ; 240 pour le blanc (les reflets clairs d'une pièce s'en
 *   approchent), 180 pour le gris ;
 * - incrustation (vert, magenta) : il mesure la dominante de couleur ; la
 *   pièce doit en avoir peu (40 % au plus de celle du fond) et rester
 *   perceptivement loin (ΔE ≥ 40).
 * Un métal brillant reste sur fond neutre : il refléterait le vert partout.
 */
const NEUTRAL_FAR = { white: 240, grey: 180 };
const CHROMA_FAR = 40;
const CHROMA_TILT = 0.4;

const rgbDist = (a: readonly number[], b: readonly number[]) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/** Marge d'un fond pour une teinte : 1 ou plus, assez loin ; en dessous, la part du chemin faite. */
function margin(bg: readonly number[], c: readonly number[]): number {
  const chroma = chromaOf(bg as [number, number, number]);
  if (!chroma) return rgbDist(bg, c) / (bg[0] > 200 ? NEUTRAL_FAR.white : NEUTRAL_FAR.grey);
  const room = (CHROMA_TILT * chroma.strength) / Math.max(tilt(c, chroma), 1e-3);
  return Math.min(deltaE(bg, c) / CHROMA_FAR, room);
}

export function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** sRGB → CIELAB (D65). */
export function lab(rgb: readonly number[]): [number, number, number] {
  const lin = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const x = (lin[0] * 0.4124 + lin[1] * 0.3576 + lin[2] * 0.1805) / 0.95047;
  const y = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722;
  const z = (lin[0] * 0.0193 + lin[1] * 0.1192 + lin[2] * 0.9505) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export const deltaE = (a: readonly number[], b: readonly number[]) => {
  const p = lab(a), q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

/** Les teintes de la pièce : mesurées si Kodi les a données, sinon celles des étiquettes de couleur. */
export function garmentRgbs(colors: readonly string[], hex: readonly string[] = []): [number, number, number][] {
  const measured = hex.map(hexRgb).filter((x): x is [number, number, number] => x !== null);
  if (measured.length) return measured;
  return colors.map((c) => COLOUR_RGB[c as keyof typeof COLOUR_RGB]).filter(Boolean) as [number, number, number][];
}

/** Bijou, métal brillant : il refléterait un fond de couleur. */
export function isMetal(t: { category?: string; colors: readonly string[]; material?: string }): boolean {
  return t.category === 'bijoux' || t.colors.some((c) => c === 'argente' || c === 'dore') || /m[ée]tal|argent|acier|laiton|chrom|plaqu[ée] or/i.test(t.material ?? '');
}

export function backdropFor(colors: readonly string[], hex: readonly string[] = [], metal = colors.some((c) => c === 'argente' || c === 'dore')): string {
  const rgbs = garmentRgbs(colors, hex);
  if (!rgbs.length) return WHITE.hex;
  const order = metal ? [WHITE, GREY, GREEN, MAGENTA] : [WHITE, GREEN, MAGENTA, GREY];
  // Le premier fond assez éloigné de chaque teinte gagne ; faute de mieux,
  // celui qui s'en éloigne le plus.
  const margins = order.map((b) => Math.min(...rgbs.map((c) => margin(b.rgb, c))));
  const first = margins.findIndex((m) => m >= 1);
  const best = first >= 0 ? first : margins.indexOf(Math.max(...margins));
  return order[best].hex;
}

export function backdropClause(colors: readonly string[], hex: readonly string[] = [], metal?: boolean): string {
  const bg = backdropFor(colors, hex, metal);
  const name = BACKDROPS.find((b) => b.hex === bg)!.name;
  return `Background: a perfectly flat, solid ${name} (${bg}) backdrop filling the whole frame edge to edge, with no shadow, no gradient, no vignette, no floor and no texture. The item must not cast any shadow, and its edges meet the backdrop directly: no white outline, no halo, no sticker border, no leftover patch of the original photo.`;
}

/** Les vraies teintes, rappelées au générateur en fin de consigne. */
export function colourClause(t: Pick<Target, 'hex'>): string {
  if (!t.hex?.length) return '';
  const [main, ...rest] = t.hex;
  return `Exact colours of the real item, measured on the photo and corrected for its lighting: ${main} (main colour)${rest.length ? `, ${rest.join(', ')}` : ''}. Match these hues, saturation and lightness; do not brighten, darken, desaturate or wash them out.`;
}
