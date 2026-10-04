/**
 * Données de démonstration : un dressing plausible de 37 pièces, sans
 * aucune marque. Tout ce qui est calculé (compteurs, taux d'usage,
 * « oubliées ») part d'ici, pour qu'aucun chiffre affiché ne soit inventé
 * à côté des données.
 */
import type { GarmentKind } from '../ui/Garment';

export type CategoryId = 'manteaux' | 'hauts' | 'bas' | 'robes' | 'chaussures' | 'accessoires';
export type Season = 'toute l’année' | 'mi-saison' | 'hiver' | 'été';

export type Piece = {
  id: string;
  name: string;
  kind: GarmentKind;
  tint?: string;
  /** La vignette détourée que Kode a dessinée d'après une photo (URL signée) ; sinon l'illustration de `kind`. */
  image?: string;
  category: CategoryId;
  color: string;
  /** L'identifiant de couleur de Kode (« vert », « creme »…), pour les pièces du compte. */
  colorId?: string;
  swatch: string;
  material: string;
  season: Season;
  wears: number;
  /** Jours depuis le dernier port ; null : jamais portée. */
  lastWorn: number | null;
  addedDaysAgo: number;
  price?: number;
};

export const CATEGORIES: { id: CategoryId; title: string; short: string }[] = [
  { id: 'manteaux', title: 'Manteaux et vestes', short: 'Manteaux' },
  { id: 'hauts', title: 'Hauts', short: 'Hauts' },
  { id: 'bas', title: 'Bas', short: 'Bas' },
  { id: 'robes', title: 'Robes', short: 'Robes' },
  { id: 'chaussures', title: 'Chaussures', short: 'Chaussures' },
  { id: 'accessoires', title: 'Sacs et accessoires', short: 'Accessoires' },
];

/**
 * Les couleurs que Kode note sur une photo (supabase/functions/dressy-agent/prompts.ts,
 * COLOUR_RGB) : identifiant en base, libellé, teinte de référence.
 */
export const COLOURS: { id: string; label: string; hex: string }[] = [
  { id: 'noir', label: 'Noir', hex: '#0D0D0E' }, { id: 'anthracite', label: 'Anthracite', hex: '#3F3F44' },
  { id: 'gris', label: 'Gris', hex: '#8C8C90' }, { id: 'blanc', label: 'Blanc', hex: '#F7F5F0' },
  { id: 'creme', label: 'Crème', hex: '#F0E9DC' }, { id: 'beige', label: 'Beige', hex: '#D9C9AE' },
  { id: 'camel', label: 'Camel', hex: '#B0833F' }, { id: 'marron', label: 'Marron', hex: '#5C4327' },
  { id: 'bordeaux', label: 'Bordeaux', hex: '#6B1F2E' }, { id: 'rouge', label: 'Rouge', hex: '#B22B27' },
  { id: 'orange', label: 'Orange', hex: '#D2601A' }, { id: 'moutarde', label: 'Moutarde', hex: '#C9992B' },
  { id: 'jaune', label: 'Jaune', hex: '#E8C33A' }, { id: 'olive', label: 'Olive', hex: '#5A6340' },
  { id: 'vert', label: 'Vert', hex: '#2F6B48' }, { id: 'marine', label: 'Marine', hex: '#26334D' },
  { id: 'bleu', label: 'Bleu', hex: '#4A76A8' }, { id: 'ciel', label: 'Ciel', hex: '#A8C8E0' },
  { id: 'violet', label: 'Violet', hex: '#6B4E8C' }, { id: 'rose', label: 'Rose', hex: '#D9959F' },
  { id: 'dore', label: 'Doré', hex: '#C9A55C' }, { id: 'argente', label: 'Argenté', hex: '#BFC3C9' },
];

export const SEASONS: Season[] = ['toute l’année', 'mi-saison', 'hiver', 'été'];

