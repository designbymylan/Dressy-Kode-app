/**
 * Jetons du design system Dresskode, direction « galerie » (CLAUDE.md, charte
 * d'origine dans design/charte-galerie.md) : fond blanc, texte noir, filets
 * gris d'un pixel, gris studio sous les vêtements, beurre pour les bandeaux
 * de service ; angles droits, aucune ombre. Typographie : charte v1
 * (design/charte-typographique-v1.md, polices dans fonts.ts). Le mode sombre en est tiré (fond noir, texte blanc, beurre gardé).
 * La disposition des écrans, elle, reste celle de la refonte (design/refonte/).
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

/** Grille de 4 pt ; marge de page de 16 pt, sections espacées de 40. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40, gutter: 16 } as const;

/**
 * Angles droits partout : cartes, vignettes, boutons, champs, feuilles, puces.
 * Une seule forme ronde (`round`) : le bouton de Kode au centre de la barre
 * d'onglets, et les avatars.
 */
export const radius = { sm: 0, md: 0, tile: 0, lg: 0, card: 0, xl: 0, sheet: 0, capsule: 0, round: 999 } as const;

/** Taille mini d'une cible tactile (HIG) : 44 × 44 pt. */
export const HIT = 44;

/** Titres en capitales, interlettrage +0,012 em (charte typographique v1). */
const caps = (size: number) => ({ textTransform: 'uppercase' as const, letterSpacing: Math.round(size * 0.012 * 100) / 100 });

/**
 * Échelle de la charte typographique v1. Cormorant (titres, marque, chiffres)
 * jamais sous 22 px, sauf la marque ; DM Mono pour les étiquettes courtes,
 * jamais pour du texte lu ; Hanken Grotesk pour tout le reste. Rien sous
 * 11,5 px.
 */
export const type = {
  // La marque, DRESSKODE : Cormorant en capitales, interlettrage 0,24 em.
  brand: { ...F.displayStrong, fontSize: 17, lineHeight: 20, textTransform: 'uppercase' as const, letterSpacing: 4.1 },
  // Le mot de la page en haut à gauche (LE DRESSING, KODE…).
  masthead: { ...F.s600, fontSize: 13, letterSpacing: 0, lineHeight: 18 },
  // Étiquette (« Tenue du jour », « L'étiquette ») : mono, casse normale.
  kicker: { ...F.mono, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  hero: { ...F.display, fontSize: 32, lineHeight: 34, ...caps(32) },
  title: { ...F.display, fontSize: 28, lineHeight: 30, ...caps(28) },
  section: { ...F.display, fontSize: 22, lineHeight: 25, ...caps(22) },
  // Grands chiffres (coût par port, compteurs, pourcentages) : Cormorant, en casse normale.
  stat: { ...F.display, fontSize: 28, lineHeight: 31 },
  quote: { ...F.s400, fontSize: 17, lineHeight: 24 },
  cardTitle: { ...F.s500, fontSize: 17, lineHeight: 22, letterSpacing: -0.1 },
  numeral: { ...F.mono, fontSize: 13, lineHeight: 18 },
  bodyL: { ...F.s400, fontSize: 17, lineHeight: 24 },
  body: { ...F.s400, fontSize: 15, lineHeight: 21.75 },
  bodyStrong: { ...F.s500, fontSize: 15, lineHeight: 21.75 },
  button: { ...F.s500, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  caption: { ...F.s400, fontSize: 13, lineHeight: 18 },
  small: { ...F.s400, fontSize: 12, lineHeight: 16 },
  tab: { ...F.s500, fontSize: 12, lineHeight: 15 },
} as const;

const NONE = { shadowOpacity: 0, elevation: 0 } as const;

/**
 * Matière : il n'y en a plus. Les surfaces restent à plat et se distinguent
 * par le blanc, les filets et les cadres ; aucune ombre, aucun flou. Les clés
 * restent pour que les composants n'aient qu'un endroit à lire.
 */
export const material = {
  blur: 0,
  tabHeight: 58,
  tabBottom: 0,
  shadow: { light: NONE, dark: NONE },
  card: { light: NONE, dark: NONE },
  press: { light: NONE, dark: NONE },
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

/** Espace laissé sous le contenu pour la barre d'onglets. */
export const TAB_CLEARANCE = material.tabHeight + 24;
