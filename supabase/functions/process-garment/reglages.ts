/**
 * Les réglages du pipeline d'ajout (spec du 20/11). Les seuils sont des
 * valeurs de départ, à calibrer sur le banc de 20 photos : on les change ici,
 * et `PIPELINE_VERSION` monte quand le résultat d'une même photo change
 * (une pièce traitée avant peut alors être retraitée depuis son original).
 */

export const PIPELINE_VERSION = 1;

export const SEUILS = {
  /** La pièce occupe moins de cette part de l'image : « Rapproche-toi de la pièce ». */
  couvertureMin: 0.10,
  /** Plus que cette part : « Éloigne-toi, la pièce doit être entière ». */
  couvertureMax: 0.85,
  /** Le plus gros morceau du masque fait moins de cette part de sa surface : « Une seule pièce par photo ». */
  plusGrosMin: 0.90,
  /** Sous cette confiance, les champs de la fiche sont « À confirmer ». */
  confianceFaible: 0.6,
  /** Côté le plus court minimal, vérifié sur l'appareil avant l'envoi. */
  coteMin: 600,
  /** Opacité (0 à 255) à partir de laquelle un pixel compte dans le masque. */
  opaque: 128,
  /** Un morceau plus petit que cette part de l'image est une poussière du détourage : effacé, pas compté. */
  poussiere: 0.002,
} as const;

export const SORTIE = {
  /** Grand côté maximal de l'original et du détourage. */
  cote: 1024,
  /** Marge autour de la pièce, en part de son grand côté. */
  marge: 0.04,
  qualite: 90,
  vignette: 256,
  qualiteVignette: 85,
} as const;

export const FOURNISSEUR = {
  /** Délai maximal d'un appel de détourage. */
  delaiMs: 15_000,
  /** Attentes avant les deux nouvelles tentatives (spec : 2 s puis 5 s). */
  attentes: [2_000, 5_000],
} as const;

export const ETIQUETAGE = {
  /** Délai d'un appel au modèle d'étiquetage. */
  delaiMs: 8_000,
  /** Sans réponse après ce délai, le modèle suivant de la chaîne part en parallèle. */
  relaisMs: 4_000,
  /** Au-delà, on range la pièce avec une fiche vide plutôt que d'attendre. */
  plafondMs: 12_000,
} as const;

/**
 * Une pièce restée « processing » plus longtemps que ça a perdu son passage
 * (fonction coupée) : un nouvel appel peut la reprendre, et l'app propose
 * « Réessayer ».
 */
export const PERIME_MS = 45_000;

/** Au-delà de ce nombre de traitements, une pièce n'est plus retraitée (garde-fou de coût). */
export const TENTATIVES_MAX = 8;