const p = (
  id: string, name: string, kind: GarmentKind, category: CategoryId, color: string, swatch: string,
  material: string, season: Season, wears: number, lastWorn: number | null, addedDaysAgo: number, price?: number, tint?: string,
): Piece => ({ id, name, kind, category, color, swatch, material, season, wears, lastWorn, addedDaysAgo, price, tint });

export const PIECES: Piece[] = [
  p('m1', 'Trench camel', 'trench', 'manteaux', 'Camel', '#C49A6C', 'Gabardine de coton', 'mi-saison', 14, 12, 420, 180),
  p('m2', 'Blazer noir', 'blazer', 'manteaux', 'Noir', '#3A3C41', 'Laine mélangée', 'toute l’année', 22, 3, 600, 120),
  p('m3', 'Blazer lin', 'blazer', 'manteaux', 'Sable', '#D8C7A8', 'Lin', 'été', 0, null, 150, 89, '#D8C7A8'),
  p('m4', 'Trench marine', 'trench', 'manteaux', 'Marine', '#2F3B52', 'Gabardine de coton', 'mi-saison', 3, 60, 300, 160, '#2F3B52'),
  p('m5', 'Blazer chocolat', 'blazer', 'manteaux', 'Chocolat', '#6E5A48', 'Laine', 'hiver', 6, 25, 380, 95, '#6E5A48'),
  p('h1', 'Marinière', 'mariniere', 'hauts', 'Blanc et marine', '#2B3A5C', 'Coton', 'toute l’année', 31, 5, 700, 45),
  p('h2', 'Pull côtelé crème', 'pull', 'hauts', 'Crème', '#EDE3D1', 'Laine', 'hiver', 9, 35, 400, 70),
  p('h3', 'Chemise ciel', 'chemise', 'hauts', 'Ciel', '#C9DAEA', 'Popeline de coton', 'toute l’année', 5, 20, 260, 55),
  p('h4', 'Pull bordeaux', 'pull', 'hauts', 'Bordeaux', '#8A3B3B', 'Laine', 'hiver', 2, 90, 330, 65, '#8A3B3B'),
  p('h5', 'Chemise blanche', 'chemise', 'hauts', 'Blanc', '#F4F1EA', 'Popeline de coton', 'toute l’année', 26, 2, 800, 50, '#F4F1EA'),
  p('h6', 'T-shirt blanc', 'tshirt', 'hauts', 'Blanc', '#F5F3EE', 'Jersey de coton', 'toute l’année', 40, 1, 500, 20),
  p('h7', 'T-shirt noir', 'tshirt', 'hauts', 'Noir', '#2B2B2E', 'Jersey de coton', 'toute l’année', 25, 6, 500, 20, '#2B2B2E'),
  p('h8', 'Cardigan écru', 'cardigan', 'hauts', 'Écru', '#EDE3D1', 'Laine et coton', 'mi-saison', 18, 8, 460, 60),
  p('h9', 'Pull gris chiné', 'pull', 'hauts', 'Gris', '#A7A29A', 'Laine', 'hiver', 12, 15, 520, 55, '#A7A29A'),
  p('h10', 'Chemise sauge', 'chemise', 'hauts', 'Sauge', '#A9B79C', 'Lin', 'été', 1, 200, 240, 49, '#A9B79C'),
  p('b1', 'Jean brut', 'jean', 'bas', 'Brut', '#3E5A86', 'Denim', 'toute l’année', 40, 2, 900, 90),
  p('b2', 'Jean clair', 'jean', 'bas', 'Bleu clair', '#9DB4CF', 'Denim', 'toute l’année', 12, 18, 400, 80, '#9DB4CF'),
  p('b3', 'Jupe plissée olive', 'jupe', 'bas', 'Olive', '#7B7F4F', 'Crêpe', 'mi-saison', 4, 45, 350, 60),
  p('b4', 'Pantalon noir', 'pantalon', 'bas', 'Noir', '#2B2B2E', 'Laine froide', 'toute l’année', 19, 4, 650, 85),
  p('b5', 'Pantalon beige', 'pantalon', 'bas', 'Beige', '#CDBB9C', 'Coton', 'mi-saison', 7, 22, 300, 70, '#CDBB9C'),
  p('b6', 'Jupe noire', 'jupe', 'bas', 'Noir', '#26231F', 'Crêpe', 'toute l’année', 9, 30, 480, 55, '#26231F'),
  p('r1', 'Robe noire', 'robe', 'robes', 'Noir', '#26231F', 'Crêpe', 'toute l’année', 7, 40, 700, 110),
  p('r2', 'Robe terracotta', 'robe', 'robes', 'Terracotta', '#B5603A', 'Viscose', 'été', 2, 120, 380, 75, '#B5603A'),
  p('r3', 'Robe vert sapin', 'robe', 'robes', 'Vert sapin', '#2F4A3C', 'Satin', 'hiver', 0, null, 90, 130, '#2F4A3C'),
  p('c1', 'Baskets blanches', 'baskets', 'chaussures', 'Blanc', '#F5F3EE', 'Cuir', 'toute l’année', 55, 1, 800, 110),
  p('c2', 'Mocassins cognac', 'mocassins', 'chaussures', 'Cognac', '#7E4F2C', 'Cuir', 'toute l’année', 20, 12, 600, 140),
  p('c3', 'Bottines noires', 'bottines', 'chaussures', 'Noir', '#2A2624', 'Cuir', 'hiver', 16, 30, 700, 160),
  p('c4', 'Escarpins nude', 'escarpins', 'chaussures', 'Nude', '#D9B8A0', 'Cuir velours', 'toute l’année', 3, 150, 500, 120, '#D9B8A0'),
  p('c5', 'Escarpins noirs', 'escarpins', 'chaussures', 'Noir', '#26231F', 'Cuir', 'toute l’année', 5, 60, 650, 110),
  p('a1', 'Cabas cognac', 'sac', 'accessoires', 'Cognac', '#A8703E', 'Cuir', 'toute l’année', 30, 3, 750, 150),
  p('a2', 'Sac noir', 'sac', 'accessoires', 'Noir', '#26231F', 'Cuir', 'toute l’année', 12, 40, 600, 130, '#26231F'),
  p('a3', 'Foulard soie', 'foulard', 'accessoires', 'Camel et crème', '#C49A6C', 'Soie', 'toute l’année', 3, 70, 400, 60),
  p('a4', 'Foulard marine', 'foulard', 'accessoires', 'Marine', '#2F3B52', 'Soie', 'toute l’année', 1, 210, 380, 55, '#2F3B52'),
  p('m6', 'Veste matelassée', 'veste', 'manteaux', 'Kaki', '#5D6147', 'Nylon recyclé', 'hiver', 11, 20, 500, 120),
  p('h11', 'Débardeur côtelé', 'debardeur', 'hauts', 'Noir', '#2B2B2E', 'Coton côtelé', 'été', 14, 50, 420, 18, '#2B2B2E'),
  p('b7', 'Short en lin', 'short', 'bas', 'Écru', '#E7DCC6', 'Lin', 'été', 6, 80, 300, 45),
  p('a5', 'Ceinture cognac', 'ceinture', 'accessoires', 'Cognac', '#7E4F2C', 'Cuir', 'toute l’année', 21, 9, 700, 40),
];

