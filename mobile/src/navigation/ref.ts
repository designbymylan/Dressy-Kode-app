import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * La navigation, atteignable hors d'un écran (12/11) : le message de
 * confirmation vit au-dessus des écrans et son bouton « Voir » doit pouvoir
 * y mener.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const navRef = createNavigationContainerRef<any>();

/** Ouvre un écran si la navigation est prête ; sinon, ne fait rien. */
export function allerA(route: string, params?: object) {
  if (navRef.isReady()) navRef.navigate(route, params);
}
