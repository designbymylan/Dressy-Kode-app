/**
 * Le profil que l'onboarding construit, et tout ce que Kodi en tire.
 * Chaque champ a une raison d'être demandée (écrite à l'écran) ; presque
 * tous sont facultatifs, et la « précision de Kodi » montre ce que chaque
 * réponse apporte, sans jamais culpabiliser.
 */
import type { GarmentKind } from '../ui/Garment';
import { photo } from '../data/photos';

export type Silhouette = 'A' | 'V' | 'H' | 'X' | 'O' | 'inconnue';
export type Rayon = 'femme' | 'homme' | 'mixte';
export type MeasureId = 'poitrine' | 'taille' | 'hanches';

/** Ce qui s'affiche en haut de Moi et pour les amies (07/10). */
export type NameDisplay = 'prenom' | 'prenom_nom' | 'pseudo';

export type Profile = {
  /** Le prénom (display_name côté base, lu par Kodi). */
  name: string;
  lastName: string | null;
  /** Le pseudonyme, sans @ : lettres minuscules, chiffres, point et tiret bas. */
  username: string | null;
  nameDisplay: NameDisplay;
  /** La photo de profil à afficher (fichier du téléphone ou adresse signée). */
  avatar: string | null;
  /** Son chemin dans le stockage, pour un compte connecté. */
  avatarPath: string | null;
  rayon: Rayon | null;
  age: string | null;
  /**
   * L'accord explicite pour la taille, la silhouette et les mesures (09/10,
   * RGPD art. 9, par prudence) : sa date, ou null. Sans lui, rien de cela
   * n'est demandé ni enregistré.
   */
  bodyConsent: string | null;
  /** cm */
  height: number | null;
  /**
   * kg. Plus demandé depuis le 09/10 (minimisation : Kodi n'en a pas
   * besoin pour habiller) ; une valeur donnée avant peut être effacée.
   */
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
  lastName: null,
  username: null,
  nameDisplay: 'prenom',
  avatar: null,
  avatarPath: null,
  rayon: null,
  age: null,
  bodyConsent: null,
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
  lastName: 'Martin',
  username: 'alice.m',
  nameDisplay: 'prenom',
  avatar: null,
  avatarPath: null,
  rayon: 'femme',
  age: '25–34 ans',
  bodyConsent: '2026-09-15T09:00:00.000Z',
  height: 166,
  weight: null,
  silhouette: 'X',
  silhouetteSource: 'choix',
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
  { id: 'mixte', label: 'Un peu des deux', note: 'Kodi pioche dans les deux', kinds: [['tshirt'], ['jean'], ['baskets']] },
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
export const STYLE_CARDS: { name: string; note: string; kinds: [GarmentKind, string?, string?][] }[] = [
  { name: 'Minimal', note: 'Peu de pièces, des lignes nettes', kinds: [['tshirt'], ['pantalon'], ['baskets']] },
  { name: 'Classique', note: 'Ce qui ne se démode pas', kinds: [['blazer'], ['chemise', '#F4F1EA'], ['mocassins']] },
  { name: 'Chic parisien', note: 'Marinière, trench, sans effort', kinds: [['mariniere'], ['trench'], ['escarpins']] },
  { name: 'Bohème', note: 'Fluide, chaud, un peu libre', kinds: [['robe', '#B5603A'], ['foulard'], ['bottines', '#6E4A32']] },
  { name: 'Urbain', note: 'Pratique, pour la ville', kinds: [['veste', undefined, photo('blouson-court')], ['tshirt', undefined, photo('tshirt-ample')], ['jean', undefined, photo('jean-large')]] },
  { name: 'Romantique', note: 'Doux, poudré, délicat', kinds: [['chemise', '#E3BFB7'], ['jupe', '#D9B8A0'], ['escarpins', '#D9B8A0']] },
  { name: 'Sportswear chic', note: 'Le confort qui a de l’allure', kinds: [['debardeur'], ['pantalon', '#CDBB9C'], ['baskets']] },
  { name: 'Vintage', note: 'Des pièces qui ont une histoire', kinds: [['cardigan', '#C9A13B'], ['jupe'], ['mocassins']] },
  { name: 'Rock', note: 'Noir, net, un peu d’attitude', kinds: [['debardeur'], ['jean', '#26231F'], ['bottines']] },
  { name: 'Preppy', note: 'Col, pull, jupe plissée', kinds: [['pull', '#8A3B3B'], ['jupe', '#2F3B52'], ['mocassins']] },
  { name: 'Élégant', note: 'Pour les soirs qui comptent', kinds: [['robe', '#2F4A3C'], ['blazer'], ['escarpins']] },
  { name: 'Audacieux', note: 'La couleur d’abord', kinds: [['robe', '#C9A13B'], ['foulard', '#8A3B3B'], ['escarpins', '#B5603A']] },
];

/**
 * Précision de Kodi (0 à 100) : ce que chaque réponse lui apprend.
 * Barème (09/10, sans le poids ni l'analyse par photos) : silhouette 25,
 * taille 10, 3 mesures × 8, 3 tailles × 4, styles 7, couleurs 5,
 * quotidien 4, ville 3, base 10.
 */
export function precision(p: Profile) {
  let s = 10;
  if (p.silhouette && p.silhouette !== 'inconnue') s += 25;
  if (p.height) s += 10;
  s += Object.values(p.measures).filter(Boolean).length * 8;
  s += [p.sizes.haut, p.sizes.bas, p.sizes.pointure].filter(Boolean).length * 4;
  if (p.styles.length) s += 7;
  if (p.love.length || p.avoid.length) s += 5;
  if (p.occasions.length) s += 4;
  if (p.city) s += 3;
  return Math.min(100, s);
}

/** La prochaine réponse qui ferait le plus progresser Kodi. */
export function nextBestAnswer(p: Profile): { label: string; gain: number } | null {
  const list: { ok: boolean; label: string; gain: number }[] = [
    { ok: !!p.silhouette && p.silhouette !== 'inconnue', label: 'ta silhouette', gain: 25 },
    { ok: !!p.height, label: 'ta taille', gain: 10 },
    { ok: !!p.measures.hanches, label: 'ton tour de hanches', gain: 8 },
    { ok: !!p.measures.taille, label: 'ton tour de taille', gain: 8 },
    { ok: !!p.measures.poitrine, label: 'ton tour de poitrine', gain: 8 },
    { ok: !!p.styles.length, label: 'ton style', gain: 7 },
    { ok: !!p.sizes.haut, label: 'ta taille de haut', gain: 4 },
  ];
  const n = list.find((x) => !x.ok);
  return n ? { label: n.label, gain: n.gain } : null;
}

/** Le nom tel que la personne veut le voir : prénom, prénom et nom, ou pseudonyme. */
export function displayName(p: Pick<Profile, 'name' | 'lastName' | 'username' | 'nameDisplay'>): string {
  if (p.nameDisplay === 'pseudo' && p.username) return `@${p.username}`;
  if (p.nameDisplay === 'prenom_nom' && p.lastName) return `${p.name} ${p.lastName}`.trim();
  return p.name;
}

/** Un pseudonyme valable : minuscules sans accent, chiffres, point et tiret bas, 24 signes au plus. */
export const cleanUsername = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9._]/g, '').slice(0, 24);

export const usernameOk = (s: string) => /^[a-z0-9._]{3,24}$/.test(s);
