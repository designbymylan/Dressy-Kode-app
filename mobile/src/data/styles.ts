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
