/**
 * La planification : les jours (AAAA-MM-JJ, ceux de Paris), les rendez-vous
 * décrits finement (heure, type, importance, tenue voulue, impression,
 * contraintes) pour que Kodi ait tout en main, et la grille d'un mois.
 * Mêmes mots et mêmes réglages que l'app mobile (mobile/src/state/planning.ts).
 *
 * Sans importation serveur : ce fichier sert aussi aux composants du navigateur.
 */

/** Un jour au format AAAA-MM-JJ. */
export type Iso = string;

export const ISO = /^\d{4}-\d{2}-\d{2}$/;

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export const LETTRES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const pad = (n: number) => String(n).padStart(2, '0');
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Midi UTC du jour : à l'abri des changements d'heure, quel que soit le fuseau de la machine. */
const at = (iso: Iso) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);

/** Le jour de la semaine (0 : dimanche). */
export const weekday = (iso: Iso) => at(iso).getUTCDay();

export function addDays(iso: Iso, n: number): Iso {
  const d = at(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Écart en jours entre `today` et une date : positif dans le futur. */
export const offsetOf = (iso: Iso, today: Iso) => Math.round((at(iso).getTime() - at(today).getTime()) / 86_400_000);

/** « mercredi 14 octobre », « dimanche 1er novembre ». */
export function longLabel(iso: Iso): string {
  const d = at(iso);
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()}${d.getUTCDate() === 1 ? 'er' : ''} ${MOIS[d.getUTCMonth()]}`;
}

/** « Aujourd'hui », « Demain », « Hier », le jour de la semaine, puis « Jeu. 22 oct. ». */
export function dayName(iso: Iso, today: Iso): string {
  const o = offsetOf(iso, today);
  const d = at(iso);
  if (o === 0) return 'Aujourd’hui';
  if (o === 1) return 'Demain';
  if (o === -1) return 'Hier';
  if (o > 1 && o < 7) return cap(JOURS[d.getUTCDay()]);
  return `${cap(JOURS_COURTS[d.getUTCDay()])} ${d.getUTCDate()} ${MOIS_COURTS[d.getUTCMonth()]}`;
}

/** « Aujourd'hui », « Demain », puis le jour en toutes lettres : pour une étiquette de carte. */
export function relativeDay(iso: Iso, today: Iso): string {
  const o = offsetOf(iso, today);
  return o === 0 ? 'aujourd’hui' : o === 1 ? 'demain' : o === -1 ? 'hier' : longLabel(iso);
}

/** « 12 → 18 oct. », « 28 oct. → 3 nov. ». */
export function spanLabel(start: Iso, end: Iso): string {
  const a = at(start);
  const b = at(end);
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()} → ${b.getUTCDate()} ${MOIS_COURTS[b.getUTCMonth()]}`
    : `${a.getUTCDate()} ${MOIS_COURTS[a.getUTCMonth()]} → ${b.getUTCDate()} ${MOIS_COURTS[b.getUTCMonth()]}`;
}

/** « 19:30 » → « 19 h 30 » ; « 09:00 » → « 9 h » (espaces insécables). */
export function timeLabel(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return m ? `${h} h ${pad(m)}` : `${h} h`;
}

/** Le mois d'une date : « 2026-11 ». */
export const monthKey = (iso: Iso) => iso.slice(0, 7);

/** Le mois décalé de `n` : « 2026-11 » + 1 = « 2026-12 ». */
export function shiftMonth(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** « novembre 2026 ». */
export function monthLabel(key: string): { name: string; year: number } {
  const [y, m] = key.split('-').map(Number);
  return { name: MOIS[m - 1], year: y };
}

/** Les semaines d'un mois, lundi en premier ; null pour les cases hors du mois. */
export function monthGrid(key: string): (Iso | null)[][] {
  const [y, m] = key.split('-').map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (Iso | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/* ---- Les rendez-vous ---- */

export type Stake = 'Tranquille' | 'Important' | 'Décisif';
export type Setting = 'Intérieur' | 'Extérieur' | 'Les deux';

/** Un rendez-vous, tel que la base le garde. */
export type RdvEvent = {
  id: string;
  date: Iso;
  /** « 19:30 », ou null pour « dans la journée ». */
  time: string | null;
  title: string;
  kind: string | null;
  dressCode: string | null;
  stake: Stake | null;
  impressions: string[];
  place: string | null;
  setting: Setting | null;
  constraints: string[];
  note: string | null;
};

/** Les types de rendez-vous, par famille. Kodi sait ce que chacun demande d'habitude. */
export const RDV_KINDS: { group: string; kinds: string[] }[] = [
  { group: 'Travail', kinds: ['Entretien d’embauche', 'Réunion importante', 'Présentation', 'Rendez-vous client', 'Journée au bureau', 'Afterwork', 'Séminaire ou conférence', 'Salon professionnel', 'Tournage ou photo'] },
  { group: 'Cœur', kinds: ['Premier rendez-vous', 'Rendez-vous amoureux', 'Dîner en tête-à-tête', 'Rencontrer sa belle-famille', 'Anniversaire de couple'] },
  { group: 'Amis et famille', kinds: ['Rendez-vous entre amis', 'Retrouvailles', 'Repas de famille', 'Brunch', 'Anniversaire', 'Pendaison de crémaillère', 'Baby shower'] },
  { group: 'Cérémonies', kinds: ['Mariage (invité)', 'Baptême ou communion', 'Remise de diplôme', 'Obsèques', 'Cérémonie religieuse'] },
  { group: 'Sorties', kinds: ['Soirée', 'Gala ou cocktail', 'Restaurant chic', 'Concert ou festival', 'Théâtre ou opéra', 'Vernissage ou expo', 'Cinéma', 'Match ou stade'] },
  { group: 'Activités', kinds: ['Sport', 'Randonnée', 'Plage', 'Shopping', 'Jour de voyage', 'Rendez-vous administratif'] },
];
export const KINDS = RDV_KINDS.flatMap((g) => g.kinds);

/** La tenue voulue, du plus libre au plus habillé. */
export const DRESS_CODES = ['Décontracté', 'Casual chic', 'Confort', 'Smart', 'Business', 'Chic', 'Habillé', 'Tenue de soirée', 'Sportswear', 'À thème'];

export const STAKES: { id: Stake; note: string }[] = [
  { id: 'Tranquille', note: 'Sans enjeu' },
  { id: 'Important', note: 'Ça compte' },
  { id: 'Décisif', note: 'Rien ne doit clocher' },
];

/** Ce qu'on veut dégager. */
export const IMPRESSIONS = ['Confiance', 'Sérieux', 'Élégance', 'Séduction', 'Douceur', 'Créativité', 'Décontraction', 'Discrétion', 'Audace', 'Autorité'];

export const SETTINGS: Setting[] = ['Intérieur', 'Extérieur', 'Les deux'];

/** Les contraintes du moment (colonne `flags`). */
export const CONSTRAINTS = ['Beaucoup marcher', 'Debout longtemps', 'Assis longtemps', 'Danser', 'À vélo', 'Pas de talons', 'Chaud à l’intérieur', 'Clim ou froid', 'Repas au restaurant', 'Avec des enfants', 'Se changer après'];
