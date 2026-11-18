/**
 * Le profil que l'onboarding construit, et tout ce que Kodi en tire.
 * Chaque champ a une raison d'être demandée (écrite à l'écran) ; presque
 * tous sont facultatifs, et la « précision de Kodi » montre ce que chaque
 * réponse apporte, sans jamais culpabiliser.
 */

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
  styles: ['Old money', 'Workwear'],
  love: ['Camel', 'Marine', 'Blanc'],
  avoid: ['Moutarde'],
  occasions: ['Bureau', 'Sorties', 'Événements'],
  city: 'Paris',
  agenda: true,
  email: 'alice@exemple.fr',
  since: 'septembre',
};

/** Les rayons ; chacun est montré par de vraies tenues (`RAYON_TENUES`, `data/styles.ts`). */
export const RAYONS: { id: Rayon; label: string; note: string }[] = [
  { id: 'femme', label: 'Au rayon femme', note: 'Coupes et tailles femme' },
  { id: 'homme', label: 'Au rayon homme', note: 'Coupes et tailles homme' },
  { id: 'mixte', label: 'Un peu des deux', note: 'Kodi pioche dans les deux' },
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

/**
 * Les neuf styles du questionnaire (18/11, demandés par l'utilisateur, à la
 * place des douze d'avant). Chacun est montré par une vraie tenue, tirée au
 * hasard parmi celles du rayon choisi (`tirerTenues`, `data/styles.ts`).
 * L'identifiant gardé en base est `slug(name)` : `y2k`, `old_money`…
 */
export const STYLE_CARDS: { name: string; note: string }[] = [
  { name: 'Y2K', note: 'Années 2000 : baggy, logos, motifs' },
  { name: 'Workwear', note: 'Chemise, pantalon droit, sobre et net' },
  { name: 'Gothique', note: 'Noir, cuir, chaînes, argent' },
  { name: 'Grunge', note: 'Noir délavé, cuir, coupes amples' },
  { name: 'Old money', note: 'Laine, tons sourds, coupes nettes' },
  { name: 'Techwear', note: 'Noir, coupe-vent, cargo' },
  { name: 'Preppy', note: 'Pull sur chemise, mocassins' },
  { name: 'Gorpcore', note: 'Coupe-vent, cargo, baskets de trail' },
  { name: 'Streetwear', note: 'Oversize, jean large, baskets' },
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
