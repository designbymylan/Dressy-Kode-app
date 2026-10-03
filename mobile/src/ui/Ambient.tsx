import type { Weather } from '../data/wardrobe';

/**
 * Le fond des écrans. La galerie n'a ni halo ni dégradé : le blanc (le noir en
 * sombre) suffit, et c'est l'écran qui le pose (`bg-paper`). Le composant reste
 * pour que les écrans n'aient pas à changer de structure.
 */
export function Ambient(_: { weather?: Weather['kind'] }) {
  return null;
}