/** Ce que la reconnaissance trouve sur une photo (simulée dans l'aperçu). */
export type Found = { kind: GarmentKind; tint: string; name: string; category: CategoryId; color: string; material: string; season: Season; backdrop: string };

/** La galerie simulée du téléphone : douze photos de vêtements, chacune « reconnue ». */
export const GALLERY: Found[] = [
  { kind: 'tshirt', tint: '#F5F3EE', name: 'T-shirt blanc', category: 'hauts', color: 'Blanc', material: 'Coton', season: 'toute l’année', backdrop: '#CFC7BC' },
  { kind: 'jean', tint: '#3E5A86', name: 'Jean brut', category: 'bas', color: 'Brut', material: 'Denim', season: 'toute l’année', backdrop: '#D8D2C8' },
  { kind: 'cardigan', tint: '#B98B5E', name: 'Cardigan camel', category: 'hauts', color: 'Camel', material: 'Laine', season: 'mi-saison', backdrop: '#D9CFC2' },
  { kind: 'baskets', tint: '#F5F3EE', name: 'Baskets blanches', category: 'chaussures', color: 'Blanc', material: 'Cuir', season: 'toute l’année', backdrop: '#BFC4C8' },
  { kind: 'robe', tint: '#C9A13B', name: 'Robe moutarde', category: 'robes', color: 'Moutarde', material: 'Viscose', season: 'été', backdrop: '#DAD3C4' },
  { kind: 'trench', tint: '#C49A6C', name: 'Trench camel', category: 'manteaux', color: 'Camel', material: 'Gabardine de coton', season: 'mi-saison', backdrop: '#CCC4B8' },
  { kind: 'jupe', tint: '#2F3B52', name: 'Jupe plissée marine', category: 'bas', color: 'Marine', material: 'Crêpe', season: 'toute l’année', backdrop: '#C9CCD2' },
  { kind: 'chemise', tint: '#E3BFB7', name: 'Chemise rose poudré', category: 'hauts', color: 'Rose poudré', material: 'Coton', season: 'été', backdrop: '#E6DDD8' },
  { kind: 'pantalon', tint: '#7B7F4F', name: 'Pantalon olive', category: 'bas', color: 'Olive', material: 'Coton', season: 'mi-saison', backdrop: '#D2D2C6' },
  { kind: 'bottines', tint: '#6E4A32', name: 'Bottines chocolat', category: 'chaussures', color: 'Chocolat', material: 'Daim', season: 'hiver', backdrop: '#D5CBC0' },
  { kind: 'sac', tint: '#26231F', name: 'Sac noir', category: 'accessoires', color: 'Noir', material: 'Cuir', season: 'toute l’année', backdrop: '#CFCAC2' },
  { kind: 'pull', tint: '#A7A29A', name: 'Pull gris chiné', category: 'hauts', color: 'Gris', material: 'Laine', season: 'hiver', backdrop: '#D3CEC6' },
];

