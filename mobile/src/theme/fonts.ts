/**
 * Les polices de Dresskode, appelées par rôle (charte typographique v1,
 * design/charte-typographique-v1.md) :
 * - titres d'écran, marque et grands chiffres : Cormorant Garamond (`display`) ;
 * - texte, boutons, onglets, formulaires : Hanken Grotesk (`s400` à `s700`) ;
 * - étiquettes courtes (25 caractères au plus) : DM Mono (`mono`).
 *
 * Les fichiers sont dans assets/fonts (licence OFL, fournie à côté), chargés
 * par App.tsx sous ces noms. Ils sont réduits au latin, et les chiffres de
 * Cormorant sont alignés sur la ligne de base par défaut : un prix se lit
 * sans réglage particulier.
 *
 * Partout dans l'app : `...F.s500` (jamais un nom de police en dur).
 */
import type { TextStyle } from 'react-native';

export const FONT_FILES = {
  'CormorantGaramond-Medium': require('../../assets/fonts/CormorantGaramond-Medium.ttf'),
  'CormorantGaramond-SemiBold': require('../../assets/fonts/CormorantGaramond-SemiBold.ttf'),
  'HankenGrotesk-Regular': require('../../assets/fonts/HankenGrotesk-Regular.ttf'),
  'HankenGrotesk-Medium': require('../../assets/fonts/HankenGrotesk-Medium.ttf'),
  'HankenGrotesk-SemiBold': require('../../assets/fonts/HankenGrotesk-SemiBold.ttf'),
  'DMMono-Regular': require('../../assets/fonts/DMMono-Regular.ttf'),
};

type Family = keyof typeof FONT_FILES;
const f = (fontFamily: Family): TextStyle => ({ fontFamily });

export const F = {
  s400: f('HankenGrotesk-Regular'),
  s500: f('HankenGrotesk-Medium'),
  s600: f('HankenGrotesk-SemiBold'),
  // La charte s'arrête au SemiBold pour le texte.
  s700: f('HankenGrotesk-SemiBold'),
  display: f('CormorantGaramond-Medium'),
  displayStrong: f('CormorantGaramond-SemiBold'),
  // L'ancien mot en accent, glissé dans un titre : il prend la police du titre.
  accent: f('CormorantGaramond-Medium'),
  mono: f('DMMono-Regular'),
} as const;
