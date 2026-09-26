/**
 * Jetons du design system Dresskode — direction B « Éditorial ».
 * Chaque valeur est justifiée dans design/refonte/02-design-system.md.
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
 * Rayons concentriques (WWDC25, session 356) : le rayon intérieur est le
 * rayon extérieur moins l'espacement. Tout ce qui se clique est en capsule.
 */
export const radius = { sm: 12, md: 18, lg: 24, xl: 32, sheet: 32, capsule: 999 } as const;

/** Taille mini d'une cible tactile (HIG) : 44 × 44 pt. */
export const HIT = 44;

/**
 * Échelle typographique. Le serif (Instrument Serif) porte la voix
 * éditoriale ; le grotesque (Hanken Grotesk) porte l'interface et le
 * texte courant, jamais sous 11,5 pt.
 */
export const type = {
  masthead: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 11, letterSpacing: 2.9, lineHeight: 14 },
  kicker: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12, letterSpacing: 1, lineHeight: 16 },
  hero: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 46, lineHeight: 46, letterSpacing: -0.4 },
  title: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 40, lineHeight: 42, letterSpacing: -0.3 },
  section: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 28, lineHeight: 31 },
  quote: { fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 21, lineHeight: 26 },
  cardTitle: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 23, lineHeight: 27 },
  numeral: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 19, lineHeight: 22 },
  bodyL: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 17, lineHeight: 24 },
  body: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, lineHeight: 21 },
  button: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, lineHeight: 20 },
  caption: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, lineHeight: 18 },
  small: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 11.5, lineHeight: 15 },
  tab: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 10.5, lineHeight: 13 },
} as const;

/**
 * Matière. Le verre est réservé à la couche de navigation (barre d'onglets,
 * boutons flottants, en-têtes au défilement, feuilles) — jamais au contenu.
 * Opacité mini 80 % en clair, 86 % en sombre : en dessous, le texte ne tient
 * plus AA au-dessus d'un vêtement blanc ou d'une robe noire.
 */
export const material = {
  blur: 22,
  tabHeight: 64,
  tabBottom: 22,
  shadow: {
    light: { shadowColor: '#1C1A17', shadowOpacity: 0.16, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
    dark: { shadowColor: '#000000', shadowOpacity: 0.55, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
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
  pressScale: 0.97,
} as const;

/** Espace laissé sous le contenu pour la barre d'onglets flottante. */
export const TAB_CLEARANCE = material.tabHeight + material.tabBottom + 24;
