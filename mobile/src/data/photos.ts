/**
 * Les vraies pièces photographiées (07/10), détourées par
 * `tools/detour-photos.cjs` et rangées avec l'app. Elles remplacent les
 * dessins là où l'on montre des vêtements avant tout compte (accueil, styles)
 * et dans le dressing de démonstration. Une pièce y renvoie par
 * `image: 'photo:<clé>'` : une chaîne, qui survit à la sauvegarde sur le
 * téléphone, contrairement au numéro d'un `require`.
 */
import type { ImageSourcePropType } from 'react-native';

export const PHOTOS = {
  'tshirt-ecru': require('../../assets/pieces/tshirt-ecru.png'),
  'tshirt-ample': require('../../assets/pieces/tshirt-ample.png'),
  'blouson-noir': require('../../assets/pieces/blouson-noir.png'),
  'blouson-court': require('../../assets/pieces/blouson-court.png'),
  'cardigan-chocolat': require('../../assets/pieces/cardigan-chocolat.png'),
  'jean-large': require('../../assets/pieces/jean-large.png'),
  'pull-marine': require('../../assets/pieces/pull-marine.png'),
} satisfies Record<string, ImageSourcePropType>;

export type PhotoKey = keyof typeof PHOTOS;

/** La valeur à mettre dans `image` pour montrer une photo rangée avec l'app. */
export const photo = (k: PhotoKey) => `photo:${k}`;

/** La source d'une photo rangée avec l'app, ou `null` pour une adresse ordinaire. */
export function photoSource(image: string): ImageSourcePropType | null {
  if (!image.startsWith('photo:')) return null;
  return PHOTOS[image.slice(6) as PhotoKey] ?? null;
}