/** Une photo reconnue devient une pièce du dressing. */
export function pieceFrom(f: Found, id: string): Piece {
  return { id, name: f.name, kind: f.kind, tint: f.tint, category: f.category, color: f.color, swatch: f.tint, material: f.material, season: f.season, wears: 0, lastWorn: null, addedDaysAgo: 0 };
}

export type Outfit = {
  id: string;
  lead: string;
  em: string;
  pieces: string[];
  why: string;
};

/** Les propositions du jour : la première est la tenue du jour, les suivantes répondent à « Une autre ». */
export const TODAY_OUTFITS: Outfit[] = [
  {
    id: 'o1', lead: 'Pluie fine,\nallure ', em: 'nette.',
    pieces: ['m1', 'h2', 'b1', 'a1', 'c2'],
    why: 'Le trench tient l’averse de midi, le pull crème adoucit le jean. Tu ne l’as pas mis depuis cinq semaines.',
  },
  {
    id: 'o2', lead: 'Marine et camel,\nsans ', em: 'effort.',
    pieces: ['m4', 'h5', 'b5', 'a3', 'c2'],
    why: 'Le trench marine sort enfin : trois ports seulement. Le foulard reprend le cognac des mocassins.',
  },
  {
    id: 'o3', lead: 'Douce et\n', em: 'pratique.',
    pieces: ['h8', 'h6', 'b3', 'a2', 'c3'],
    why: 'Les bottines gardent tes pieds au sec, et la jupe plissée n’a pas bougé depuis six semaines.',
  },
];

export type Weather = { t: number; low: number; kind: 'soleil' | 'nuages' | 'pluie' | 'averses'; label: string };

/** La météo en un mot, pour les lignes courtes. */
export const WEATHER_WORD: Record<Weather['kind'], string> = { soleil: 'soleil', nuages: 'nuageux', pluie: 'pluie', averses: 'averses' };

