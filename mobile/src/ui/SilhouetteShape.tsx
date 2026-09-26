import Svg, { Path } from 'react-native-svg';
import type { Silhouette } from '../state/store';

/** Silhouettes abstraites (épaules, taille, hanches), dessinées pour Dresskode : aucune n'est « la bonne ». */
const SHAPES: Record<Exclude<Silhouette, 'inconnue'>, [number, number, number]> = {
  A: [13, 11, 19],
  V: [20, 12, 13],
  H: [16, 15, 16],
  X: [18, 9, 18],
  O: [15, 19, 15],
};

export const SILHOUETTES: { id: Exclude<Silhouette, 'inconnue'>; note: string }[] = [
  { id: 'X', note: 'Épaules et hanches alignées, taille marquée' },
  { id: 'A', note: 'Hanches plus présentes que les épaules' },
  { id: 'V', note: 'Épaules plus présentes que les hanches' },
  { id: 'H', note: 'Épaules, taille et hanches dans le même axe' },
  { id: 'O', note: 'Volume centré sur le buste et la taille' },
];

export function SilhouetteShape({ id, size = 48, color, fill }: { id: Exclude<Silhouette, 'inconnue'>; size?: number; color: string; fill: string }) {
  const [sh, wa, hi] = SHAPES[id];
  const d = `M${30 - sh} 14 C ${30 - sh} 30, ${30 - wa} 40, ${30 - wa} 50 C ${30 - wa} 60, ${30 - hi} 66, ${30 - hi} 78 L ${30 - hi + 2} 94 L ${30 + hi - 2} 94 L ${30 + hi} 78 C ${30 + hi} 66, ${30 + wa} 60, ${30 + wa} 50 C ${30 + wa} 40, ${30 + sh} 30, ${30 + sh} 14 Q 30 8 ${30 - sh} 14 Z`;
  return (
    <Svg width={size} height={size * 1.6} viewBox="0 0 60 100" accessibilityElementsHidden>
      <Path d={d} fill={fill} stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}
