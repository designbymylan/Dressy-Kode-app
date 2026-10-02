/**
 * Les types de pièces de l'app (les `GarmentKind` du mobile), leur nom,
 * et l'article Wikipédia qui sert de thermomètre pour les tendances.
 * Chaque titre a été appelé le 2 octobre 2026 (réponse 200) ; le test des
 * sources vérifie qu'ils répondent toujours.
 */
export const PIECES: { kind: string; libelle: string; wiki: string }[] = [
  { kind: 'trench', libelle: 'Trench', wiki: 'Trench-coat' },
  { kind: 'blazer', libelle: 'Blazer', wiki: 'Blazer' },
  { kind: 'veste', libelle: 'Veste matelassée', wiki: 'Doudoune' },
  { kind: 'pull', libelle: 'Pull', wiki: 'Pull-over' },
  { kind: 'cardigan', libelle: 'Cardigan', wiki: 'Cardigan' },
  { kind: 'chemise', libelle: 'Chemise', wiki: 'Chemise' },
  { kind: 'mariniere', libelle: 'Marinière', wiki: 'Marinière' },
  { kind: 'tshirt', libelle: 'T-shirt', wiki: 'T-shirt' },
  { kind: 'debardeur', libelle: 'Débardeur', wiki: 'Débardeur' },
  { kind: 'jean', libelle: 'Jean', wiki: 'Jean_(tissu)' },
  { kind: 'pantalon', libelle: 'Pantalon', wiki: 'Pantalon' },
  { kind: 'short', libelle: 'Short', wiki: 'Short' },
  { kind: 'jupe', libelle: 'Jupe', wiki: 'Jupe' },
  { kind: 'robe', libelle: 'Robe', wiki: 'Robe' },
  { kind: 'baskets', libelle: 'Baskets', wiki: 'Basket_(chaussure)' },
  { kind: 'mocassins', libelle: 'Mocassins', wiki: 'Mocassin' },
  { kind: 'bottines', libelle: 'Bottines', wiki: 'Botte_(chaussure)' },
  { kind: 'escarpins', libelle: 'Escarpins', wiki: 'Escarpin' },
  { kind: 'sac', libelle: 'Sac', wiki: 'Sac_à_main' },
  { kind: 'foulard', libelle: 'Foulard', wiki: 'Foulard' },
  { kind: 'ceinture', libelle: 'Ceinture', wiki: 'Ceinture_(vêtement)' },
];

export const libelleDe = (kind: string) => PIECES.find((p) => p.kind === kind)?.libelle ?? kind;
