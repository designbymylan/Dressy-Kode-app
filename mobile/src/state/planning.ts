/**
 * La planification (07/10) : des dates réelles (AAAA-MM-JJ) plutôt que des
 * écarts depuis aujourd'hui, pour que le calendrier couvre les mois à venir ;
 * des rendez-vous décrits finement (heure, type, importance, tenue voulue,
 * impression, contraintes) pour que Kodi ait tout en main ; et les voyages,
 * avec une tenue par jour sur place.
 */

import { DAYS, DAYS_SHORT, MONTHS, MONTHS_SHORT } from '../data/wardrobe';

/** Une date locale, AAAA-MM-JJ. */
export type Iso = string;

const pad = (n: number) => String(n).padStart(2, '0');

export const isoFromDate = (d: Date): Iso => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** La date à `offset` jours d'aujourd'hui. */
export function isoOf(offset = 0): Iso {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return isoFromDate(d);
}

export function dateOf(iso: Iso): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Écart en jours entre aujourd'hui et une date : positif dans le futur. */
export function offsetOf(iso: Iso): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((dateOf(iso).getTime() - today) / 86_400_000);
}

export function addDays(iso: Iso, n: number): Iso {
  const d = dateOf(iso);
  d.setDate(d.getDate() + n);
  return isoFromDate(d);
}

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

/** « Aujourd'hui », « Demain », « Jeudi », puis « Jeu. 22 oct. ». */
export function dayName(iso: Iso): string {
  const o = offsetOf(iso);
  const d = dateOf(iso);
  if (o === 0) return 'Aujourd’hui';
  if (o === 1) return 'Demain';
  if (o === -1) return 'Hier';
  if (o > 1 && o < 7) return cap(DAYS[d.getDay()]);
  return `${cap(DAYS_SHORT[d.getDay()])} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** « mercredi 14 octobre ». */
export function longLabel(iso: Iso): string {
  const d = dateOf(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()}${d.getDate() === 1 ? 'er' : ''} ${MONTHS[d.getMonth()]}`;
}

