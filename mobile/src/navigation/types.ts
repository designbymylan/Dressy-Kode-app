import type { NavigatorScreenParams, NavigationProp, RouteProp } from '@react-navigation/native';
import type { CategoryId } from '../data/wardrobe';
import type { Iso } from '../state/planning';

export type TabParams = {
  Home: undefined;
  Dressing: { category?: CategoryId; view?: 'rangees' | 'portants' | 'grille'; search?: boolean } | undefined;
  Kode: { ask?: string; nonce?: number } | undefined;
  Agenda: { day?: number } | undefined;
  Me: undefined;
};

export type RootParams = {
  Welcome: undefined;
  Onboarding: undefined;
  Tabs: NavigatorScreenParams<TabParams> | undefined;
  /** `from` : où était la vignette touchée, pour que la fiche naisse d'elle. */
  Piece: { id: string; from?: { x: number; y: number; w: number; h: number } };
  AddPiece: undefined;
  Compose: { day?: number; date?: Iso; with?: string; pieces?: string[] } | undefined;
  /** Le grand calendrier des tenues prévues (07/10). */
  Planning: { date?: Iso; choisir?: boolean } | undefined;
  /** Un rendez-vous à créer (date) ou à corriger (id). */
  EventEdit: { id?: string; date?: Iso } | undefined;
  /** Un voyage à préparer, ou à revoir (id). */
  Trip: { id?: string } | undefined;
  Event: { id: string };
  Silhouette: undefined;
  Customize: undefined;
  /** Les questions qui aident Kodi (silhouette, tailles, goûts), posées après l'entrée (09/10). */
  Affiner: undefined;
  /** Photo, nom, pseudo et ce que Kodi retient de toi (07/10). */
  ProfileEdit: undefined;
  /** Les réglages, ouverts par la roue de Moi (07/10). */
  Settings: undefined;
  /** Le bilan de la semaine (09/10), à l'accueil le dimanche et depuis Moi. */
  Bilan: undefined;
  /** Tes données (09/10, RGPD) : ce qui est gardé, tes accords, tes droits. */
  TesDonnees: undefined;
  /** La politique de confidentialité (09/10). */
  Confidentialite: undefined;
  Share: { id: string };
  Offers: undefined;
  Shop: { pack?: string } | undefined;
  States: undefined;
};

export type Nav = NavigationProp<RootParams & TabParams>;
export type Route<K extends keyof RootParams | keyof TabParams> = RouteProp<RootParams & TabParams, K>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootParams {}
  }
}
