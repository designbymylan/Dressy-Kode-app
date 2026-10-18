/**
 * Département vers académie, pour trouver les vacances scolaires d'une
 * ville. Les noms sont ceux du jeu de données de l'Éducation nationale
 * (fr-en-calendrier-scolaire, champ « location ») ; le test vérifie que
 * chacun y existe encore.
 */
const PAR_ACADEMIE: Record<string, string[]> = {
  'Besançon': ['25', '39', '70', '90'],
  'Bordeaux': ['24', '33', '40', '47', '64'],
  'Clermont-Ferrand': ['03', '15', '43', '63'],
  'Dijon': ['21', '58', '71', '89'],
  'Grenoble': ['07', '26', '38', '73', '74'],
  'Limoges': ['19', '23', '87'],
  'Lyon': ['01', '42', '69'],
  'Poitiers': ['16', '17', '79', '86'],
  'Aix-Marseille': ['04', '05', '13', '84'],
  'Amiens': ['02', '60', '80'],
  'Lille': ['59', '62'],
  'Nancy-Metz': ['54', '55', '57', '88'],
  'Nantes': ['44', '49', '53', '72', '85'],
  'Nice': ['06', '83'],
  'Normandie': ['14', '27', '50', '61', '76'],
  'Orléans-Tours': ['18', '28', '36', '37', '41', '45'],
  'Reims': ['08', '10', '51', '52'],
  'Rennes': ['22', '29', '35', '56'],
  'Strasbourg': ['67', '68'],
  'Créteil': ['77', '93', '94'],
  'Montpellier': ['11', '30', '34', '48', '66'],
  'Paris': ['75'],
  'Toulouse': ['09', '12', '31', '32', '46', '65', '81', '82'],
  'Versailles': ['78', '91', '92', '95'],
  'Corse': ['2A', '2B'],
  'Guadeloupe': ['971'],
  'Martinique': ['972'],
  'Guyane': ['973'],
  'Réunion': ['974'],
  'Saint Pierre et Miquelon': ['975'],
  'Mayotte': ['976'],
  'Polynésie': ['987'],
};

const PAR_DEPARTEMENT = new Map(Object.entries(PAR_ACADEMIE).flatMap(([a, deps]) => deps.map((d) => [d, a] as const)));

export const ACADEMIES = Object.keys(PAR_ACADEMIE);

/** L'académie d'un département (« 69 » donne « Lyon »), ou null si on ne la connaît pas. */
export const academie = (dep: string): string | null => PAR_DEPARTEMENT.get(dep) ?? null;

/** Les départements couverts (le test vérifie qu'aucun numéro de 01 à 95 ne manque). */
export const DEPARTEMENTS = [...PAR_DEPARTEMENT.keys()];
