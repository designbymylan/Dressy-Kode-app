/**
 * Contenu du questionnaire de démarrage.
 *
 * Les `id` sont ce qui part en base (colonnes text[] de `style_profile`) :
 * ils ne doivent pas changer une fois des comptes créés, contrairement aux
 * libellés. D'où la séparation systématique id / label.
 */

export type Option = { id: string; label: string; icon?: string };

/** Tracés d'icônes, en viewBox 0 0 24 24, trait seul. */
export const ICONS = {
  cintre: 'M12 5.5a2 2 0 1 1 2 2c-1.1 0-2 .7-2 1.8V11M12 11 3.5 17.2a1 1 0 0 0 .6 1.8h15.8a1 1 0 0 0 .6-1.8L12 11Z',
  horloge: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3.2 2',
  grille: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  feuille: 'M20 4c0 8-5 13-12 13H5c0-8 5-13 12-13ZM5 20c1.5-4 4-6.5 8-8',
  etoile: 'M12 3.5 14.3 9l6 .5-4.6 4 1.4 5.9L12 16.3 6.9 19.4l1.4-5.9-4.6-4 6-.5Z',
  scintille: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2Z',
  carre: 'M5 5h14v14H5z',
  basket: 'M3 16h11l5 2H3zM3 16v-4l4-2 3 3h4',
  tshirt: 'M8 4 12 6.5 16 4l5 2.5-2 4-2-1V20H7V9.5l-2 1-2-4Z',
  couronne: 'M4 17 5 7l4.5 4L12 5l2.5 6L19 7l1 10Z',
  retour: 'M12 7v5l3 2M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5v4h4',
  course: 'M13.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 21l2.5-5.5L8 12l1-5 3.5 2 3 1M6 9l3-2M14 14l2.5 2 1 5',
  valise: 'M4 8h16v12H4zM9 8V5h6v3',
  oversize: 'M10 4H4v6M4 4l6 6M14 20h6v-6M20 20l-6-6',
  moulant: 'M4 10h6V4M10 10 4 4M20 14h-6v6M14 14l6 6',
  soleil: 'M12 5V3M12 21v-2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  mallette: 'M4 8h16v12H4zM9 8V5h6v3M4 13h16',
  fete: 'M4 20 9 7l8 8-13 5ZM14 4v2M18 3l-1.4 1.4M20 8h-2',
  contraste: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 3v18',
  motif: 'M12 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  ciseaux: 'M6 5l12 12M18 5 6 17M6 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM6 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  cible: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 11.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Z',
  nuage: 'M7 18a4 4 0 0 1 .6-7.96A5.5 5.5 0 0 1 18 11a3.5 3.5 0 0 1 0 7Z',
  sac: 'M6 8h12l1 12H5ZM9 8V6a3 3 0 0 1 6 0v2',
  femme: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM9 10h6l2 7h-3l-.5 4h-3L10 17H7Z',
  homme: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM9.5 10h5l1.5 7h-2.5v4h-3v-4H8Z',
  egal: 'M5 10h14M5 14h14',
} as const;

export const GENDERS: Option[] = [
  { id: 'femme', label: 'Femme', icon: ICONS.femme },
  { id: 'homme', label: 'Homme', icon: ICONS.homme },
];

export const GOALS: Option[] = [
  { id: 'mieux', label: 'Mieux m’habiller', icon: ICONS.cintre },
  { id: 'temps', label: 'Gagner du temps', icon: ICONS.horloge },
  { id: 'dressing', label: 'Exploiter mon dressing', icon: ICONS.grille },
  { id: 'moins', label: 'Acheter moins, mieux', icon: ICONS.feuille },
  { id: 'style', label: 'Trouver mon style', icon: ICONS.etoile },
  { id: 'tout', label: 'Un peu de tout', icon: ICONS.scintille },
];

export const STYLES: Option[] = [
  { id: 'minimal', label: 'Minimal', icon: ICONS.carre },
  { id: 'streetwear', label: 'Streetwear', icon: ICONS.basket },
  { id: 'decontracte', label: 'Décontracté', icon: ICONS.tshirt },
  { id: 'smart_casual', label: 'Smart casual', icon: ICONS.mallette },
  { id: 'old_money', label: 'Old money', icon: ICONS.couronne },
  { id: 'vintage', label: 'Vintage', icon: ICONS.retour },
  { id: 'sportif', label: 'Sportif', icon: ICONS.course },
  { id: 'chic', label: 'Chic', icon: ICONS.etoile },
  { id: 'oversize', label: 'Oversize', icon: ICONS.oversize },
];

export const ITEMS: Option[] = [
  { id: 'tshirts', label: 'T-shirts' },
  { id: 'chemises', label: 'Chemises' },
  { id: 'pulls', label: 'Pulls' },
  { id: 'sweats', label: 'Sweats' },
  { id: 'vestes', label: 'Vestes' },
  { id: 'robes', label: 'Robes' },
  { id: 'jupes', label: 'Jupes' },
  { id: 'pantalons', label: 'Pantalons' },
  { id: 'jeans', label: 'Jeans' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'baskets', label: 'Baskets' },
  { id: 'chaussures', label: 'Chaussures' },
  { id: 'sacs', label: 'Sacs' },
  { id: 'accessoires', label: 'Accessoires' },
];