/** Météo simulée des 14 prochains jours (jour 0 = aujourd'hui). */
export const WEATHER: Weather[] = [
  { t: 14, low: 9, kind: 'averses', label: 'averses vers midi' },
  { t: 16, low: 10, kind: 'nuages', label: 'nuageux' },
  { t: 18, low: 11, kind: 'soleil', label: 'ensoleillé' },
  { t: 15, low: 10, kind: 'pluie', label: 'pluie l’après-midi' },
  { t: 13, low: 8, kind: 'nuages', label: 'couvert' },
  { t: 17, low: 10, kind: 'soleil', label: 'ensoleillé' },
  { t: 19, low: 12, kind: 'soleil', label: 'grand beau' },
  { t: 16, low: 11, kind: 'nuages', label: 'voilé' },
  { t: 14, low: 9, kind: 'averses', label: 'averses' },
  { t: 19, low: 12, kind: 'soleil', label: 'ensoleillé' },
  { t: 17, low: 11, kind: 'nuages', label: 'nuageux' },
  { t: 15, low: 9, kind: 'pluie', label: 'pluie' },
  { t: 14, low: 8, kind: 'nuages', label: 'couvert' },
  { t: 16, low: 10, kind: 'soleil', label: 'ensoleillé' },
];

export type AgendaEvent = {
  id: string;
  day: number;
  time: string;
  title: string;
  place?: string;
  /** Un événement « occasion » ouvre la fiche Événement et le Pack Occasion. */
  occasion?: { dressCode: string; details: string };
};

export const EVENTS: AgendaEvent[] = [
  { id: 'e1', day: 0, time: '10 h', title: 'Réunion client', place: 'Bureau' },
  { id: 'e2', day: 1, time: '20 h', title: 'Dîner chez Léa', place: 'Chez Léa' },
  { id: 'e3', day: 3, time: '18 h 30', title: 'Yoga', place: 'Studio' },
  { id: 'e4', day: 4, time: '9 h 30', title: 'Présentation trimestrielle', place: 'Bureau' },
  {
    id: 'e5', day: 9, time: '15 h', title: 'Mariage de Juliette et Tom', place: 'Mairie, puis jardin',
    occasion: { dressCode: 'Chic champêtre', details: 'Cérémonie à 15 h, dîner dehors jusqu’à tard.' },
  },
  { id: 'e6', day: 11, time: '12 h 30', title: 'Déjeuner avec maman' },
];

export const FRIENDS = [
  { id: 'f1', name: 'Léa' },
  { id: 'f2', name: 'Inès' },
  { id: 'f3', name: 'Chloé' },
  { id: 'f4', name: 'Sarah' },
  { id: 'f5', name: 'Manon' },
];

export const STYLES = ['Minimal', 'Classique', 'Bohème', 'Urbain', 'Romantique', 'Sportswear chic', 'Vintage', 'Audacieux'];

export const COLOR_CHOICES = [
  { name: 'Noir', hex: '#26231F' },
  { name: 'Blanc', hex: '#F7F5F0' },
  { name: 'Camel', hex: '#C49A6C' },
  { name: 'Marine', hex: '#2F3B52' },
  { name: 'Gris', hex: '#A7A29A' },
  { name: 'Bordeaux', hex: '#8A3B3B' },
  { name: 'Olive', hex: '#7B7F4F' },
  { name: 'Ciel', hex: '#C9DAEA' },
  { name: 'Terracotta', hex: '#B5603A' },
  { name: 'Rose poudré', hex: '#E3BFB7' },
  { name: 'Vert sapin', hex: '#2F4A3C' },
  { name: 'Moutarde', hex: '#C9A13B' },
];

