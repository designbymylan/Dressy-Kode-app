/**
 * Les consignes des trois modèles, regroupées ici pour être retouchées sans
 * toucher à la mécanique de l'agent.
 */

export const CATEGORIES = ['hauts', 'bas', 'robes', 'vestes', 'chaussures', 'sacs', 'bijoux', 'accessoires'] as const;

// Même liste que COLOURS dans web/src/lib/onboarding.ts : les couleurs d'une
// pièce et celles du profil doivent pouvoir se comparer.
export const COLOUR_IDS = [
  'noir', 'anthracite', 'gris', 'blanc', 'creme', 'beige', 'camel', 'marron', 'bordeaux', 'rouge',
  'orange', 'moutarde', 'jaune', 'olive', 'vert', 'marine', 'bleu', 'ciel', 'violet', 'rose',
  'dore', 'argente',
] as const;

// Types de pièce par catégorie : mêmes identifiants que web/src/lib/wardrobe.ts
// (colonne garments.kind, minuscules sans séparateur).
export const KINDS: Record<(typeof CATEGORIES)[number], readonly string[]> = {
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

// ---------------------------------------------------------------- Claude, description

export const DESCRIBE_SYSTEM = `Tu es l'assistant de description de Dressy, une garde-robe numérique.
On te donne une ou plusieurs photos d'UN vêtement, d'UN bijou ou d'UN accessoire qui appartient à la personne, prises chez elle : éclairage, fond, plis et cadrage quelconques.

Ta mission : décrire ce vêtement le plus précisément possible, puis écrire la consigne qui permettra à un générateur d'images de le reproduire À L'IDENTIQUE, seul, sans aucun fond.

Si plusieurs vêtements apparaissent, ne traite que la pièce principale, ou celle que désigne la précision de la personne.

Champs attendus :
- name : 2 à 4 mots en français, sans marque (ex. « Trench sable », « Pull côtelé crème »).
- category : la plus proche parmi ${CATEGORIES.join(', ')}. Les bijoux (collier, bague, boucles d'oreilles, bracelet, montre, broche) vont dans « bijoux » ; ceinture, bandeau, pince, foulard, écharpe, chapeau, casquette, bonnet, lunettes et gants dans « accessoires ».
- kind : le type précis, parmi ceux de la catégorie choisie : ${KINDS_TEXT}.
- colors : 1 à 3 identifiants parmi ${COLOUR_IDS.join(', ')} — la couleur dominante en premier.
- material : la matière apparente en français (« maille côtelée », « denim brut »), ou une chaîne vide si on ne peut pas le dire.
- description : en français, précise et factuelle : type et coupe, longueur, encolure ou col, manches, fermeture (nombre de boutons, zip), poches, coutures visibles, motifs et leur placement, texture, finitions, détails distinctifs.
- prompt : en ANGLAIS, la consigne complète pour le générateur d'images. Elle doit :
  • demander de reproduire exactement le vêtement des photos de référence : même coupe, mêmes proportions, teintes exactes décrites précisément (ex. "warm camel brown"), mêmes motifs au même endroit, même texture, chaque détail visible (nombre de boutons, surpiqûres, poches) ;
  • demander une photo produit e-commerce photoréaliste : pièce posée parfaitement à plat, vue de face, symétrique, défroissée, entière et centrée avec une petite marge. Pour des chaussures : la paire, vue de trois quarts. Pour un sac : posé debout, vu de face. Pour un bijou : posé à plat, vu de dessus, net jusque dans le détail (maillons, fermoir, pierres, gravures), métal et reflets fidèles ; des boucles d'oreilles : la paire côte à côte. Pour un accessoire (ceinture, bandeau, foulard, lunettes, chapeau…) : posé à plat, vu de face, entier ;
  • exiger la pièce seule : ni personne, ni mannequin, ni cintre, ni main, ni accessoire, ni texte, ni filigrane ;
  • exiger AUCUN arrière-plan : la pièce est isolée sur un fond parfaitement uni, sans ombre, reflet, dégradé, texture ni sol.
  N'indique pas de couleur de fond dans le prompt : elle est ajoutée ensuite automatiquement.

Réponds uniquement avec l'outil piece.`;

export const DESCRIBE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'category', 'kind', 'colors', 'material', 'description', 'prompt'],
  properties: {
    name: { type: 'string' },
    category: { type: 'string', enum: [...CATEGORIES] },
    kind: { type: 'string', enum: ALL_KINDS },
    colors: { type: 'array', items: { type: 'string', enum: [...COLOUR_IDS] } },
    material: { type: 'string' },
    description: { type: 'string' },
    prompt: { type: 'string' },
  },
} as const;

export const DESCRIBE_TOOL = {
  name: 'piece',
  description: 'Rend la fiche du vêtement et la consigne du générateur d\'images.',
  input_schema: DESCRIBE_SCHEMA,
} as const;

export type Previous = { attempt: number; score: number | null; ecarts: string[]; prompt: string | null };

