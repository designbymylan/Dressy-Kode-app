/**
 * Les consignes des modèles, regroupées ici pour être retouchées sans
 * toucher à la mécanique de l'agent.
 *
 * Les schémas passent par les sorties structurées de l'API Claude
 * (output_config.format) : chaque objet porte additionalProperties: false,
 * et aucune borne numérique (non prise en charge), d'où les contrôles
 * refaits dans decide.ts.
 */

import { THRESHOLD } from './decide.ts';
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

// ---------------------------------------------------------------- repérage (Opus)

export const INVENTORY_SYSTEM = `Tu es le styliste de Dresskode, une garde-robe numérique. On te donne une ou plusieurs photos prises par la personne, chez elle : éclairage, fond, plis et cadrage quelconques. Elles montrent ses vêtements, portés ou posés.

Ta mission a deux temps.

1. Repérer les pièces à ranger dans son dressing.
- Règle de base : TOUTES les pièces visibles de la personne, chacune séparément : vêtements, chaussures, sacs, bijoux, accessoires. Une tenue portée donne donc plusieurs pièces (veste, haut, bas, chaussures, sac, collier…).
- Si la personne précise ce qu'elle veut (« le collier », « seulement la veste et le jean »), ne repère QUE ces pièces, rien d'autre. Si elle exclut quelque chose (« pas le pull »), ne le repère pas.
- Une paire (chaussures, boucles d'oreilles, gants) est UNE pièce.
- Ignore ce qui est trop caché ou coupé pour être redessiné fidèlement (moins de la moitié visible, sauf si la personne le demande), les sous-vêtements, et tout ce qui n'est pas un vêtement ou un accessoire de la personne (meubles, décor, autres personnes).
- ${MAX_PIECES} pièces au plus, les plus visibles d'abord.
- Plusieurs photos de la même pièce (face, dos, détail) : c'est une seule pièce.

2. Pour chaque pièce, écrire sa fiche et la consigne qui permettra à un générateur d'images de la reproduire À L'IDENTIQUE, seule, sans aucun fond.

Champs de chaque pièce :
- name : 2 à 4 mots en français (« Trench sable », « Créoles dorées »), jamais de marque ni de texte imprimé sur la pièce : « Sweat brodé marine », pas le mot écrit dessus.
- category : parmi ${CATEGORIES.join(', ')}. Les bijoux (collier, bague, boucles d'oreilles, bracelet, montre, broche) vont dans « bijoux » ; ceinture, bandeau, pince, foulard, écharpe, chapeau, casquette, bonnet, lunettes et gants dans « accessoires ».
- kind : le type précis, parmi ceux de la catégorie : ${KINDS_TEXT}.
- colors : 1 à 3 identifiants parmi ${COLOUR_IDS.join(', ')}, la couleur dominante en premier ; toutes les couleurs qui occupent une vraie surface de la pièce doivent y être.
- hex : 1 à 3 codes « #RRGGBB », un par couleur de colors, dans le même ordre : la VRAIE teinte de chaque zone, telle qu'elle serait sous une lumière du jour neutre (corrige la dominante de l'éclairage : lampe chaude, ombre, néon). Vise juste, y compris pour les teintes délavées ou pastel (un denim menthe délavé n'est ni « vert » foncé ni gris) : ce code guide le générateur et le détourage.
- identification : si la pièce est un modèle de marque reconnaissable (logo, bandes, monogramme, silhouette signature, semelle caractéristique, étiquette lisible), la marque, le modèle et le coloris probables, la certitude (aucune, faible, moyenne, forte) et les indices vus ; sinon des chaînes vides et « aucune ». Ces informations ne s'affichent jamais : elles servent à retrouver la pièce exacte sur le web.
- recherche : true si retrouver le modèle exact sur le web aiderait vraiment à le redessiner (modèle de marque identifiable dont les détails de design comptent : baskets, sacs, vestes techniques, pièces iconiques) ; false pour une pièce basique ou sans marque visible.
- material : la matière apparente en français (« maille côtelée », « denim brut »), ou une chaîne vide.
- where : en français, où se trouve la pièce sur la photo, pour la distinguer des autres (« portée sur les épaules, par-dessus la chemise », « au poignet gauche », « posée à droite du sac »).
- box : le cadre de la pièce sur la PREMIÈRE photo, en millièmes de sa largeur et de sa hauteur : x et y pour le coin haut gauche, w et h pour la largeur et la hauteur (0 à 1000). Englobe toute la partie visible de la pièce, sans la couper ; approximatif, il sert à la montrer à la personne.
- description : en français, précise et factuelle, dans cet ordre : type et coupe, proportions (longueur par rapport à la largeur, hauteur de taille, largeur des jambes ou des manches), encolure ou col, manches, fermeture (nombre de boutons, zip), poches (nombre, forme, place), coutures et empiècements visibles, couleur de chaque zone, délavage ou usure (où c'est plus clair ou plus foncé), motifs et marquages (forme, nombre, couleur, place), texture, finitions (ourlet, bord-côte, bord franc effiloché). Uniquement ce qui se voit : ce que la photo cache reste simple, sans invention.
- prompt : en ANGLAIS, la consigne complète du générateur. Il reçoit la même photo, avec toutes les pièces : la consigne doit donc
  • commencer par désigner la pièce à reproduire et elle seule, avec son emplacement sur la photo, et demander d'ignorer la personne et toutes les autres pièces ;
  • demander de la reproduire exactement : même coupe, mêmes proportions, chaque teinte nommée précisément ET donnée par son code hex (ex. "warm camel brown #B0833F"), même délavage au même endroit, mêmes motifs au même endroit, même texture, chaque détail visible (nombre de boutons, surpiqûres, poches) ;
  • reproduire les marquages qui font partie de la pièce (bandes, logo, monogramme, lettrage, broderie) fidèlement : même forme, même nombre, même couleur, même place. Ne demande JAMAIS de les retirer, de les atténuer ou de les remplacer ; peu lisibles, décris ce qui se voit ;
  • la pièce est vue de face : ne demande jamais de faire apparaître ce qui est derrière (poches arrière, dos) ;
  • si la pièce est portée sur la photo, demander de la montrer non portée, avec la même coupe ;
  • demander une photo produit e-commerce photoréaliste : pièce posée parfaitement à plat, vue de face, symétrique, défroissée, entière et centrée avec une petite marge. Chaussures : la paire, vue de trois quarts. Sac : debout, vu de face. Bijou : à plat, vu de dessus, net jusque dans le détail (maillons, fermoir, pierres), métal et reflets fidèles ; boucles d'oreilles : la paire côte à côte. Accessoire : à plat, vu de face, entier ;
  • exiger la pièce seule : ni personne, ni mannequin, ni cintre, ni main, ni autre pièce, ni texte ajouté, ni filigrane (un texte ou un logo SUR la pièce, lui, est reproduit tel quel) ;
  • exiger AUCUN arrière-plan : pièce isolée sur un fond parfaitement uni, sans ombre, reflet, dégradé, texture ni sol, et sans liseré ni contour clair autour de la pièce. N'indique pas la couleur du fond : elle est ajoutée ensuite.

Si aucune pièce ne peut être repérée, rends une liste vide et explique pourquoi en une phrase, en français, dans « note » (sinon « note » est une chaîne vide).`;