/** « 12 → 18 oct. », « 28 oct. → 3 nov. ». */
export function spanLabel(start: Iso, end: Iso): string {
  const a = dateOf(start);
  const b = dateOf(end);
  return a.getMonth() === b.getMonth() ? `${a.getDate()} → ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}` : `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} → ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
}

/** Les jours de `start` à `end` compris. */
export function daysFrom(start: Iso, end: Iso): Iso[] {
  const out: Iso[] = [];
  for (let d = start; d <= end && out.length < 120; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Les semaines d'un mois, lundi en premier ; null pour les cases hors du mois. */
export function monthGrid(year: number, month: number): (Iso | null)[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (Iso | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => isoFromDate(new Date(year, month, i + 1)))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/* ---- Les rendez-vous ---- */

export type Stake = 'Tranquille' | 'Important' | 'Décisif';
export type Setting = 'Intérieur' | 'Extérieur' | 'Les deux';

export type RdvEvent = {
  id: string;
  date: Iso;
  /** « 19:30 », ou null pour « dans la journée ». */
  time: string | null;
  title: string;
  /** Le type de rendez-vous, parmi RDV_KINDS (ou un mot libre). */
  kind: string | null;
  /** La tenue voulue, parmi DRESS_CODES ; null : Kodi choisit. */
  dressCode: string | null;
  stake: Stake | null;
  /** Ce que la personne veut dégager. */
  impressions: string[];
  place: string | null;
  setting: Setting | null;
  /** Les contraintes du moment (marcher, danser, pas de talons…). */
  constraints: string[];
  note: string | null;
};

/**
 * Les types de rendez-vous, par famille. Chacun porte une indication pour
 * Kodi : ce que l'occasion demande d'habitude (codes, pièges à éviter).
 */
export const RDV_KINDS: { group: string; kinds: { id: string; hint: string }[] }[] = [
  {
    group: 'Travail',
    kinds: [
      { id: 'Entretien d’embauche', hint: 'un cran au-dessus de la tenue habituelle de l’entreprise, net, rien qui distrait' },
      { id: 'Réunion importante', hint: 'structuré, crédible, une pièce de caractère au plus' },
      { id: 'Présentation', hint: 'une silhouette nette qui se voit de loin, rien qui gratte ni qui se froisse' },
      { id: 'Rendez-vous client', hint: 'soigné, rassurant, adapté au secteur du client' },
      { id: 'Journée au bureau', hint: 'confortable et propre, des pièces qui tiennent la journée' },
      { id: 'Afterwork', hint: 'la tenue du bureau qu’un détail fait passer au soir' },
      { id: 'Séminaire ou conférence', hint: 'confortable pour rester assis, des couches pour la clim' },
      { id: 'Salon professionnel', hint: 'chaussures pour marcher et rester debout, tenue qui représente' },
      { id: 'Tournage ou photo', hint: 'couleurs unies, pas de petits motifs ni de logos, matières mates' },
    ],
  },
  {
    group: 'Cœur',
    kinds: [
      { id: 'Premier rendez-vous', hint: 'soi-même en mieux, à l’aise, une pièce qui fait parler sans en faire trop' },
      { id: 'Rendez-vous amoureux', hint: 'une matière douce, une couleur qui flatte le teint, rien de raide' },
      { id: 'Dîner en tête-à-tête', hint: 'élégant assis : le haut compte plus que le bas' },
      { id: 'Rencontrer sa belle-famille', hint: 'soigné, classique, rassurant, sans provocation' },
      { id: 'Anniversaire de couple', hint: 'un peu plus habillé que d’habitude, une pièce qu’on aime porter' },
    ],
  },
  {
    group: 'Amis et famille',
    kinds: [
      { id: 'Rendez-vous entre amis', hint: 'décontracté, ce qui ressemble le plus à la personne' },
      { id: 'Retrouvailles', hint: 'reconnaissable et soigné : on veut se sentir bien dans le regard des autres' },
      { id: 'Repas de famille', hint: 'confortable pour un long repas, propre sans être guindé' },
      { id: 'Brunch', hint: 'décontracté et lumineux, à l’aise assis longtemps' },
      { id: 'Anniversaire', hint: 'festif sans voler la vedette' },
      { id: 'Pendaison de crémaillère', hint: 'décontracté chic, chaussures faciles à garder longtemps' },
      { id: 'Baby shower', hint: 'doux, clair, confortable' },
    ],
  },
  {
    group: 'Cérémonies',
    kinds: [
      { id: 'Mariage (invité)', hint: 'jamais de blanc ni d’écru, rien de plus habillé que les mariés, prévoir la soirée' },
      { id: 'Baptême ou communion', hint: 'clair, couvrant, élégant de jour' },
      { id: 'Remise de diplôme', hint: 'habillé de jour, des chaussures pour monter sur scène' },
      { id: 'Obsèques', hint: 'sombre et sobre (noir, marine, gris), rien de voyant' },
      { id: 'Cérémonie religieuse', hint: 'épaules et genoux couverts, sobre' },
    ],
  },
  {
    group: 'Sorties',
    kinds: [
      { id: 'Soirée', hint: 'une pièce qui accroche la lumière, des chaussures pour danser' },
      { id: 'Gala ou cocktail', hint: 'le plus habillé du dressing, matières nobles, accessoires soignés' },
      { id: 'Restaurant chic', hint: 'élégant et net, le haut compte le plus' },
      { id: 'Concert ou festival', hint: 'pratique, couches, chaussures fermées qui supportent la foule' },
      { id: 'Théâtre ou opéra', hint: 'habillé, confortable assis, une couche pour les salles fraîches' },
      { id: 'Vernissage ou expo', hint: 'une pièce créative, une couleur ou une forme qui a du caractère' },
      { id: 'Cinéma', hint: 'décontracté, une couche chaude pour la salle' },
      { id: 'Match ou stade', hint: 'pratique, chaud, chaussures plates' },
    ],
  },
  {
    group: 'Activités',
    kinds: [
      { id: 'Sport', hint: 'tenue de sport et ce qu’on porte pour y aller et en revenir' },
      { id: 'Randonnée', hint: 'couches techniques, chaussures de marche, rien de fragile' },
      { id: 'Plage', hint: 'léger, couvrant au soleil, sandales' },
      { id: 'Shopping', hint: 'facile à enlever et à remettre, chaussures confortables' },
      { id: 'Jour de voyage', hint: 'confortable assis longtemps, des couches, peu de métal' },
      { id: 'Rendez-vous administratif', hint: 'propre et neutre' },
    ],
  },
];

export const kindHint = (id: string | null) => RDV_KINDS.flatMap((g) => g.kinds).find((k) => k.id === id)?.hint ?? null;

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

export const CONSTRAINTS = ['Beaucoup marcher', 'Debout longtemps', 'Assis longtemps', 'Danser', 'À vélo', 'Pas de talons', 'Chaud à l’intérieur', 'Clim ou froid', 'Repas au restaurant', 'Avec des enfants', 'Se changer après'];

/** « 19:30 » → « 19 h 30 » ; « 09:00 » → « 9 h ». */
export function timeLabel(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return m ? `${h} h ${pad(m)}` : `${h} h`;
}

/** Le moment de la journée, pour la base (colonne slot) et les phrases. */
export function slotOf(time: string | null): 'Matin' | 'Après-midi' | 'Soir' | null {
  if (!time) return null;
  const h = Number(time.split(':')[0]);
  return h < 12 ? 'Matin' : h < 18 ? 'Après-midi' : 'Soir';
}

/* ---- Les voyages ---- */

export type TripPurpose = 'Plaisir' | 'Travail' | 'Les deux';

export type Trip = {
  id: string;
  destination: string;
  country: string | null;
  lat: number | null;
  lon: number | null;
  start: Iso;
  end: Iso;
  purpose: TripPurpose;
  activities: string[];
  /** La photo du lieu, avec son crédit (servie par la fonction donnees). */
  image: { url: string; credit: string; page?: string } | null;
};

export const TRIP_PURPOSES: TripPurpose[] = ['Plaisir', 'Travail', 'Les deux'];

export const TRIP_ACTIVITIES = ['Visites à pied', 'Musées', 'Restaurants', 'Soirées', 'Plage', 'Randonnée', 'Réunions', 'Dîners d’affaires', 'Shopping', 'Mariage ou fête'];

/** Un identifiant au format uuid, le même sur le téléphone et en base. */
export function newId(): string {
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
    else if (i === 14) s += '4';
    else if (i === 19) s += h[(Math.random() * 4) | 8];
    else s += h[(Math.random() * 16) | 0];
  }
  return s;
}
