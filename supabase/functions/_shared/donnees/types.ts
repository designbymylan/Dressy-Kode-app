/**
 * Les données du monde réel (météo, jours fériés, vacances, tendances…)
 * arrivent toutes dans le même emballage, quelle que soit la source qui a
 * répondu : l'app et Kode n'ont jamais à savoir d'où elles viennent pour
 * les lire, seulement pour les créditer.
 */

/** frais : à jour ; ancien : la dernière valeur connue, les sources ne répondent pas ; indisponible : rien à montrer. */
export type Etat = 'frais' | 'ancien' | 'indisponible';

export type Bloc<T> = {
  valeur: T | null;
  /** Le nom de la source qui a fourni la valeur. */
  source: string | null;
  /** Le crédit à afficher en petit à côté de la donnée. */
  mention: string | null;
  /** Quand la valeur a été récupérée (ISO 8601). */
  maj: string | null;
  etat: Etat;
  /** Une phrase à montrer telle quelle quand la valeur est ancienne ou absente. */
  message: string | null;
};

/** Une source : une API appelée par un module serveur, jamais par l'app. */
export type Source<P, T> = {
  id: string;
  nom: string;
  mention: string;
  lire: (p: P) => Promise<T>;
};

// ---------------------------------------------------------------- formats

export type Ville = {
  nom: string;
  lat: number;
  lon: number;
  /** Numéro de département : « 69 », « 2A », « 974 ». */
  departement: string;
  /** Nom du département quand la source le donne (« Rhône »). */
  nomDepartement: string | null;
};

/** Le ciel en sept mots, les mêmes pour toutes les sources météo. */
export type Ciel = 'soleil' | 'nuages' | 'pluie' | 'averses' | 'neige' | 'orage' | 'brouillard';

export type JourMeteo = {
  /** AAAA-MM-JJ, heure de Paris. */
  date: string;
  max: number;
  min: number;
  ciel: Ciel;
  /** « averses l'après-midi », « ensoleillé »… */
  libelle: string;
  /** Pluie attendue sur la journée, en mm. */
  pluie: number | null;
  /** Indice UV maximal de la journée. */
  uv: number | null;
};

export type Meteo = {
  maintenant: { t: number; ressenti: number | null; ciel: Ciel; vent: number | null };
  jours: JourMeteo[];
};

/** Heures de Paris, « 07:49 ». */
export type Soleil = { lever: string; coucher: string };

export type Air = {
  /** Indice européen de qualité de l'air (0 à 100 et plus). */
  indice: number | null;
  qualite: 'bonne' | 'correcte' | 'moyenne' | 'mauvaise' | 'très mauvaise' | null;
  uv: number | null;
  /** Pollens présents, du plus au moins abondant (grains/m³). */
  pollens: { nom: string; grains: number }[];
};

export type Ferie = { date: string; nom: string };

/** Un week-end prolongé par un jour férié (et parfois un pont). */
export type Pont = { debut: string; fin: string; jours: number; aPoser: number; feries: string[] };

export type Vacances = { nom: string; debut: string; fin: string };

/** Une pièce dont l'intérêt monte (ou baisse) en ce moment. */
export type Tendance = {
  /** Le type de pièce de l'app (`GarmentKind` côté mobile). */
  kind: string;
  libelle: string;
  /** Variation de la dernière semaine par rapport aux quatre précédentes, en % (null pour la sélection de saison). */
  variation: number | null;
};

export type Fete = { prenoms: string };
