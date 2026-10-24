/**
 * Les photos de l'écran d'accueil (24/10), verticales, tirées du dossier
 * « Image fashion ref » et réduites à 1000 px de large. L'écran en tire une
 * au hasard à chaque arrivée, jamais la même deux fois de suite.
 */
import type { ImageSourcePropType } from 'react-native';

export const WELCOME_PHOTOS: ImageSourcePropType[] = [
  require('../../assets/welcome/rooftop.jpg'),
  require('../../assets/welcome/denim.jpg'),
  require('../../assets/welcome/studio.jpg'),
  require('../../assets/welcome/alley.jpg'),
  require('../../assets/welcome/camera.jpg'),
  require('../../assets/welcome/river.jpg'),
  require('../../assets/welcome/bridge.jpg'),
];

let last = -1;

/** Un numéro de photo au hasard, différent du dernier montré. */
export function nextWelcomePhoto(): number {
  let n = Math.floor(Math.random() * WELCOME_PHOTOS.length);
  if (n === last) n = (n + 1) % WELCOME_PHOTOS.length;
  last = n;
  return n;
}
