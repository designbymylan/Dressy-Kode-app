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
- material : la matière apparente en français (« maille côtelée », « denim brut »), ou une chaîne vide.
- where : en français, où se trouve la pièce sur la photo, pour la distinguer des autres (« portée sur les épaules, par-dessus la chemise », « au poignet gauche », « posée à droite du sac »).
- box : le cadre de la pièce sur la PREMIÈRE photo, en millièmes de sa largeur et de sa hauteur : x et y pour le coin haut gauche, w et h pour la largeur et la hauteur (0 à 1000). Englobe toute la partie visible de la pièce, sans la couper ; approximatif, il sert à la montrer à la personne.
- description : en français, précise et factuelle : type et coupe, longueur, encolure ou col, manches, fermeture (nombre de boutons, zip), poches, coutures visibles, motifs et leur placement, texture, finitions, détails distinctifs.
- prompt : en ANGLAIS, la consigne complète du générateur. Il reçoit la même photo, avec toutes les pièces : la consigne doit donc
  • commencer par désigner la pièce à reproduire et elle seule, avec son emplacement sur la photo, et demander d'ignorer la personne et toutes les autres pièces ;
  • demander de la reproduire exactement : même coupe, mêmes proportions, teintes exactes décrites précisément (ex. "warm camel brown"), mêmes motifs au même endroit, même texture, chaque détail visible (nombre de boutons, surpiqûres, poches) ;
  • si la pièce est portée sur la photo, demander de la montrer non portée, avec la même coupe ;
  • demander une photo produit e-commerce photoréaliste : pièce posée parfaitement à plat, vue de face, symétrique, défroissée, entière et centrée avec une petite marge. Chaussures : la paire, vue de trois quarts. Sac : debout, vu de face. Bijou : à plat, vu de dessus, net jusque dans le détail (maillons, fermoir, pierres), métal et reflets fidèles ; boucles d'oreilles : la paire côte à côte. Accessoire : à plat, vu de face, entier ;
  • exiger la pièce seule : ni personne, ni mannequin, ni cintre, ni main, ni autre pièce, ni texte ajouté, ni filigrane (un texte imprimé SUR la pièce, lui, est reproduit tel quel) ;
  • exiger AUCUN arrière-plan : pièce isolée sur un fond parfaitement uni, sans ombre, reflet, dégradé, texture ni sol. N'indique pas la couleur du fond : elle est ajoutée ensuite.

Si aucune pièce ne peut être repérée, rends une liste vide et explique pourquoi en une phrase, en français, dans « note » (sinon « note » est une chaîne vide).`;

const PIECE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'category', 'kind', 'colors', 'material', 'where', 'box', 'description', 'prompt'],
  properties: {
    name: { type: 'string' },
    category: { type: 'string', enum: [...CATEGORIES] },
    kind: { type: 'string', enum: ALL_KINDS },
    colors: { type: 'array', items: { type: 'string', enum: [...COLOUR_IDS] } },
    material: { type: 'string' },
    where: { type: 'string' },
    box: {
      type: 'object',
      additionalProperties: false,
      required: ['x', 'y', 'w', 'h'],
      properties: { x: { type: 'integer' }, y: { type: 'integer' }, w: { type: 'integer' }, h: { type: 'integer' } },
    },
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

export type Target = {
  name: string;
  category: Category;
  kind: string | null;
  colors: string[];
  material: string;
  where: string;
  /** Cadre de la pièce sur la première photo, en fractions (0 à 1) : [x, y, largeur, hauteur]. */
  box?: [number, number, number, number] | null;
  description: string;
  prompt: string;
};

export type Previous = { attempt: number; score: number | null; ecarts: string[]; prompt: string | null };

export const REFINE_SYSTEM = `Tu es le styliste de Dresskode. Un générateur d'images a redessiné une pièce d'après la photo de la personne, mais le contrôle qualité l'a jugée pas assez fidèle. Tu réécris sa consigne, en ANGLAIS, pour corriger les écarts relevés sans perdre ce qui était juste.

La consigne garde les mêmes exigences : désigner la pièce et elle seule, avec son emplacement sur la photo (le générateur reçoit la photo entière) ; la reproduire à l'identique ; photo produit e-commerce photoréaliste, à plat, vue de face, entière et centrée ; ni personne, ni cintre, ni autre pièce, ni texte ; aucun arrière-plan, fond parfaitement uni sans ombre (sans en donner la couleur).

