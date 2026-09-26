import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * La taille de l'écran de l'app. Sur téléphone, c'est la fenêtre ; dans
 * l'aperçu web, c'est le cadre du téléphone, pas la fenêtre du navigateur.
 */
export const ScreenSize = createContext<{ width: number; height: number } | null>(null);

export function useScreen() {
  const win = useWindowDimensions();
  return useContext(ScreenSize) ?? win;
}