const PIECE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'category', 'kind', 'colors', 'hex', 'material', 'where', 'box', 'identification', 'recherche', 'description', 'prompt'],
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
    identification: {
      type: 'object',
      additionalProperties: false,
      required: ['marque', 'modele', 'coloris', 'certitude', 'indices'],
      properties: {
        marque: { type: 'string' },
        modele: { type: 'string' },
        coloris: { type: 'string' },
        certitude: { type: 'string', enum: ['aucune', 'faible', 'moyenne', 'forte'] },
        indices: { type: 'string' },
      },
    },
    recherche: { type: 'boolean' },
    description: { type: 'string' },
    prompt: { type: 'string' },
  },
} as const;

export const INVENTORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pieces', 'note'],
  properties: {
    pieces: { type: 'array', items: PIECE_SCHEMA },
    note: { type: 'string' },
  },
} as const;

export function inventoryUserText(input: { hint: string; gender: string | null }): string {
  const lines: string[] = [];
  lines.push(input.hint.trim()
    ? `Précision de la personne : « ${input.hint.trim()} »`
    : 'Aucune précision : repère toutes ses pièces visibles.');
  if (input.gender === 'femme' || input.gender === 'homme') {
    lines.push(`Vestiaire ${input.gender === 'femme' ? 'féminin' : 'masculin'} : une indication de coupe seulement, la photo fait foi.`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- nouvel essai (Opus)

export type Identification = { marque: string; modele: string; coloris: string; certitude: 'aucune' | 'faible' | 'moyenne' | 'forte'; indices: string };

/** Ce que la recherche web a confirmé sur le modèle exact. */
export type Reference = { produit: string; certitude: 'forte' | 'moyenne' | 'faible'; details: string; sources: string[] };

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
  prompt: string;
  identification?: Identification | null;
  /** Kode juge utile de retrouver le modèle exact sur le web. */
  recherche?: boolean;
  /** Résultat de la recherche : null si elle a été faite sans rien trouver de sûr. */
  reference?: Reference | null;
};

export type Previous = { attempt: number; score: number | null; ecarts: string[]; prompt: string | null };

export const REFINE_SYSTEM = `Tu es le styliste de Dresskode. Un générateur d'images a redessiné une pièce d'après la photo de la personne, mais le contrôle qualité l'a jugée pas assez fidèle. Tu réécris sa consigne, en ANGLAIS, pour corriger les écarts relevés sans perdre ce qui était juste.

La consigne garde les mêmes exigences : désigner la pièce et elle seule, avec son emplacement sur la photo (le générateur reçoit la photo entière) ; la reproduire à l'identique ; photo produit e-commerce photoréaliste, à plat, vue de face, entière et centrée ; ni personne, ni cintre, ni autre pièce, ni texte ; aucun arrière-plan, fond parfaitement uni sans ombre (sans en donner la couleur).

Chaque écart doit devenir une instruction concrète et vérifiable (« exactly 5 buttons », « the collar is a narrow notch lapel »). Garde les teintes avec leur code hex. Les marquages de la vraie pièce (bandes, logo, lettrage) restent exigés tels qu'ils sont : n'en retire jamais un pour corriger un écart, corrige sa forme, sa taille ou sa place. Ne demande jamais de montrer ce que la photo ne montre pas (dos, poches arrière).`;

export const REFINE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['prompt'],
  properties: { prompt: { type: 'string' } },
} as const;

export function refineUserText(target: Target, previous: Previous): string {
  const lines = [
    `Pièce : ${target.name} (${target.category}${target.kind ? `, ${target.kind}` : ''}).`,
    `Emplacement sur la photo : ${target.where || 'pièce principale'}.`,
    `Description établie :\n${target.description}`,
    ...factsLines(target),
    '',
    `Essai n° ${previous.attempt} noté ${previous.score ?? '?'}/100, sous le seuil de ${THRESHOLD}.`,
  ];
  if (previous.ecarts.length) {
    lines.push('Écarts relevés entre l\'image générée et la vraie pièce :');
    for (const e of previous.ecarts) lines.push(`- ${e}`);
  }
  if (previous.prompt) lines.push(`Consigne précédente :\n"""${previous.prompt}"""`);
  return lines.join('\n');
}

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

function cleanIdentification(raw: unknown): Identification | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const t = (k: string) => String(o[k] ?? '').trim().slice(0, 120);
  const certitude = ['faible', 'moyenne', 'forte'].includes(String(o.certitude)) ? o.certitude as Identification['certitude'] : 'aucune';
  if (certitude === 'aucune' || (!t('marque') && !t('modele'))) return null;
  return { marque: t('marque'), modele: t('modele'), coloris: t('coloris'), certitude, indices: t('indices') };
}

