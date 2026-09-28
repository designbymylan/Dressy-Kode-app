/**
 * Le profil que l'onboarding construit, et tout ce que Kode en tire.
 * Chaque champ a une raison d'être demandée (écrite à l'écran) ; presque
 * tous sont facultatifs, et la « précision de Kode » montre ce que chaque
 * réponse apporte, sans jamais culpabiliser.
 */
import type { GarmentKind } from '../ui/Garment';

export type Silhouette = 'A' | 'V' | 'H' | 'X' | 'O' | 'inconnue';
export type Rayon = 'femme' | 'homme' | 'mixte';
export type MeasureId = 'poitrine' | 'taille' | 'hanches';

export type Profile = {
  name: string;
  rayon: Rayon | null;
  age: string | null;
  /** cm */
  height: number | null;
  /** kg, facultatif, jamais affiché ailleurs que dans « Ma silhouette ». */
  weight: number | null;
  silhouette: Silhouette | null;
  silhouetteSource: 'photos' | 'choix' | null;
  measures: Partial<Record<MeasureId, number>>;
  sizes: { haut?: string; bas?: string; pointure?: string };
  styles: string[];
  love: string[];
  avoid: string[];
  occasions: string[];
  city: string | null;
  agenda: boolean;
  email: string | null;
  since: string;
};

export const EMPTY_PROFILE: Profile = {
  name: '',
  rayon: null,
  age: null,
  height: null,
  weight: null,
  silhouette: null,
  silhouetteSource: null,
  measures: {},
  sizes: {},
  styles: [],
  love: [],
  avoid: [],
  occasions: [],
  city: null,
  agenda: false,
  email: null,
  since: 'aujourd’hui',
};

/** Le compte de démonstration (« J'ai déjà un compte »). */
export const DEMO_PROFILE: Profile = {
  name: 'Alice',
  rayon: 'femme',
  age: '25–34 ans',
  height: 166,
  weight: null,
  silhouette: 'X',
  silhouetteSource: 'photos',
  measures: { taille: 70 },
  sizes: { haut: 'S', bas: '38', pointure: '38' },
  styles: ['Minimal', 'Chic parisien'],
  love: ['Camel', 'Marine', 'Blanc'],
  avoid: ['Moutarde'],
  occasions: ['Bureau', 'Sorties', 'Événements'],
  city: 'Paris',
  agenda: true,
  email: 'alice@exemple.fr',
  since: 'septembre',
};

export const RAYONS: { id: Rayon; label: string; note: string; kinds: [GarmentKind, string?][] }[] = [
  { id: 'femme', label: 'Au rayon femme', note: 'Coupes et tailles femme', kinds: [['robe', '#B5603A'], ['jupe'], ['escarpins', '#D9B8A0']] },
  { id: 'homme', label: 'Au rayon homme', note: 'Coupes et tailles homme', kinds: [['blazer'], ['pantalon', '#CDBB9C'], ['mocassins']] },
  { id: 'mixte', label: 'Un peu des deux', note: 'Kode pioche dans les deux', kinds: [['tshirt'], ['jean'], ['baskets']] },
];

export const AGES = ['15–17 ans', '18–24 ans', '25–34 ans', '35–44 ans', '45 ans et plus'];

export const OCCASIONS: { label: string; icon: 'bag' | 'home' | 'layers' | 'kode' | 'leaf' | 'gift' | 'plane' | 'heart' }[] = [
  { label: 'Bureau', icon: 'bag' },
  { label: 'Télétravail', icon: 'home' },
  { label: 'Études', icon: 'layers' },
  { label: 'Sorties', icon: 'kode' },
  { label: 'Sport', icon: 'leaf' },
  { label: 'Événements', icon: 'gift' },
  { label: 'Voyages', icon: 'plane' },
  { label: 'En famille', icon: 'heart' },
];

export const CITIES = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Toulouse', 'Nantes', 'Strasbourg', 'Nice', 'Rennes'];

/** Tailles proposées selon le rayon (tailles françaises). */
export function sizeOptions(rayon: Rayon | null) {
  const femme = { haut: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], bas: ['34', '36', '38', '40', '42', '44', '46', '48'], pointure: ['35', '36', '37', '38', '39', '40', '41', '42'] };
  const homme = { haut: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], bas: ['38', '40', '42', '44', '46', '48', '50', '52'], pointure: ['39', '40', '41', '42', '43', '44', '45', '46'] };
  if (rayon === 'homme') return homme;
  if (rayon === 'femme') return femme;
  return { haut: femme.haut, bas: ['34', '36', '38', '40', '42', '44', '46', '48', '50', '52'], pointure: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'] };
}