/** Familles de couleurs pour filtrer : huit choix lisibles plutôt que vingt-six nuances. */
export const COLOR_FAMILIES: { name: string; hex: string; members: string[] }[] = [
  { name: 'Noir', hex: '#26231F', members: ['Noir'] },
  { name: 'Blanc et écru', hex: '#F4F1EA', members: ['Blanc', 'Écru', 'Crème', 'Blanc et marine'] },
  { name: 'Beige et marron', hex: '#C49A6C', members: ['Sable', 'Camel', 'Beige', 'Nude', 'Camel et crème', 'Cognac', 'Chocolat'] },
  { name: 'Bleu', hex: '#2F3B52', members: ['Marine', 'Brut', 'Bleu clair', 'Ciel'] },
  { name: 'Vert', hex: '#7B7F4F', members: ['Sauge', 'Olive', 'Vert sapin', 'Kaki'] },
  { name: 'Rouge et rose', hex: '#8A3B3B', members: ['Bordeaux', 'Terracotta', 'Rose poudré'] },
  { name: 'Gris', hex: '#A7A29A', members: ['Gris'] },
  { name: 'Jaune', hex: '#C9A13B', members: ['Moutarde'] },
];

export const familyOf = (color: string) => COLOR_FAMILIES.find((f) => f.members.includes(color))?.name ?? 'Autres';