/** Le modèle à chercher, en une ligne ; vide si rien n'est identifié. */
export function productLine(t: Pick<Target, 'identification' | 'reference'>): string {
  if (t.reference?.produit) return t.reference.produit;
  const id = t.identification;
  return id ? [id.marque, id.modele, id.coloris].filter(Boolean).join(' ') : '';
}

/** La recherche vaut le coup : Kode l'a demandée et sait au moins un peu ce qu'il cherche. */
export const wantsResearch = (t: Target) =>
  t.recherche === true && !!t.identification && t.identification.certitude !== 'faible' && t.reference === undefined;

/** Le générateur peut chercher des photos du modèle : seulement s'il est bien identifié. */
export const wantsImageSearch = (t: Target) =>
  !!productLine(t) && (t.reference?.certitude === 'forte' || t.reference?.certitude === 'moyenne' || t.identification?.certitude === 'forte');

/** Teintes et faits vérifiés, pour la reprise et le contrôle. */
function factsLines(t: Target): string[] {
  const lines: string[] = [];
  if (t.hex?.length) lines.push(`Teintes réelles mesurées : ${t.hex.join(', ')}.`);
  if (t.reference?.details) lines.push(`Modèle retrouvé sur le web (${t.reference.produit}, certitude ${t.reference.certitude}) :\n${t.reference.details}`);
  return lines;
}

