/**
 * Jetons du design system Dresskode, « vitrine de verre ».
 * La direction vient du travail du portable (web/src/app/globals.css, planches
 * « App design » du 28/09) : fond perle traversé de halos pastel, surfaces en
 * verre dépoli, boutons pilule (encre pleine pour l'action, verre pour le
 * reste), titres serrés avec un mot en italique serif. La disposition des
 * écrans, elle, reste celle de la refonte (design/refonte/).
 * Les couleurs vivent dans palette.json : c'est le fichier que lit
 * design/refonte/contraste.py, pour que le code et la vérification AA
 * ne puissent pas diverger.
 */
import { Easing } from 'react-native-reanimated';
import palette from './palette.json';

export type Scheme = 'light' | 'dark';
export type ColorName = keyof typeof palette.light;
export type Colors = Record<ColorName, string>;

export const colors: Record<Scheme, Colors> = palette;

/** Grille de 4 pt ; la gouttière de page est de 20 pt. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40, gutter: 20 } as const;

/**
 * Rayons : cartes de verre 28, vignettes 22 (globals.css : --r-card, --r-tile).
 * Tout ce qui se clique est en capsule.
 */
export const radius = { sm: 12, md: 18, tile: 22, lg: 24, card: 28, xl: 32, sheet: 32, capsule: 999 } as const;

/** Taille mini d'une cible tactile (HIG) : 44 × 44 pt. */
export const HIT = 44;

/**
 * Échelle typographique. Un seul grotesque pour l'interface et les titres
 * (Satoshi dans la direction, DM Sans en attendant ses fichiers : voir App.tsx),
 * serré dans les grands corps (−0,035 em) ; l'italique serif (Instrument
 * Serif) ne porte que le mot qui chante d'un titre, les citations de Kode et
 * les numéros. Jamais sous 11,5 pt.
 */
export const type = {
  masthead: { fontFamily: 'Sans700', fontSize: 12, letterSpacing: 3.6, lineHeight: 16 },
  kicker: { fontFamily: 'Sans500', fontSize: 12, letterSpacing: 1, lineHeight: 16 },
  hero: { fontFamily: 'Sans500', fontSize: 44, lineHeight: 47, letterSpacing: -1.6 },
  title: { fontFamily: 'Sans500', fontSize: 34, lineHeight: 37, letterSpacing: -1.2 },
  section: { fontFamily: 'Sans500', fontSize: 23, lineHeight: 27, letterSpacing: -0.7 },
  quote: { fontFamily: 'Accent', fontSize: 21, lineHeight: 26 },
  cardTitle: { fontFamily: 'Sans500', fontSize: 20, lineHeight: 24, letterSpacing: -0.5 },
  numeral: { fontFamily: 'Accent', fontSize: 20, lineHeight: 23 },
  bodyL: { fontFamily: 'Sans400', fontSize: 17, lineHeight: 25 },
  body: { fontFamily: 'Sans400', fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: 'Sans600', fontSize: 15, lineHeight: 22, letterSpacing: -0.15 },
  button: { fontFamily: 'Sans600', fontSize: 15, lineHeight: 20, letterSpacing: -0.15 },
  caption: { fontFamily: 'Sans500', fontSize: 13, lineHeight: 19 },
  small: { fontFamily: 'Sans500', fontSize: 12, lineHeight: 16 },
  tab: { fontFamily: 'Sans600', fontSize: 10.5, lineHeight: 13 },
} as const;

/**
 * Matière. Le verre des cartes est une surface blanche translucide posée
 * sur les halos, bordée d'un filet clair et d'une ombre douce ; la couche de
 * navigation (onglets, boutons flottants, feuilles) ajoute le flou, ou le
 * vrai Liquid Glass sur iOS 26. Opacité de la navigation : 72 % en clair,
 * 80 % en sombre, le minimum qui garde les icônes lisibles quel que soit
 * le vêtement qui passe dessous (contraste.py).
 */
export const material = {
  blur: 24,
  tabHeight: 66,
  tabBottom: 12,
  shadow: {
    light: { shadowColor: '#282C46', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
    dark: { shadowColor: '#000000', shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  },
  /** Ombre d'une carte de verre (--shadow-glass). */
  card: {
    light: { shadowColor: '#282C46', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 0 },
    dark: { shadowColor: '#000000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 0 },
  },
  /** Ombre d'un bouton encre (--shadow-press). */
  press: {
    light: { shadowColor: '#0E0F13', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
    dark: { shadowColor: '#000000', shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  },
} as const;

/** Motion : des ressorts plutôt que des courbes, courts, jamais bloquants. */
export const motion = {
  press: { damping: 22, stiffness: 420, mass: 0.6 },
  snappy: { damping: 20, stiffness: 300, mass: 0.8 },
  gentle: { damping: 18, stiffness: 170, mass: 1 },
  sheet: { damping: 26, stiffness: 260, mass: 0.9 },
  swing: { damping: 6, stiffness: 90, mass: 0.6 },
  duration: { fast: 160, base: 240, slow: 360 },
  easing: Easing.bezier(0.2, 0.8, 0.2, 1),
  /** Ressort des boutons et des onglets (--ease-spring). */
  spring: { damping: 14, stiffness: 260, mass: 0.7 },
  pressScale: 0.965,
} as const;

/** Espace laissé sous le contenu pour la barre d'onglets flottante. */
export const TAB_CLEARANCE = material.tabHeight + material.tabBottom + 24;
