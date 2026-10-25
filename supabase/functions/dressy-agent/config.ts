/**
 * Les réglages du détourage, au même endroit pour pouvoir les retoucher sans
 * toucher à la mécanique. Un changement de gabarit (canevas, marge) change
 * `version` : elle est journalisée avec chaque pièce.
 */
export const CUTOUT = {
  version: 'decoupe-1',
  /** Côté du canevas carré, en pixels, et de la vignette. */
  canvas: 1024,
  thumb: 320,
  /** Part du canevas laissée libre de chaque côté de la pièce. */
  margin: 0.07,
  /** Une petite photo n'est agrandie que jusque-là : au-delà, la pièce reste plus petite que le cadre. */
  maxUpscale: 3,
  /** Carte de probabilité de Gemini (0 à 255) → opacité : sous `low` transparent, au-dessus de `high` opaque. */
  mask: { low: 110, high: 150 },
  /** Un morceau détaché plus petit que cette part du plus grand est de la poussière (une paire garde ses deux pièces). */
  speck: 0.05,
  /** Un trou enfermé plus petit que cette part de la pièce est rebouché (reflet, pli), pas une anse. */
  hole: 0.01,
  /** Autour du cadre rendu par Gemini, pour ne pas couper un bord. */
  boxPad: 0.04,
};

/** Contrôles automatiques de l'image détourée. */
export const CHECKS = {
  /** ΔE2000 maximal entre la couleur dominante mesurée et la teinte attendue. */
  deltaEMax: 30,
  /** Part de la pièce dans son cadre : ni vide, ni plein comme un fond resté collé. */
  coverage: [0.06, 0.995] as const,
  /** Part de la surface tenue par les morceaux principaux : le reste est du parasite. */
  oneShare: 0.9,
  /** Part de pixels à demi transparents : un contour flou est un masque approximatif. */
  softEdgeMax: 0.12,
  /** Plus petit côté de la pièce, en pixels de la photo. */
  minSide: 80,
};

/** Nombre de fois où une pièce peut être signalée « rendu incorrect » (la base le refait). */
export const REPORTS_MAX = 2;