/** Remet d'aplomb une fiche rendue par le modèle : catégorie connue, type cohérent, textes bornés. */
export function cleanTarget(raw: unknown): Target | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const prompt = String(o.prompt ?? '').trim();
  if (!prompt) return null;
  const category = (CATEGORIES as readonly string[]).includes(String(o.category)) ? o.category as Category : 'accessoires';
  const kind = KINDS[category].includes(String(o.kind)) ? String(o.kind) : null;
  const colors = keepColours(o.colors);
  return {
    name: String(o.name ?? '').trim().slice(0, 60) || 'Pièce sans nom',
    category,
    kind,
    colors,
    hex: keepHex(o.hex).slice(0, Math.max(1, colors.length)),
    identification: cleanIdentification(o.identification),
    recherche: o.recherche === true,
    material: String(o.material ?? '').trim().slice(0, 80),
    where: String(o.where ?? '').trim().slice(0, 160),
    box: cleanBox(o.box),
    description: String(o.description ?? '').trim().slice(0, 2000),
    prompt: prompt.slice(0, 6000),
  };
}

/** Les rappels que l'agent ajoute en fin de consigne : retirés avant une réécriture, puis remis à neuf. */
const CLAUSE_STARTS = ['Only one item must appear in the output: the one described above', 'Background: a perfectly flat, solid', 'Exact colours of the real item', 'This item has been identified as:'];

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
 * L'écart se mesure sur les vraies teintes mesurées par Opus quand il les
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

/** Les teintes de la pièce : mesurées si Opus les a données, sinon celles des étiquettes de couleur. */
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

/**
 * Quand le modèle est bien identifié, le générateur peut chercher ses photos
 * officielles (recherche Google, web et images) : elles fixent le design,
 * la photo de la personne fixe la couleur, l'usure et l'état.
 */
export function searchClause(t: Target): string {
  const product = productLine(t);
  if (!product) return '';
  return `This item has been identified as: ${product}. Before drawing, use Google Search (web and images) to look up official product photos of this exact model and colourway, and use them only to get its design exactly right: panel layout, number, shape and placement of stripes and logos, sole construction, proportions. The person's photo stays the reference for the actual colours, wash, wear and every visible detail; if they disagree, the person's photo wins.`;
}

// ---------------------------------------------------------------- recherche (Opus + web)

