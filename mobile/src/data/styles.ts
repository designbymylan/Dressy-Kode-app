/**
 * Les tenues qui montrent chaque style du questionnaire (18/11). Ce sont de
 * vraies photos de tenues (dossier « Image Style », Style Femme et Style
 * Homme, envoyé par l'utilisateur), la personne détourée sans son décor par
 * `tools/detour-styles.py`, rangées dans `mobile/assets/styles/` et listées
 * dans `stylePhotos.ts` (écrit par l'outil, jamais à la main).
 *
 * À chaque passage sur l'écran des styles, une tenue est tirée au hasard dans
 * chaque style, parmi celles du rayon choisi : deux personnes ne voient pas
 * forcément la même tenue pour un même style. « Un peu des deux » pioche dans
 * les tenues femme et homme.
 */
import type { ImageSourcePropType } from 'react-native';
import { slug } from '../state/remote';
import type { Rayon } from '../state/profile';
import { STYLE_PHOTOS } from './stylePhotos';

/** Les tenues d'un style pour un rayon (les deux pour « Un peu des deux »). */
export function tenuesDuStyle(name: string, rayon: Rayon | null): ImageSourcePropType[] {
  const s = STYLE_PHOTOS[slug(name)];
  if (!s) return [];
  if (rayon === 'femme') return s.femme;
  if (rayon === 'homme') return s.homme;
  return [...s.femme, ...s.homme];
}

/** Une tenue au hasard par style, pour un passage sur l'écran. */
export function tirerTenues(names: string[], rayon: Rayon | null): Record<string, ImageSourcePropType | null> {
  return Object.fromEntries(
    names.map((n) => {
      const list = tenuesDuStyle(n, rayon);
      return [n, list.length ? list[Math.floor(Math.random() * list.length)] : null];
    }),
  );
}

/**
 * Les vraies tenues qui montrent chaque rayon à l'écran « Tu t'habilles
 * plutôt… » (18/11, à la place des dessins) : trois tenues femme, trois
 * tenues homme, une de chaque pour « Un peu des deux ». Choisies pour se lire
 * en petit (silhouettes nettes, couleurs variées).
 */
export const RAYON_TENUES: Record<Rayon, ImageSourcePropType[]> = {
  femme: [require('../../assets/styles/femme/workwear-1.webp'), require('../../assets/styles/femme/old_money-2.webp'), require('../../assets/styles/femme/preppy-1.webp')],
  homme: [require('../../assets/styles/homme/preppy-2.webp'), require('../../assets/styles/homme/old_money-2.webp'), require('../../assets/styles/homme/workwear-3.webp')],
  mixte: [require('../../assets/styles/femme/preppy-2.webp'), require('../../assets/styles/homme/workwear-1.webp')],
};