export function describeUserText(input: {
  hint: string;
  gender: string | null;
  previous: Previous | null;
}): string {
  const lines: string[] = [];
  lines.push(input.hint.trim() ? `Précision de la personne : « ${input.hint.trim()} »` : 'Aucune précision donnée.');
  if (input.gender === 'femme' || input.gender === 'homme') {
    lines.push(
      `Vestiaire ${input.gender === 'femme' ? 'féminin' : 'masculin'} — une indication de coupe seulement : la photo fait foi.`,
    );
  }
  if (input.previous) {
    const p = input.previous;
    lines.push('');
    lines.push(`Essai précédent (n° ${p.attempt}) : le contrôle qualité l'a noté ${p.score ?? '?'}/100, en dessous du seuil de 95.`);
    if (p.ecarts.length) {
      lines.push('Écarts relevés entre l\'image générée et le vrai vêtement :');
      for (const e of p.ecarts) lines.push(`- ${e}`);
    }
    if (p.prompt) lines.push(`Consigne précédente :\n"""${p.prompt}"""`);
    lines.push('Réécris la consigne pour corriger ces écarts, sans perdre ce qui était juste.');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- fond

/**
 * Nano Banana ne produit pas de vraie transparence : on lui impose un fond
 * uni que l'agent retire ensuite. Pour une pièce très claire, un fond blanc
 * se confondrait avec le tissu et le détourage mangerait le bord de la
 * pièce ; on passe alors sur un gris moyen, franchement différent.
 */
const LIGHT = new Set(['blanc', 'creme', 'beige', 'ciel', 'argente']);

export function backdropFor(colors: readonly string[]): string {
  return LIGHT.has(colors[0]) ? '#808080' : '#FFFFFF';
}

export function backdropClause(colors: readonly string[]): string {
  const hex = backdropFor(colors);
  const name = hex === '#FFFFFF' ? 'pure white' : 'neutral mid-grey';
  return `Background: a perfectly flat, solid ${name} (${hex}) backdrop filling the whole frame edge to edge — no shadow, no gradient, no vignette, no floor, no texture.`;
}

// ---------------------------------------------------------------- Claude

export const JUDGE_SYSTEM = `Tu es le contrôle qualité de Dressy, une garde-robe numérique.
On te montre :
1. la ou les photos d'origine d'un vêtement, prises par la personne à qui il appartient ;
2. la description et la consigne envoyées au générateur d'images ;
3. l'image générée, censée représenter CE vêtement, seul, sur un fond uni.

Tu juges si l'image générée est fidèle au VRAI vêtement, celui des photos — pas à la consigne. Si la consigne s'est trompée, l'image qui suit l'erreur doit être pénalisée.

Note chaque critère de 0 à 100 :
- type_coupe : même type de pièce, même coupe, même longueur ;
- couleurs : mêmes teintes, même saturation, mêmes zones de couleur ;
- motifs : mêmes motifs, même échelle, même placement (100 si la pièce est unie des deux côtés) ;
- matiere : même aspect de tissu (maille, denim, cuir, satin…) ;
- details : col, boutons (et leur nombre), poches, zips, coutures, finitions ;
- proportions : mêmes rapports de longueur et de largeur.

score : la fidélité globale sur 100. 95 ou plus veut dire que la personne reconnaîtrait sans hésiter SON vêtement. Le score ne dépasse jamais de plus de 5 points le critère le plus faible.

Ne pénalise pas l'éclairage, les plis, l'angle, le fond ou la personne visibles sur la photo d'origine.

fond_uni : true seulement si le fond de l'image générée est parfaitement uni, sans ombre portée, dégradé, sol ni décor.
piece_entiere : true seulement si la pièce est entière, non coupée par le cadre, seule, sans personne, mannequin, cintre ni main.
ecarts : les différences concrètes à corriger, en français, les plus importantes d'abord. Liste vide s'il n'y en a aucune.

Réponds uniquement avec l'outil verdict.`;

const score = { type: 'integer', minimum: 0, maximum: 100 } as const;

export const VERDICT_TOOL = {
  name: 'verdict',
  description: "Rend le verdict de fidélité de l'image générée.",
  input_schema: {
    type: 'object',
    required: ['criteres', 'score', 'fond_uni', 'piece_entiere', 'ecarts'],
    properties: {
      criteres: {
        type: 'object',
        required: ['type_coupe', 'couleurs', 'motifs', 'matiere', 'details', 'proportions'],
        properties: {
          type_coupe: score, couleurs: score, motifs: score,
          matiere: score, details: score, proportions: score,
        },
      },
      score,
      fond_uni: { type: 'boolean' },
      piece_entiere: { type: 'boolean' },
      ecarts: { type: 'array', items: { type: 'string' } },
    },
  },
} as const;

export const PICK_SYSTEM = `Tu es le contrôle qualité de Dressy. Aucune des images générées pour ce vêtement n'a atteint le seuil de fidélité de 95/100, mais il faut quand même en ranger une dans le dressing.

Choisis celle qui ressemble le plus au vrai vêtement des photos d'origine. À fidélité proche, préfère celle dont le fond est uni et la pièce entière.

Réponds uniquement avec l'outil choix.`;

export const PICK_TOOL = {
  name: 'choix',
  description: "Désigne l'image à garder.",
  input_schema: {
    type: 'object',
    required: ['image', 'raison'],
    properties: {
      image: { type: 'integer', minimum: 1, description: "Numéro de l'image retenue, tel qu'il apparaît dans le message." },
      raison: { type: 'string', description: 'Une phrase, en français.' },
    },
  },
} as const;