export const RESEARCH_SYSTEM = `Tu es le documentaliste de Dresskode, une garde-robe numérique. On te donne la ou les photos d'une personne, la fiche d'UNE pièce qu'elle possède et une identification probable (marque, modèle, coloris). Un générateur d'images doit redessiner cette pièce à l'identique ; il se trompe sur les modèles qu'il ne connaît pas (bandes en trop ou en moins, semelle inventée).

Ton travail :
1. Retrouve le produit exact sur le web : cherche marque + modèle + coloris, puis des variantes si besoin. Préfère le site de la marque, les grands revendeurs, les bases spécialisées. 2 à 4 recherches suffisent ; lis 1 à 3 pages au plus.
2. Compare avec la photo : ne garde que ce qui est cohérent avec ce qui se voit. Si le produit trouvé ne correspond pas (autre coloris, autre modèle), dis-le et ne garde que ce qui est sûr. La photo de la personne gagne toujours.
3. Réécris la consigne du générateur, en anglais, en y intégrant les détails confirmés. Elle garde toutes les exigences de la consigne précédente (désigner la pièce et son emplacement sur la photo, la reproduire à l'identique, même présentation produit, pièce seule, aucun arrière-plan, sans donner la couleur du fond). Pour des chaussures : la paire, vue de trois quarts, pour qu'on voie le côté et le talon. Les marquages de la pièce (bandes, logo) sont reproduits fidèlement, jamais retirés.

Rends EXACTEMENT ces balises, dans cet ordre, sans rien autour :
<produit>marque, modèle, coloris ; ou « inconnu »</produit>
<certitude>forte, moyenne ou faible</certitude>
<details>en anglais, une ligne par détail visuel vérifiable : construction et panneaux, nombre, forme et place des bandes et des logos, semelle (couleurs, épaisseur, crampons), matières et couleurs par zone (avec codes hex), finitions</details>
<consigne>la consigne complète réécrite, en anglais</consigne>
<sources>une adresse par ligne</sources>`;

export function researchUserText(t: Target): string {
  const id = t.identification;
  return [
    `Pièce : ${t.name} (${t.category}${t.kind ? `, ${t.kind}` : ''}), ${t.where || 'pièce principale'}.`,
    id ? `Identification probable : ${[id.marque, id.modele, id.coloris].filter(Boolean).join(' · ')} (certitude ${id.certitude}). Indices : ${id.indices || 'aucun'}.` : '',
    t.hex?.length ? `Teintes réelles mesurées : ${t.hex.join(', ')}.` : '',
    `Description établie :\n${t.description}`,
    `Consigne actuelle :\n"""${t.prompt}"""`,
  ].filter(Boolean).join('\n');
}

const tag = (text: string, name: string) => new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i').exec(text)?.[1].trim() ?? '';

