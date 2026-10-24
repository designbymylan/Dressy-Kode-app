/**
 * Jetons du design system Dresskode. Les formes et les composants sont ceux
 * du 02/10 (revenus le 04/10 à la demande de Mylan) : verre dépoli, arrondis,
 * capsules, boutons en casse normale. Les couleurs restent celles de la
 * « galerie » (fond blanc, texte noir, gris studio sous les vêtements, rose
 * poudré pour les bandeaux de service, halos crème, noirs en sombre) ; la
 * typographie est celle de la charte v2 du 09/10 (Inter Tight et Inter,
 * design/charte-typographique-v2.md, polices dans fonts.ts). La disposition des écrans reste celle de la
 * refonte (design/refonte/).
 * Les couleurs vivent dans palette.json : c'est le fichier que lit
 * design/refonte/contraste.py, pour que le code et la vérification AA
 * ne puissent pas diverger.
 */
import { Easing } from 'react-native-reanimated';
import palette from './palette.json';
import { F } from './fonts';

export type Scheme = 'light' | 'dark';
export type ColorName = keyof typeof palette.light;
export type Colors = Record<ColorName, string>;

export const colors: Record<Scheme, Colors> = palette;

/** Grille de 4 pt ; marge de page de 20 pt, sections espacées de 40. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40, gutter: 20 } as const;

/**
 * Rayons (décision du 03/10) : cartes de verre 28, vignettes 22, feuilles 32
 * (globals.css : --r-card, --r-tile). Tout ce qui se clique est en capsule.
 */
export const radius = { sm: 12, md: 18, tile: 22, lg: 24, card: 28, xl: 32, sheet: 32, capsule: 999, round: 999 } as const;

/** Taille mini d'une cible tactile (HIG) : 44 × 44 pt. */
export const HIT = 44;

/** Chiffres de même largeur : un prix, un compteur ne bougent pas. */
const tab = { fontVariant: ['tabular-nums' as const] };

/**
 * Échelle de la charte typographique v2 (09/10) : sept tailles qui montent
 * d'un même pas (11, 12, 13, 15, 17, 20, 22, 28, 30), titres en casse
 * normale. Inter Tight fin pour les titres et les grands chiffres, Inter 500
 * pour le texte, 600 pour l'insistance ; étiquettes en capitales espacées,
 * à la manière des grandes enseignes de mode. Rien sous 11 px, et les
 * capitales seulement sur deux ou trois mots.
 */
export const type = {
  // La marque, DRESSKODE : Inter Tight en capitales, interlettrage 0,3 em.
  brand: { ...F.displayStrong, fontSize: 13, lineHeight: 16, textTransform: 'uppercase' as const, letterSpacing: 3.9 },
  // Le mot de la page, en capitales espacées.
  masthead: { ...F.s500, fontSize: 11, letterSpacing: 0.9, lineHeight: 14, textTransform: 'uppercase' as const },
  // Étiquette de carte ou de section (« TENUE DU JOUR », « TOUT VOIR ») : capitales espacées.
  label: { ...F.s500, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: 'uppercase' as const },
  // Petite information (« 40 / 60 places », « pièces ») : Inter 500, casse normale.
  kicker: { ...F.mono, fontSize: 12, lineHeight: 16, letterSpacing: 0, ...tab },
  hero: { ...F.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.3 },
  title: { ...F.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.28 },
  section: { ...F.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.22 },
  // Grands chiffres (coût par port, compteurs, pourcentages) : Inter Tight fin.
  stat: { ...F.display, fontSize: 26, lineHeight: 30, ...tab },
  quote: { ...F.s500, fontSize: 17, lineHeight: 24 },
  cardTitle: { ...F.displayStrong, fontSize: 20, lineHeight: 24, letterSpacing: -0.1 },
  numeral: { ...F.mono, fontSize: 13, lineHeight: 18, ...tab },
  bodyL: { ...F.s500, fontSize: 17, lineHeight: 24 },
  body: { ...F.s500, fontSize: 15, lineHeight: 21 },
  bodyStrong: { ...F.s600, fontSize: 15, lineHeight: 21 },
  button: { ...F.s600, fontSize: 15, lineHeight: 20 },
  caption: { ...F.s500, fontSize: 13, lineHeight: 18 },
  small: { ...F.s500, fontSize: 12, lineHeight: 16 },
  tab: { ...F.s500, fontSize: 12, lineHeight: 15 },
} as const;

/**
 * Matière : le verre (décision du 03/10). Les cartes sont du blanc
 * translucide posé sur les halos, bordé d'un filet et d'une ombre douce ; la
 * couche de navigation (onglets, boutons flottants, feuilles) ajoute le flou,
 * ou le vrai Liquid Glass sur iOS 26. Ombres neutres, sans teinte. Les boutons
 * n'ont pas d'ombre (décision du 24/10).
 */
export const material = {
  blur: 24,
  tabHeight: 68,
  tabBottom: 12,
  shadow: {
    light: { shadowColor: '#111111', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
    dark: { shadowColor: '#000000', shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  },
  /** Ombre d'une carte de verre (--shadow-glass). */
  card: {
    light: { shadowColor: '#111111', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 0 },
    dark: { shadowColor: '#000000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 0 },
  },
} as const;

/**
 * Motion. Ce qui arrive par le bas (feuilles, messages, bulles, Personnaliser)
 * glisse sans rebond, à `duration.base` et `easing` (décision du 24/10). Les
 * ressorts restent pour l'appui et les bascules, courts et discrets.
 */
export const motion = {
  press: { damping: 22, stiffness: 420, mass: 0.6 },
  snappy: { damping: 20, stiffness: 300, mass: 0.8 },
  gentle: { damping: 18, stiffness: 170, mass: 1 },
  swing: { damping: 6, stiffness: 90, mass: 0.6 },
  duration: { fast: 160, base: 240, slow: 360 },
  easing: Easing.bezier(0.2, 0.8, 0.2, 1),
  /** Ressort des boutons et des onglets (--ease-spring). */
  spring: { damping: 14, stiffness: 260, mass: 0.7 },
  pressScale: 0.965,
} as const;

/** Espace laissé sous le contenu pour la barre d'onglets flottante. */
export const TAB_CLEARANCE = material.tabHeight + material.tabBottom + 24;
