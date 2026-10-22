import { createContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

/**
 * L'appui en cours sur un `Tap` (0 au repos, 1 enfoncé), pour que les icônes
 * qu'il porte jouent leur geste (21/10, comme `data-anim` sur le web).
 * `null` hors d'un élément touchable : l'icône reste immobile.
 */
export const PressContext = createContext<SharedValue<number> | null>(null);