Chaque écart doit devenir une instruction concrète et vérifiable (« exactly 5 buttons », « the collar is a narrow notch lapel »).`;

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

/** Remet d'aplomb une fiche rendue par le modèle : catégorie connue, type cohérent, textes bornés. */
export function cleanTarget(raw: unknown): Target | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const prompt = String(o.prompt ?? '').trim();
  if (!prompt) return null;
  const category = (CATEGORIES as readonly string[]).includes(String(o.category)) ? o.category as Category : 'accessoires';
  const kind = KINDS[category].includes(String(o.kind)) ? String(o.kind) : null;
  return {
    name: String(o.name ?? '').trim().slice(0, 60) || 'Pièce sans nom',
    category,
    kind,
    colors: keepColours(o.colors),
    material: String(o.material ?? '').trim().slice(0, 80),
    where: String(o.where ?? '').trim().slice(0, 160),
    box: cleanBox(o.box),
    description: String(o.description ?? '').trim().slice(0, 2000),
    prompt: prompt.slice(0, 6000),
  };
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
 * de TOUTES les couleurs de la pièce, sinon le détourage mange ses bords.
 * Blanc d'abord (le rendu produit le plus naturel), puis gris moyen, puis
 * vert d'incrustation quand la pièce mêle clair et gris.
 */
const BACKDROPS = [
  { hex: '#FFFFFF', name: 'pure white', rgb: [255, 255, 255] },
  { hex: '#808080', name: 'neutral mid-grey', rgb: [128, 128, 128] },
  { hex: '#00B140', name: 'chroma-key green', rgb: [0, 177, 64] },
] as const;

/** Écart minimal (somme des trois canaux) entre le fond et chaque couleur de la pièce. */
const FAR_ENOUGH = 180;

const dist = (a: readonly number[], b: readonly number[]) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

export function backdropFor(colors: readonly string[]): string {
  const rgbs = colors
    .map((c) => COLOUR_RGB[c as keyof typeof COLOUR_RGB])
    .filter(Boolean);
  if (!rgbs.length) return '#FFFFFF';
  // Le premier fond assez éloigné de chaque couleur gagne ; faute de mieux,
  // celui qui s'en éloigne le plus.
  const margin = BACKDROPS.map((b) => Math.min(...rgbs.map((c) => dist(c, b.rgb))));
  const first = margin.findIndex((m) => m >= FAR_ENOUGH);
  const best = first >= 0 ? first : margin.indexOf(Math.max(...margin));
  return BACKDROPS[best].hex;
}

export function backdropClause(colors: readonly string[]): string {
  const hex = backdropFor(colors);
  const name = BACKDROPS.find((b) => b.hex === hex)!.name;
  return `Background: a perfectly flat, solid ${name} (${hex}) backdrop filling the whole frame edge to edge, with no shadow, no gradient, no vignette, no floor and no texture. The item must not cast any shadow.`;
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
- couleurs : mêmes teintes, même saturation, mêmes zones de couleur ;
- motifs : mêmes motifs, même échelle, même placement (100 si la pièce est unie) ;
- matiere : même aspect de tissu ou de métal ;
- details : col, boutons (et leur nombre), poches, zips, coutures, finitions, maillons, pierres ;
- proportions : mêmes rapports de longueur et de largeur.

score : la fidélité globale sur 100. 95 ou plus : identique jusque dans le détail ; 88 à 94 : la personne reconnaît sans hésiter SA pièce, seuls de petits détails diffèrent ; en dessous, un écart se voit. Le score ne dépasse jamais de plus de 5 points le critère le plus faible.

Ne pénalise pas l'éclairage, les plis, l'angle ou le fait que la pièce soit portée sur la photo d'origine.

fond_uni : true seulement si le fond de l'image générée est parfaitement uni, sans ombre portée, dégradé, sol ni décor.
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
    '',
    `Consigne envoyée au générateur :\n${prompt}`,
  ].join('\n');
}

export const PICK_SYSTEM = `Tu es le contrôle qualité de Dresskode. Aucune des images générées pour cette pièce n'a atteint le seuil de fidélité de ${THRESHOLD}/100, mais il faut quand même en ranger une dans le dressing.

Choisis celle qui ressemble le plus à la vraie pièce, à l'emplacement indiqué sur les photos d'origine. À fidélité proche, préfère celle dont le fond est uni et la pièce entière et seule.

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
