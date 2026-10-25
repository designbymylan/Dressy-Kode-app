/**
 * Contenu du questionnaire de démarrage.
 *
 * Les `id` sont ce qui part en base (colonnes text[] de `style_profile`) :
 * ils ne doivent pas changer une fois des comptes créés, contrairement aux
 * libellés. D'où la séparation systématique id / label. Un id retiré d'une
 * liste reste dans LEGACY pour que les anciens profils restent lisibles.
 */

export type Option = {
  id: string;
  label: string;
  icon?: string;
  /** N'apparaît que pour ce vestiaire ; les deux si absent. */
  for?: 'femme' | 'homme';
  /** Choix qui exclut tous les autres (« Un peu de tout », « Je n'en porte pas »). */
  alone?: boolean;
};

export type Group = { label: string; options: Option[] };

/** Tracés d'icônes, en viewBox 0 0 24 24, trait seul. */
export const ICONS = {
  cintre: 'M12 5.5a2 2 0 1 1 2 2c-1.1 0-2 .7-2 1.8V11M12 11 3.5 17.2a1 1 0 0 0 .6 1.8h15.8a1 1 0 0 0 .6-1.8L12 11Z',
  horloge: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3.2 2',
  grille: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  feuille: 'M20 4c0 8-5 13-12 13H5c0-8 5-13 12-13ZM5 20c1.5-4 4-6.5 8-8',
  etoile: 'M12 3.5 14.3 9l6 .5-4.6 4 1.4 5.9L12 16.3 6.9 19.4l1.4-5.9-4.6-4 6-.5Z',
  scintille: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2Z',
  carre: 'M5 5h14v14H5z',
  basket: 'M3 16h11l6 1.5V20H3ZM3 16V9l3 1 2 3 5 1',
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
  aucun: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM5.6 5.6l12.8 12.8',

  // hauts
  debardeur: 'M9 3v2a3 3 0 0 0 6 0V3M9 3 7 6v15h10V6l-2-3',
  chemise: 'M8 4 12 7l4-3 5 3-2 4-2-1V21H7V10l-2 1-2-4ZM12 7v14M10 4l2 3 2-3',
  blouse: 'M8 4c1 2 2.5 3 4 3s3-1 4-3l5 3-2 4-2-1V21H7V10l-2 1-2-4ZM9 21l.5-3M15 21l-.5-3',
  polo: 'M8 4 12 6l4-2 5 3-2 4-2-1V21H7V10l-2 1-2-4ZM11 6v4h2V6',
  pull: 'M8 4c.8 1.4 2.3 2 4 2s3.2-.6 4-2l5 3-2 11h-2V10M8 4 3 7l2 11h2V10M7 10v11h10V10M7 19h10',
  cardigan: 'M8 4 12 9l4-5 5 3-2 11h-2v3H7v-3H5L3 7ZM12 9v12M10.5 12h.01M10.5 15h.01M10.5 18h.01',
  sweat: 'M9 4a3 3 0 0 1 6 0M8 5 3 8l2 10h2v3h10v-3h2l2-10-5-3M9 4c0 2 1.3 3 3 3s3-1 3-3M10 14h4',
  // bas
  jean: 'M7 3h10l1.5 18h-4.5L12 10l-2 11H5.5ZM7 6h10',
  tailleur: 'M7 3h10l1 18h-4l-2-11-2 11H6ZM12 3v7',
  chino: 'M7 3h10l1.5 18h-4.5L12 10l-2 11H5.5ZM9 3c0 2 1 3 2 3M15 3c0 2-1 3-2 3',
  jogging: 'M7 3h10l1 16-1.5 2h-3L12 10l-1.5 11h-3L6 19ZM7 5h10',
  legging: 'M8 3h8l-.5 18h-3L12 9l-.5 12h-3Z',
  jupe: 'M8 5h8l3 15H5ZM8 8h8',
  short: 'M6 5h12l1 10h-5l-2-5-2 5H5ZM6 7h12',
  // robes
  robe: 'M9 3l3 2 3-2 1.5 4-2 3L20 21H4l5.5-11-2-3Z',
  combinaison: 'M9 3h6l1 5-1 2 1 11h-4l-.5-8h-1L10 21H6l1-11-1-2Z',
  // vestes et manteaux
  veste: 'M8 3l4 3 4-3 5 3-1 8-3-1v8H7v-8l-3 1-1-8ZM12 6v15',
  blazer: 'M8 3l4 6 4-6 5 3-1 8-3-1v8H7v-8l-3 1-1-8ZM12 9v12M8 3l2 7M16 3l-2 7',
  vesteJean: 'M8 3l4 3 4-3 5 3-1 8-3-1v8H7v-8l-3 1-1-8ZM12 6v15M8 10h2.5M13.5 10H16',
  cuir: 'M8 3l4 3 4-3 5 3-1 8-3-1v8H7v-8l-3 1-1-8ZM10 6l4 15M8 12l2 1',
  trench: 'M8 3l4 3 4-3 4 3-1 6-2-1v14H7V11l-2 1-1-6ZM12 6v15M7 13h10',
  manteau: 'M8 3l4 4 4-4 4 3-1 6-2-1v14H7V11l-2 1-1-6ZM12 7v14M10 11h.01M10 15h.01',
  doudoune: 'M8 4l4 2 4-2 4 3-1 12H5L4 7ZM5 10h14M5 14h14M12 6v13',
  // chaussures
  bottines: 'M7 3h5v9l7 3v5H6ZM6 17h13',
  bottes: 'M8 2h5v13l6 2v4H7ZM7 18h12',
  mocassins: 'M3 15c0-2 2-4 5-4h5c3 0 7 2 8 4v3H3ZM8 11c0 2 2 3 4 3',
  escarpins: 'M4 17c2-4 4-7 6-7 3 0 4 5 10 5v2H9M4 17v4M4 17h3',
  sandales: 'M4 18h16M5 18c0-3 1-6 3-6h4c3 0 6 2 7 6M9 12l2 6M14 13l-1 5',
  ballerines: 'M3 16c0-2 3-4 8-4s10 2 10 4v2H3ZM9 12.5c1 1.5 3 1.5 4 0',
  // bijoux
  bague: 'M12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM9.5 6 12 3l2.5 3-2.5 3Z',
  collier: 'M5 3c0 6 3 10 7 10s7-4 7-10M12 13v2M12 15l-2 2.5 2 2.5 2-2.5Z',
  chaine: 'M5 3c0 6 3 10 7 10s7-4 7-10M7.5 9h.01M12 13h.01M16.5 9h.01',
  puces: 'M8 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM16 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  creoles: 'M8 6a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM16 6a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM8 3v3M16 3v3',
  pendantes: 'M8 3v4M8 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM8 12l-1.5 6h3ZM16 3v4M16 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM16 12l-1.5 6h3Z',
  bracelet: 'M12 6c4.4 0 8 2.7 8 6s-3.6 6-8 6-8-2.7-8-6 3.6-6 8-6ZM12 9c2.8 0 5 1.3 5 3s-2.2 3-5 3-5-1.3-5-3 2.2-3 5-3Z',
  jonc: 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7Z',
  montre: 'M9 3h6l1 4H8ZM9 21h6l1-4H8ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 10v2.2l1.5 1',
  piercing: 'M7 9a5 5 0 0 0 10 0M5.5 8.5h3M15.5 8.5h3',
  cheville: 'M4 14c4 3 12 3 16 0M8 16.5v2M12 17.5v2M16 16.5v2',
  broche: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 3v3M12 18v3M3 12h3M18 12h3',
  // accessoires
  sacamain: 'M6 8h12l1 12H5ZM9 8V6a3 3 0 0 1 6 0v2',
  bandouliere: 'M6 11h12v9H6ZM6 11 12 3l6 8',
  cabas: 'M5 8h14l-1 12H6ZM9 8V5h6v3',
  sacados: 'M7 7h10a2 2 0 0 1 2 2v11H5V9a2 2 0 0 1 2-2ZM9 7V5h6v2M8 14h8',
  pochette: 'M3 8h18v10H3ZM3 8l9 6 9-6',
  banane: 'M4 12c3 3 13 3 16 0M6 13.5 7 11h10l1 2.5M3 12h2M19 12h2',
  casquette: 'M4 15a8 8 0 0 1 16 0ZM4 15h9l8 2',
  bonnet: 'M5 16a7 7 0 0 1 14 0ZM4 16h16v3H4ZM12 9V6',
  chapeau: 'M3 16c0-1.5 4-3 9-3s9 1.5 9 3-4 3-9 3-9-1.5-9-3ZM7 14l1-6c.3-1.3 2-2 4-2s3.7.7 4 2l1 6',
  bandeau: 'M4 16c0-5.5 3.6-10 8-10s8 4.5 8 10M6.5 16c0-4 2.5-7.3 5.5-7.3s5.5 3.3 5.5 7.3',
  pince: 'M4 10h14l2 2-2 2H4ZM7 10v4M11 10v4',
  foulard: 'M4 5h16l-8 9ZM12 14l-2 6M12 14l3 5',
  echarpe: 'M8 3h5v11l-2.5 7L8 14ZM13 7h4v5l-4 1',
  ceinture: 'M3 10h18v4H3ZM13 8.5h4v7h-4Z',
  lunettesSoleil: 'M3 11l2-3M21 11l-2-3M10 13.5c1.3-1 2.7-1 4 0M6.5 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM17.5 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  lunettesVue: 'M3 12h2M19 12h2M10 12.5c1.3-1 2.7-1 4 0M7 9.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM17 9.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  gants: 'M7 21v-8L5 9l1.5-1 2 3V4h2v6V3h2v7V4h2v7l1-3 1.5.5L16 14v7Z',
  cravate: 'M10 3h4l-1 3 2 11-3 4-3-4 2-11Z',
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
  { id: 'tout', label: 'Un peu de tout', icon: ICONS.scintille, alone: true },
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

/**
 * « Ce que tu portes le plus », pièce par pièce. Les bijoux et les
 * accessoires ont désormais leurs propres écrans.
 */
export const ITEM_GROUPS: Group[] = [
  {
    label: 'Hauts',
    options: [
      { id: 'tshirts', label: 'T-shirts', icon: ICONS.tshirt },
      { id: 'debardeurs', label: 'Débardeurs et hauts', icon: ICONS.debardeur },
      { id: 'chemises', label: 'Chemises', icon: ICONS.chemise },
      { id: 'blouses', label: 'Blouses', icon: ICONS.blouse, for: 'femme' },
      { id: 'polos', label: 'Polos', icon: ICONS.polo },
      { id: 'pulls', label: 'Pulls', icon: ICONS.pull },
      { id: 'cardigans', label: 'Gilets et cardigans', icon: ICONS.cardigan },
      { id: 'sweats', label: 'Sweats et sweats à capuche', icon: ICONS.sweat },
    ],
  },
  {
    label: 'Bas',
    options: [
      { id: 'jeans', label: 'Jeans', icon: ICONS.jean },
      { id: 'pantalons', label: 'Pantalons de ville', icon: ICONS.tailleur },
      { id: 'chinos', label: 'Chinos', icon: ICONS.chino },
      { id: 'joggings', label: 'Joggings', icon: ICONS.jogging },
      { id: 'leggings', label: 'Leggings', icon: ICONS.legging, for: 'femme' },
      { id: 'jupes', label: 'Jupes', icon: ICONS.jupe, for: 'femme' },
      { id: 'shorts', label: 'Shorts', icon: ICONS.short },
    ],
  },
  {
    label: 'Robes et combinaisons',
    options: [
      { id: 'robes', label: 'Robes', icon: ICONS.robe, for: 'femme' },
      { id: 'combinaisons', label: 'Combinaisons', icon: ICONS.combinaison, for: 'femme' },
    ],
  },
  {
    label: 'Vestes et manteaux',
    options: [
      { id: 'vestes', label: 'Vestes légères', icon: ICONS.veste },
      { id: 'blazers', label: 'Blazers', icon: ICONS.blazer },
      { id: 'vestes_jean', label: 'Vestes en jean', icon: ICONS.vesteJean },
      { id: 'vestes_cuir', label: 'Vestes en cuir', icon: ICONS.cuir },
      { id: 'trenchs', label: 'Trenchs', icon: ICONS.trench },
      { id: 'manteaux', label: 'Manteaux', icon: ICONS.manteau },
      { id: 'doudounes', label: 'Doudounes', icon: ICONS.doudoune },
    ],
  },
  {
    label: 'Chaussures',
    options: [
      { id: 'baskets', label: 'Baskets', icon: ICONS.basket },
      { id: 'bottines', label: 'Bottines', icon: ICONS.bottines },
      { id: 'bottes', label: 'Bottes', icon: ICONS.bottes },
      { id: 'mocassins', label: 'Mocassins et derbies', icon: ICONS.mocassins },
      { id: 'escarpins', label: 'Escarpins', icon: ICONS.escarpins, for: 'femme' },
      { id: 'sandales', label: 'Sandales', icon: ICONS.sandales },
      { id: 'ballerines', label: 'Ballerines', icon: ICONS.ballerines, for: 'femme' },
    ],
  },
];

export const JEWELRY_GROUPS: Group[] = [
  {
    label: 'Oreilles',
    options: [
      { id: 'puces', label: 'Puces', icon: ICONS.puces },
      { id: 'creoles', label: 'Créoles', icon: ICONS.creoles },
      { id: 'pendantes', label: 'Boucles pendantes', icon: ICONS.pendantes },
      { id: 'piercings', label: 'Piercings', icon: ICONS.piercing },
    ],
  },
  {
    label: 'Cou',
    options: [
      { id: 'colliers', label: 'Colliers à pendentif', icon: ICONS.collier },
      { id: 'chaines', label: 'Chaînes fines', icon: ICONS.chaine },
    ],
  },
  {
    label: 'Mains et poignets',
    options: [
      { id: 'bagues', label: 'Bagues', icon: ICONS.bague },
      { id: 'bracelets', label: 'Bracelets', icon: ICONS.bracelet },
      { id: 'joncs', label: 'Joncs', icon: ICONS.jonc },
      { id: 'montre', label: 'Montre', icon: ICONS.montre },
    ],
  },
  {
    label: 'Et aussi',
    options: [
      { id: 'chevilleres', label: 'Chaînes de cheville', icon: ICONS.cheville },
      { id: 'broches', label: 'Broches', icon: ICONS.broche },
    ],
  },
];

/** « Je n'en porte pas » : exclusif, et sans effet sur ce qu'on aimerait porter. */
export const NO_JEWELRY: Option = { id: 'aucun', label: 'Je ne porte pas de bijoux', icon: ICONS.aucun, alone: true };

export const METALS: { id: string; label: string; fill: string }[] = [
  { id: 'or', label: 'Doré', fill: 'linear-gradient(145deg, #f3dc9a, #c9a55c 55%, #9c7a36)' },
  { id: 'argent', label: 'Argenté', fill: 'linear-gradient(145deg, #f4f6f8, #bfc3c9 55%, #8d9299)' },
  { id: 'or_rose', label: 'Or rose', fill: 'linear-gradient(145deg, #f7d6cd, #d8a7a0 55%, #a97268)' },
  { id: 'mixte', label: 'Je mélange', fill: 'conic-gradient(#c9a55c 0 33%, #bfc3c9 0 66%, #d8a7a0 0)' },
];

export const ACCESSORY_GROUPS: Group[] = [
  {
    label: 'Sacs',
    options: [
      { id: 'sac_main', label: 'Sac à main', icon: ICONS.sacamain },
      { id: 'bandouliere', label: 'Sac bandoulière', icon: ICONS.bandouliere },
      { id: 'cabas', label: 'Cabas ou sac fourre-tout', icon: ICONS.cabas },
      { id: 'sac_dos', label: 'Sac à dos', icon: ICONS.sacados },
      { id: 'pochette', label: 'Pochette', icon: ICONS.pochette },
      { id: 'banane', label: 'Banane', icon: ICONS.banane },
    ],
  },
  {
    label: 'Sur la tête',
    options: [
      { id: 'casquette', label: 'Casquette', icon: ICONS.casquette },
      { id: 'bonnet', label: 'Bonnet', icon: ICONS.bonnet },
      { id: 'chapeau', label: 'Chapeau', icon: ICONS.chapeau },
      { id: 'bandeau', label: 'Bandeau ou serre-tête', icon: ICONS.bandeau },
      { id: 'barrettes', label: 'Pinces et barrettes', icon: ICONS.pince },
    ],
  },
  {
    label: 'Autour du cou',
    options: [
      { id: 'foulard', label: 'Foulard ou carré de soie', icon: ICONS.foulard },
      { id: 'echarpe', label: 'Écharpe', icon: ICONS.echarpe },
      { id: 'cravate', label: 'Cravate ou nœud', icon: ICONS.cravate },
    ],
  },
  {
    label: 'Et aussi',
    options: [
      { id: 'ceinture', label: 'Ceinture', icon: ICONS.ceinture },
      { id: 'lunettes_soleil', label: 'Lunettes de soleil', icon: ICONS.lunettesSoleil },
      { id: 'lunettes_vue', label: 'Lunettes de vue', icon: ICONS.lunettesVue },
      { id: 'gants', label: 'Gants', icon: ICONS.gants },
    ],
  },
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
  // Métaux : surtout pour les bijoux, mais aussi les boucles et les chaînes.
  { id: 'dore', label: 'Doré', hex: '#C9A55C' },
  { id: 'argente', label: 'Argenté', hex: '#BFC3C9' },
];

export const AVOID: Option[] = [
  { id: 'couleurs_vives', label: 'Les couleurs vives', icon: ICONS.contraste },
  { id: 'trop_formel', label: 'Trop habillé', icon: ICONS.mallette },
  { id: 'trop_sportif', label: 'Trop sportif', icon: ICONS.course },
  { id: 'imprimes', label: 'Les imprimés', icon: ICONS.motif },
  { id: 'oversize', label: 'Les coupes amples', icon: ICONS.oversize },
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

/** Et ce qu'on voudrait en faire : gagner du temps n'est pas le but de tout le monde. */
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

export const ITEMS: Option[] = ITEM_GROUPS.flatMap((g) => g.options);
export const JEWELRY: Option[] = [...JEWELRY_GROUPS.flatMap((g) => g.options), NO_JEWELRY];
export const ACCESSORIES: Option[] = ACCESSORY_GROUPS.flatMap((g) => g.options);

/** Anciens identifiants de « ce que tu portes » : plus proposés, toujours lisibles. */
const LEGACY_ITEMS: Option[] = [
  { id: 'chaussures', label: 'Chaussures' },
  { id: 'sacs', label: 'Sacs' },
  { id: 'accessoires', label: 'Accessoires' },
  { id: 'bijoux', label: 'Bijoux' },
];

/** Ce qu'on garde d'une liste pour un vestiaire donné. */
export function forWardrobe(options: Option[], gender: string | null): Option[] {
  return options.filter((o) => !o.for || gender === null || gender === 'non_precise' || gender === 'mixte' || o.for === gender);
}

/**
 * Coche ou décoche `id` dans `list`. Un choix « seul » (Un peu de tout, Je
 * n'en porte pas) efface les autres ; choisir un autre l'efface à son tour.
 */
export function toggleIn(list: string[], id: string, options: Option[]): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  const alone = new Set(options.filter((o) => o.alone).map((o) => o.id));
  return alone.has(id) ? [id] : [...list.filter((x) => !alone.has(x)), id];
}

export type Answers = {
  display_name: string;
  gender: string | null;
  goals: string[];
  styles: string[];
  favourite_items: string[];
  jewelry: string[];
  jewelry_wish: string[];
  metals: string[];
  accessories: string[];
  accessories_wish: string[];
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
  jewelry: [],
  jewelry_wish: [],
  metals: [],
  accessories: [],
  accessories_wish: [],
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
  gender: byId([...GENDERS, { id: 'non_precise', label: 'Non précisé' }, { id: 'mixte', label: 'Les deux' }]),
  goals: byId(GOALS),
  styles: byId(STYLES),
  favourite_items: byId([...ITEMS, ...LEGACY_ITEMS]),
  jewelry: byId(JEWELRY),
  metals: byId(METALS),
  accessories: byId(ACCESSORIES),
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