export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const DAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export const DAYS_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/** Date à `offset` jours d'aujourd'hui (heure locale de l'appareil). */
export function dayDate(offset: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

/** « samedi 26 septembre » */
export function longDate(offset: number): string {
  const d = dayDate(offset);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** « sam. 26 sept. » */
export function shortDate(offset: number): string {
  const d = dayDate(offset);
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** « Aujourd'hui », « Demain », puis le nom du jour. */
export function relativeDay(offset: number): string {
  if (offset === 0) return 'Aujourd’hui';
  if (offset === 1) return 'Demain';
  const d = dayDate(offset);
  const name = DAYS[d.getDay()];
  return offset < 7 ? name[0].toUpperCase() + name.slice(1) : `${name[0].toUpperCase() + name.slice(1)} ${d.getDate()}`;
}

/** Accord de « porté » : genre et nombre de la pièce (« baskets portées », « mocassins portés »). */
const FEMININE = new Set<GarmentKind>(['chemise', 'mariniere', 'jupe', 'robe', 'veste', 'ceinture', 'baskets', 'bottines']);
const PLURAL = new Set<GarmentKind>(['baskets', 'bottines', 'mocassins', 'escarpins']);

/**
 * Le genre se lit d'abord sur le nom de la pièce : Kode range un polo parmi
 * les chemises (illustration), mais on dit « un polo », pas « une ».
 * f : féminin, m : masculin ; s : pluriel.
 */
const NOUNS: Record<string, 'm' | 'f' | 'ms' | 'fs'> = {
  polo: 'm', short: 'm', bermuda: 'm', jean: 'm', jeans: 'm', pantalon: 'm', jogging: 'm', survêtement: 'm', legging: 'm', chino: 'm', cargo: 'm',
  pull: 'm', sweat: 'm', hoodie: 'm', 't-shirt': 'm', tshirt: 'm', 'tee-shirt': 'm', débardeur: 'm', top: 'm', body: 'm', crop: 'm', col: 'm',
  cardigan: 'm', gilet: 'm', blazer: 'm', blouson: 'm', manteau: 'm', trench: 'm', caban: 'm', perfecto: 'm', imperméable: 'm', kimono: 'm', poncho: 'm',
  sac: 'm', cabas: 'm', tote: 'm', 'sac-à-dos': 'm', foulard: 'm', bandana: 'm', bonnet: 'm', chapeau: 'm', bob: 'm', collier: 'm', bracelet: 'm', jonc: 'm', pendentif: 'm', bandeau: 'm', serre: 'm',
  mocassins: 'ms', escarpins: 'ms', sabots: 'ms', souliers: 'ms', derbies: 'ms', richelieus: 'ms', tennis: 'fs', sneakers: 'fs', boots: 'fs',
  chemise: 'f', chemisette: 'f', blouse: 'f', tunique: 'f', marinière: 'f', robe: 'f', jupe: 'f', salopette: 'f', combinaison: 'f', veste: 'f', doudoune: 'f', parka: 'f', polaire: 'f',
  ceinture: 'f', casquette: 'f', écharpe: 'f', étole: 'f', montre: 'f', bague: 'f', broche: 'f', pochette: 'f', besace: 'f', sacoche: 'f', banane: 'f', chaîne: 'f', pince: 'f', barrette: 'f',
  baskets: 'fs', bottines: 'fs', bottes: 'fs', sandales: 'fs', ballerines: 'fs', chaussures: 'fs', mules: 'fs', tongs: 'fs', claquettes: 'fs', espadrilles: 'fs', chaussettes: 'fs',
  lunettes: 'fs', créoles: 'fs', boucles: 'fs', puces: 'fs', manchettes: 'fs',
};

function gender(piece: { kind: GarmentKind; name?: string }): { fem: boolean; plural: boolean } {
  const first = piece.name?.trim().split(/\s+/)[0]?.toLowerCase();
  const g = first ? NOUNS[first] : undefined;
  if (g) return { fem: g[0] === 'f', plural: g.length === 2 };
  return { fem: FEMININE.has(piece.kind), plural: PLURAL.has(piece.kind) };
}

export function agree(piece: { kind: GarmentKind; name?: string }): string {
  const g = gender(piece);
  return (g.fem ? 'e' : '') + (g.plural ? 's' : '');
}

/** Pronoms et accords d'une pièce : « Elle dort », « Ils dorment », « la porter », « les porter ». */
export function forms(piece: { kind: GarmentKind; name?: string }) {
  const { fem, plural } = gender(piece);
  return {
    il: plural ? (fem ? 'Elles' : 'Ils') : fem ? 'Elle' : 'Il',
    le: plural ? 'les' : fem ? 'la' : 'le',
    e: agree(piece),
    /** dort / dorment, va / vont… : choisit la forme selon le nombre. */
    v: (singular: string, pluralForm: string) => (plural ? pluralForm : singular),
  };
}

/** Ajoutée il y a moins de deux semaines et pas encore portée : elle est nouvelle, pas oubliée. */
export const isNew = (piece: Piece) => piece.wears === 0 && piece.addedDaysAgo < 14;

export function newLabel(piece: { kind: GarmentKind; name?: string }): string {
  const { fem, plural } = gender(piece);
  return fem ? (plural ? 'nouvelles' : 'nouvelle') : plural ? 'nouveaux' : 'nouveau';
}

/** Depuis quand la pièce est dans le dressing : « depuis aujourd'hui », « depuis 3 semaines ». */
export function addedLabel(days: number): string {
  if (days <= 0) return 'depuis aujourd’hui';
  if (days === 1) return 'depuis hier';
  if (days < 14) return `depuis ${days} jours`;
  if (days < 60) return `depuis ${Math.round(days / 7)} semaines`;
  if (days < 365) return `depuis ${Math.round(days / 30)} mois`;
  const y = Math.floor(days / 365);
  return `depuis ${y} an${y > 1 ? 's' : ''}`;
}

export function wornLabel(piece: Piece): string {
  if (isNew(piece)) return `${newLabel(piece)} dans ton dressing`;
  if (piece.wears === 0) return `jamais porté${agree(piece)}`;
  return `porté${agree(piece)} ${piece.wears} fois`;
}

/** « il y a 3 jours », « hier », « jamais portée » */
export function sinceLabel(piece: Piece): string {
  const days = piece.lastWorn;
  if (days === null) return `jamais porté${agree(piece)}`;
  if (days === 0) return 'aujourd’hui';
  if (days === 1) return 'hier';
  if (days < 14) return `il y a ${days} jours`;
  if (days < 60) return `il y a ${Math.round(days / 7)} semaines`;
  return `il y a ${Math.round(days / 30)} mois`;
}

/** Coût par port, arrondi : « 12,86 € ». */
export function costPerWear(piece: Piece): string | null {
  if (!piece.price || piece.wears === 0) return null;
  return `${(piece.price / piece.wears).toFixed(2).replace('.', ',')} €`;
}

/** Minuscule en tête seulement : « Dîner chez Léa » → « dîner chez Léa » (les noms propres restent). */
export const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export const euros = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