export const COLOURS: { id: string; label: string; hex: string }[] = [
  { id: 'noir', label: 'Noir', hex: '#0D0D0E' },
  { id: 'anthracite', label: 'Anthracite', hex: '#3F3F44' },
  { id: 'gris', label: 'Gris', hex: '#8C8C90' },
  { id: 'blanc', label: 'Blanc', hex: '#FFFFFF' },
  { id: 'creme', label: 'Crème', hex: '#F0E9DC' },
  { id: 'beige', label: 'Beige', hex: '#D9C9AE' },
  { id: 'camel', label: 'Camel', hex: '#B0833F' },
  { id: 'marron', label: 'Marron', hex: '#5C4327' },
  { id: 'bordeaux', label: 'Bordeaux', hex: '#6B1F2E' },
  { id: 'rouge', label: 'Rouge', hex: '#B22B27' },
  { id: 'orange', label: 'Orange', hex: '#D2601A' },
  { id: 'moutarde', label: 'Moutarde', hex: '#C9992B' },
  { id: 'jaune', label: 'Jaune', hex: '#E8C33A' },
  { id: 'olive', label: 'Vert olive', hex: '#5A6340' },
  { id: 'vert', label: 'Vert', hex: '#2F6B48' },
  { id: 'marine', label: 'Bleu marine', hex: '#26334D' },
  { id: 'bleu', label: 'Bleu', hex: '#4A76A8' },
  { id: 'ciel', label: 'Ciel', hex: '#A8C8E0' },
  { id: 'violet', label: 'Violet', hex: '#6B4E8C' },
  { id: 'rose', label: 'Rose', hex: '#D9959F' },
];

export const AVOID: Option[] = [
  { id: 'couleurs_vives', label: 'Les couleurs vives', icon: ICONS.contraste },
  { id: 'trop_formel', label: 'Trop habillé', icon: ICONS.mallette },
  { id: 'trop_sportif', label: 'Trop sportif', icon: ICONS.course },
  { id: 'imprimes', label: 'Les imprimés', icon: ICONS.motif },
  { id: 'oversize', label: 'L’oversize', icon: ICONS.oversize },
  { id: 'moulant', label: 'Le moulant', icon: ICONS.moulant },
  { id: 'court', label: 'Les pièces courtes', icon: ICONS.ciseaux },
];

export const OCCASIONS: Option[] = [
  { id: 'quotidien', label: 'Le quotidien', icon: ICONS.soleil },
  { id: 'travail', label: 'Le travail', icon: ICONS.mallette },
  { id: 'sorties', label: 'Les sorties', icon: ICONS.fete },
  { id: 'sport', label: 'Le sport', icon: ICONS.course },
  { id: 'ceremonies', label: 'Les cérémonies', icon: ICONS.etoile },
  { id: 'voyages', label: 'Les voyages', icon: ICONS.valise },
];

/** Le temps réellement passé à s'habiller le matin, aujourd'hui. */
export const MORNING_TIME: Option[] = [
  { id: 'express', label: 'Moins de 5 minutes', icon: ICONS.horloge },
  { id: 'court', label: '5 à 15 minutes', icon: ICONS.horloge },
  { id: 'pose', label: '15 à 30 minutes', icon: ICONS.horloge },
  { id: 'long', label: 'Plus de 30 minutes', icon: ICONS.horloge },
];

/** Et ce qu'on voudrait en faire — gagner du temps n'est pas le but de tout le monde. */
export const TIME_INTENT: Option[] = [
  { id: 'gagner', label: 'En gagner', icon: ICONS.horloge },
  { id: 'prendre', label: 'En prendre plus', icon: ICONS.scintille },
  { id: 'ca_va', label: 'Ça me va comme ça', icon: ICONS.egal },
];

export const ASSISTANCE: Option[] = [
  { id: 'surprise', label: 'Surprends-moi', icon: ICONS.scintille },
  { id: 'fidele', label: 'Reste fidèle à mon style', icon: ICONS.cible },
  { id: 'meteo', label: 'Habille-moi selon la météo', icon: ICONS.nuage },
  { id: 'dressing', label: 'Fais parler mon dressing', icon: ICONS.cintre },
  { id: 'achats', label: 'Aide-moi à mieux acheter', icon: ICONS.sac },
];

export type Answers = {
  display_name: string;
  gender: string | null;
  goals: string[];
  styles: string[];
  favourite_items: string[];
  colours: string[];
  avoid: string[];
  occasions: string[];
  morning_time: string | null;
  time_intent: string | null;
  assistance: string | null;
};

export const EMPTY_ANSWERS: Answers = {
  display_name: '',
  gender: null,
  goals: [],
  styles: [],
  favourite_items: [],
  colours: [],
  avoid: [],
  occasions: [],
  morning_time: null,
  time_intent: null,
  assistance: null,
};

const byId = (list: { id: string; label: string }[]) =>
  new Map(list.map((o) => [o.id, o.label]));

const LABELS = {
  gender: byId([...GENDERS, { id: 'non_precise', label: 'Non précisé' }]),
  goals: byId(GOALS),
  styles: byId(STYLES),
  favourite_items: byId(ITEMS),
  colours: byId(COLOURS),
  avoid: byId(AVOID),
  occasions: byId(OCCASIONS),
  morning_time: byId(MORNING_TIME),
  time_intent: byId(TIME_INTENT),
  assistance: byId(ASSISTANCE),
};

/** Traduit des identifiants stockés en libellés lisibles. */
export function labelsFor(key: keyof typeof LABELS, ids: string[] | string | null): string[] {
  if (!ids) return [];
  const list = Array.isArray(ids) ? ids : [ids];
  return list.map((id) => LABELS[key].get(id) ?? id);
}

export function colourHex(id: string): string {
  return COLOURS.find((c) => c.id === id)?.hex ?? '#888888';
}
