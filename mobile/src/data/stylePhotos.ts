/**
 * Écrit par `tools/detour-styles.py` : ne pas modifier à la main.
 * Les tenues détourées de chaque style, par rayon (voir `styles.ts`).
 */
import type { ImageSourcePropType } from 'react-native';

export const STYLE_PHOTOS: Record<string, { femme: ImageSourcePropType[]; homme: ImageSourcePropType[] }> = {
  y2k: {
    femme: [require('../../assets/styles/femme/y2k-1.webp')],
    homme: [require('../../assets/styles/homme/y2k-1.webp'), require('../../assets/styles/homme/y2k-2.webp')],
  },
  workwear: {
    femme: [require('../../assets/styles/femme/workwear-1.webp'), require('../../assets/styles/femme/workwear-2.webp'), require('../../assets/styles/femme/workwear-3.webp')],
    homme: [require('../../assets/styles/homme/workwear-1.webp'), require('../../assets/styles/homme/workwear-2.webp'), require('../../assets/styles/homme/workwear-3.webp')],
  },
  gothique: {
    femme: [require('../../assets/styles/femme/gothique-1.webp')],
    homme: [require('../../assets/styles/homme/gothique-1.webp')],
  },
  grunge: {
    femme: [require('../../assets/styles/femme/grunge-1.webp'), require('../../assets/styles/femme/grunge-2.webp')],
    homme: [require('../../assets/styles/homme/grunge-1.webp')],
  },
  old_money: {
    femme: [require('../../assets/styles/femme/old_money-1.webp'), require('../../assets/styles/femme/old_money-2.webp')],
    homme: [require('../../assets/styles/homme/old_money-1.webp'), require('../../assets/styles/homme/old_money-2.webp')],
  },
  techwear: {
    femme: [require('../../assets/styles/femme/techwear-1.webp'), require('../../assets/styles/femme/techwear-2.webp')],
    homme: [require('../../assets/styles/homme/techwear-1.webp'), require('../../assets/styles/homme/techwear-2.webp')],
  },
  preppy: {
    femme: [require('../../assets/styles/femme/preppy-1.webp'), require('../../assets/styles/femme/preppy-2.webp')],
    homme: [require('../../assets/styles/homme/preppy-1.webp'), require('../../assets/styles/homme/preppy-2.webp')],
  },
  gorpcore: {
    femme: [require('../../assets/styles/femme/gorpcore-1.webp'), require('../../assets/styles/femme/gorpcore-2.webp')],
    homme: [require('../../assets/styles/homme/gorpcore-1.webp'), require('../../assets/styles/homme/gorpcore-2.webp')],
  },
  streetwear: {
    femme: [require('../../assets/styles/femme/streetwear-1.webp'), require('../../assets/styles/femme/streetwear-2.webp'), require('../../assets/styles/femme/streetwear-3.webp')],
    homme: [require('../../assets/styles/homme/streetwear-1.webp'), require('../../assets/styles/homme/streetwear-2.webp'), require('../../assets/styles/homme/streetwear-3.webp')],
  },
};
