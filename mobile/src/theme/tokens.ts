/**
 * Jetons du design system Dresskode, direction « galerie » (CLAUDE.md, charte
 * d'origine dans design/charte-galerie.md) : fond blanc, texte noir, filets
 * gris d'un pixel, gris studio sous les vêtements, beurre pour les bandeaux
 * de service ; arrondis, verre dépoli et transparence façon iOS (décision du
 * 03/10), sur des halos crème très discrets. Typographie : charte v1
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
 * Rayons (décision du 03/10) : cartes de verre 28, vignettes 22, feuilles 32
 * (globals.css : --r-card, --r-tile). Tout ce qui se clique est en capsule.
 */
export const radius = { sm: 12, md: 18, tile: 22, lg: 24, card: 28, xl: 32, sheet: 32, capsule: 999, round: 999 } as const;

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
  hero: { ...F.display, fontSize: 28, lineHeight: 30, ...caps(28) },
  title: { ...F.display, fontSize: 25, lineHeight: 27, ...caps(25) },
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

/**
 * Matière : le verre (décision du 03/10). Les cartes sont du blanc
 * translucide posé sur les halos, bordé d'un filet et d'une ombre douce ; la
 * couche de navigation (onglets, boutons flottants, feuilles) ajoute le flou,
 * ou le vrai Liquid Glass sur iOS 26. Ombres neutres, sans teinte.
 */
export const material = {
  blur: 24,
  tabHeight: 66,
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
  /** Ombre d'un bouton noir (--shadow-press). */
  press: {
    light: { shadowColor: '#000000', shadowOpacity: 0.24, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
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