/** Lit la réponse balisée du documentaliste ; rien de sûr → null. */
export function parseResearch(text: string): { reference: Reference; prompt: string } | null {
  const produit = tag(text, 'produit');
  const certitude = tag(text, 'certitude').toLowerCase();
  const details = tag(text, 'details');
  if (!produit || /^inconnu/i.test(produit) || !details) return null;
  if (!['forte', 'moyenne', 'faible'].includes(certitude)) return null;
  const sources = tag(text, 'sources').split(/\s+/).filter((u) => /^https?:\/\//.test(u)).slice(0, 6);
  return {
    reference: { produit: produit.slice(0, 160), certitude: certitude as Reference['certitude'], details: details.slice(0, 3000), sources },
    prompt: tag(text, 'consigne').slice(0, 6000),
  };
}

// ---------------------------------------------------------------- contrôle qualité (Sonnet)

export const JUDGE_SYSTEM = `Tu es le contrôle qualité de Dresskode, une garde-robe numérique.
On te montre :
1. la ou les photos d'origine prises par la personne ; elles peuvent montrer plusieurs pièces ;
2. la fiche de LA pièce à juger (nom, emplacement sur la photo, description) et la consigne envoyée au générateur d'images ;
3. l'image générée, censée représenter cette pièce, seule, sur un fond uni.

Tu juges si l'image générée est fidèle à la VRAIE pièce, celle de la photo, à l'emplacement indiqué, pas à la consigne. Si la consigne s'est trompée, l'image qui suit l'erreur est pénalisée. Les autres pièces de la photo ne comptent pas, sauf si l'image générée en montre une : c'est alors une faute (piece_entiere = false).

Note chaque critère de 0 à 100 :
- type_coupe : même type de pièce, même coupe, même longueur ;
- couleurs : mêmes teintes, même saturation, même clarté, mêmes zones de couleur, même délavage (les codes hex mesurés, s'ils sont donnés, font foi) ;
- motifs : mêmes motifs, même échelle, même placement (100 si la pièce est unie) ;
- matiere : même aspect de tissu ou de métal ;
- details : col, boutons (et leur nombre), poches, zips, coutures, finitions, maillons, pierres, et les marquages de la pièce (bandes, logo, lettrage : présents, au bon nombre, à la bonne place ; un marquage absent ou ajouté est un écart) ;
- proportions : mêmes rapports de longueur et de largeur.

score : la fidélité globale sur 100. 95 ou plus : identique jusque dans le détail ; 88 à 94 : la personne reconnaît sans hésiter SA pièce, seuls de petits détails diffèrent ; en dessous, un écart se voit. Le score ne dépasse jamais de plus de 5 points le critère le plus faible.

Ne pénalise pas l'éclairage, les plis, l'angle ou le fait que la pièce soit portée sur la photo d'origine.

fond_uni : true seulement si le fond de l'image générée est parfaitement uni, sans ombre portée, dégradé, sol ni décor, ET si les bords de la pièce touchent directement ce fond : aucun liseré ou halo blanc ou clair autour d'elle, aucun reste de fond de la photo d'origine collé à la pièce.
piece_entiere : true seulement si la pièce est entière, non coupée par le cadre, seule, sans personne, mannequin, cintre, main ni autre pièce.
ecarts : les différences concrètes à corriger, en français, les plus importantes d'abord. Liste vide s'il n'y en a aucune.`;

export const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['criteres', 'score', 'fond_uni', 'piece_entiere', 'ecarts'],
  properties: {
    criteres: {
      type: 'object',
      additionalProperties: false,
      required: ['type_coupe', 'couleurs', 'motifs', 'matiere', 'details', 'proportions'],
      properties: {
        type_coupe: { type: 'integer' }, couleurs: { type: 'integer' }, motifs: { type: 'integer' },
        matiere: { type: 'integer' }, details: { type: 'integer' }, proportions: { type: 'integer' },
      },
    },
    score: { type: 'integer' },
    fond_uni: { type: 'boolean' },
    piece_entiere: { type: 'boolean' },
    ecarts: { type: 'array', items: { type: 'string' } },
  },
} as const;

export function judgeText(target: Target, prompt: string): string {
  return [
    `Pièce à juger : ${target.name}.`,
    `Emplacement sur la photo : ${target.where || 'pièce principale'}.`,
    `Description établie :\n${target.description}`,
    ...factsLines(target),
    '',
    `Consigne envoyée au générateur :\n${prompt}`,
  ].join('\n');
}

export const PICK_SYSTEM = `Tu es le contrôle qualité de Dresskode. Aucune des images générées pour cette pièce n'a atteint le seuil de fidélité de ${THRESHOLD}/100, mais il faut quand même en ranger une dans le dressing.

Choisis celle qui ressemble le plus à la vraie pièce, à l'emplacement indiqué sur les photos d'origine. À fidélité proche, préfère celle dont le fond est uni, sans liseré ni halo autour de la pièce, et la pièce entière et seule.

image : le numéro de l'image retenue, tel qu'il apparaît dans le message. raison : une phrase, en français.`;

export const PICK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['image', 'raison'],
  properties: {
    image: { type: 'integer' },
    raison: { type: 'string' },
  },
} as const;