/** Les styles, chacun illustré par trois pièces originales. */
export const STYLE_CARDS: { name: string; note: string; kinds: [GarmentKind, string?][] }[] = [
  { name: 'Minimal', note: 'Peu de pièces, des lignes nettes', kinds: [['tshirt'], ['pantalon'], ['baskets']] },
  { name: 'Classique', note: 'Ce qui ne se démode pas', kinds: [['blazer'], ['chemise', '#F4F1EA'], ['mocassins']] },
  { name: 'Chic parisien', note: 'Marinière, trench, sans effort', kinds: [['mariniere'], ['trench'], ['escarpins']] },
  { name: 'Bohème', note: 'Fluide, chaud, un peu libre', kinds: [['robe', '#B5603A'], ['foulard'], ['bottines', '#6E4A32']] },
  { name: 'Urbain', note: 'Pratique, pour la ville', kinds: [['veste'], ['jean'], ['baskets']] },
  { name: 'Romantique', note: 'Doux, poudré, délicat', kinds: [['chemise', '#E3BFB7'], ['jupe', '#D9B8A0'], ['escarpins', '#D9B8A0']] },
  { name: 'Sportswear chic', note: 'Le confort qui a de l’allure', kinds: [['debardeur'], ['pantalon', '#CDBB9C'], ['baskets']] },
  { name: 'Vintage', note: 'Des pièces qui ont une histoire', kinds: [['cardigan', '#C9A13B'], ['jupe'], ['mocassins']] },
  { name: 'Rock', note: 'Noir, net, un peu d’attitude', kinds: [['debardeur'], ['jean', '#26231F'], ['bottines']] },
  { name: 'Preppy', note: 'Col, pull, jupe plissée', kinds: [['pull', '#8A3B3B'], ['jupe', '#2F3B52'], ['mocassins']] },
  { name: 'Élégant', note: 'Pour les soirs qui comptent', kinds: [['robe', '#2F4A3C'], ['blazer'], ['escarpins']] },
  { name: 'Audacieux', note: 'La couleur d’abord', kinds: [['robe', '#C9A13B'], ['foulard', '#8A3B3B'], ['escarpins', '#B5603A']] },
];

/**
 * Précision de Kode (0 à 100) : ce que chaque réponse lui apprend.
 * Barème : silhouette 20 (+5 par photos), taille 10, poids 5, 3 mesures × 8,
 * 3 tailles × 4, styles 7, couleurs 5, quotidien 4, ville 3, base 5.
 */
export function precision(p: Profile) {
  let s = 5;
  if (p.silhouette && p.silhouette !== 'inconnue') s += 20 + (p.silhouetteSource === 'photos' ? 5 : 0);
  if (p.height) s += 10;
  if (p.weight) s += 5;
  s += Object.values(p.measures).filter(Boolean).length * 8;
  s += [p.sizes.haut, p.sizes.bas, p.sizes.pointure].filter(Boolean).length * 4;
  if (p.styles.length) s += 7;
  if (p.love.length || p.avoid.length) s += 5;
  if (p.occasions.length) s += 4;
  if (p.city) s += 3;
  return Math.min(100, s);
}

/** La prochaine réponse qui ferait le plus progresser Kode. */
export function nextBestAnswer(p: Profile): { label: string; gain: number } | null {
  const list: { ok: boolean; label: string; gain: number }[] = [
    { ok: !!p.silhouette && p.silhouette !== 'inconnue', label: 'ta silhouette', gain: 20 },
    { ok: !!p.height, label: 'ta taille', gain: 10 },
    { ok: !!p.measures.hanches, label: 'ton tour de hanches', gain: 8 },
    { ok: !!p.measures.taille, label: 'ton tour de taille', gain: 8 },
    { ok: !!p.measures.poitrine, label: 'ton tour de poitrine', gain: 8 },
    { ok: !!p.styles.length, label: 'ton style', gain: 7 },
    { ok: !!p.weight, label: 'ton poids (facultatif)', gain: 5 },
    { ok: !!p.sizes.haut, label: 'ta taille de haut', gain: 4 },
  ];
  const n = list.find((x) => !x.ok);
  return n ? { label: n.label, gain: n.gain } : null;
}
