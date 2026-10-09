/**
 * Les polices de Dresskode, appelées par rôle (charte typographique v2,
 * décidée le 09/10, design/charte-typographique-v2.md) :
 * - titres d'écran, marque et grands chiffres : Inter Tight, fin (300) ou
 *   régulier (400) sous 24 px (`display`, `displayStrong`) ;
 * - texte, boutons, onglets, formulaires : Inter, un cran plus épais que
 *   l'ancienne charte (500 pour le texte courant, 600 pour l'insistance) ;
 * - les petites étiquettes (`mono`, le nom est resté) : Inter 500, en
 *   capitales espacées quand le style les demande.
 *
 * Les fichiers sont dans assets/fonts (licence OFL, fournie à côté), réduits
 * au latin, chargés par App.tsx sous ces noms.
 *
 * Partout dans l'app : `...F.s500` (jamais un nom de police en dur).
 */
import type { TextStyle } from 'react-native';

export const FONT_FILES = {
  'InterTight-Light': require('../../assets/fonts/InterTight-Light.ttf'),
  'InterTight-Regular': require('../../assets/fonts/InterTight-Regular.ttf'),
  'InterTight-Medium': require('../../assets/fonts/InterTight-Medium.ttf'),
  'Inter-Regular': require('../../assets/fonts/Inter-Regular.ttf'),
  'Inter-Medium': require('../../assets/fonts/Inter-Medium.ttf'),
  'Inter-SemiBold': require('../../assets/fonts/Inter-SemiBold.ttf'),
};

type Family = keyof typeof FONT_FILES;
const f = (fontFamily: Family): TextStyle => ({ fontFamily });

export const F = {
  s400: f('Inter-Regular'),
  s500: f('Inter-Medium'),
  s600: f('Inter-SemiBold'),
  // La charte s'arrête au SemiBold pour le texte.
  s700: f('Inter-SemiBold'),
  display: f('InterTight-Light'),
  displayStrong: f('InterTight-Regular'),
  // L'ancien mot en accent, glissé dans un titre : un cran plus appuyé que le titre.
  accent: f('InterTight-Medium'),
  mono: f('Inter-Medium'),
} as const;
