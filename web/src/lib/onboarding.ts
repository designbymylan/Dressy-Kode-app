/**
 * Contenu du questionnaire de démarrage.
 *
 * Les `id` sont ce qui part en base (colonnes text[] de `style_profile`) :
 * ils ne doivent pas changer une fois des comptes créés, contrairement aux
 * libellés. D'où la séparation systématique id / label.
 */

import type { IconName } from '@/components/icons';

export type Option = { id: string; label: string; icon?: IconName };

/** Icônes du questionnaire : le jeu d'icônes pleines de l'application. */
export const ICONS = {
  cintre: 'hanger',
  horloge: 'clock',
  grille: 'grid',
  feuille: 'leaf',
  etoile: 'star',
  scintille: 'sparkle',
  carre: 'square',
  basket: 'sneaker',
  tshirt: 'shirt',
  couronne: 'crown',
  retour: 'history',
  course: 'runner',
  valise: 'suitcase',
  oversize: 'expand',
  moulant: 'shrink',
  soleil: 'sun',
  mallette: 'briefcase',
  fete: 'party',
  contraste: 'contrast',
  motif: 'pattern',
  ciseaux: 'scissors',
  cible: 'target',
  nuage: 'cloud',
  sac: 'bag',
  femme: 'woman',
  homme: 'man',
  egal: 'equals',
} as const satisfies Record<string, IconName>;

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
