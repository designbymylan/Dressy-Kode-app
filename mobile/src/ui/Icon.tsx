/**
 * Jeu d'icônes original de Dresskode, redessiné pour la galerie : traits fins
 * de 1,7 sur une grille de 24, bouts et angles nets, noir monochrome. Chaque
 * forme reprend l'objet le plus évident (une maison, un t-shirt, une bulle,
 * un calendrier, une silhouette) pour se comprendre sans son nom.
 *
 * Les icônes de navigation ont une version pleine, pour l'état actif
 * (`filled`). Aucune icône n'est reprise d'un jeu propriétaire.
 */
import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

const PATHS = {
  // Navigation
  home: 'M3.5 11 12 4l8.5 7M5.5 9.4V20h13V9.4M10 20v-5.5h4V20',
  dressing: 'M8.6 4 3.5 6.6 2.4 11.4l3.4 1.1V20h12.4v-7.5l3.4-1.1-1.1-4.8L15.4 4c-.5 1.7-1.8 2.7-3.4 2.7S9.1 5.7 8.6 4Z',
  kode: 'M3.5 4.5h17v12h-10L5.5 20.5v-4h-2ZM12 7.6l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9Z',
  calendar: 'M3.5 6h17v14.5h-17ZM3.5 10.5h17M8 3.5v4.5M16 3.5v4.5M7.5 13.5h3v3h-3Z',
  person: 'M12 12.2a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8ZM4.5 20.5c.6-3.9 3.6-6 7.5-6s6.9 2.1 7.5 6Z',
  // Objets et actions
  hanger: 'M10 5.6a2 2 0 1 1 2 2v1.3M12 8.9 3 15.5h18Z',
  search: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM15.5 15.5 21 21',
  plus: 'M12 4.5v15M4.5 12h15',
  minus: 'M4.5 12h15',
  filter: 'M3.5 5h17l-6.5 7.6v6.4l-4 1.5v-7.9Z',
  back: 'M15 4.5 7.5 12l7.5 7.5',
  chevron: 'M9 4.5 16.5 12 9 19.5',
  arrow: 'M4 12h15.5M13.5 6l6 6-6 6',
  up: 'M5.5 15.5 12 9l6.5 6.5',
  down: 'M5.5 8.5 12 15l6.5-6.5',
  close: 'M5.5 5.5l13 13M18.5 5.5l-13 13',
  check: 'M4.5 12.5l4.8 4.8L19.5 7',
  share: 'M12 3.5V15M7.5 8 12 3.5 16.5 8M5 12v8.5h14V12',
  more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  sun: 'M12 16.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4ZM12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6',
  cloud: 'M7 18.5a4.2 4.2 0 0 1-.6-8.4 5.6 5.6 0 0 1 10.8-.6 3.6 3.6 0 0 1-.2 9Z',
  rain: 'M7 14.5a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6-.6 3.4 3.4 0 0 1-.2 8.6ZM8.5 17.5l-1.2 3M12.5 17.5l-1.2 3M16.5 17.5l-1.2 3',
  showers: 'M6.5 8.5a3 3 0 0 1 5-2M7.5 16a3.6 3.6 0 0 1-.5-7.2 5 5 0 0 1 9.6-.4 3.3 3.3 0 0 1-.2 7.6ZM10 18.5l-1 2.5M14.5 18.5l-1 2.5M3.5 9h1.5M4.6 5.1l1 1',
  grid: 'M4 4h7v7H4ZM13 4h7v7h-7ZM4 13h7v7H4ZM13 13h7v7h-7Z',
  rails: 'M2.5 5h19M7.5 5v2.4L3.5 13h8l-4-5.6M16.5 5v2.4l-3.5 11.6h7L16.5 7.4',
  camera: 'M3.5 7.5h4l1.5-2.5h6l1.5 2.5h4V19h-17ZM12 16a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z',
  image: 'M3.5 4.5h17v15h-17ZM3.5 15.5l5-5 4.5 4.5 2.5-2.5 5 5M15.5 9h.01',
  send: 'M12 20V4.5M5.5 11 12 4.5l6.5 6.5',
  mail: 'M3.5 6h17v12h-17ZM3.5 6.5l8.5 6.5 8.5-6.5',
  trash: 'M4.5 7h15M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 10.5v6M14 10.5v6',
  edit: 'M4 20h4.2L19.5 8.7l-4.2-4.2L4 15.8ZM13 6.8l4.2 4.2',
  bag: 'M4.5 8h15l-1 12.5h-13ZM8.8 8V6.5a3.2 3.2 0 0 1 6.4 0V8',
  ruler: 'M3.5 15.5 15.5 3.5l5 5-12 12ZM7.5 11.5l1.8 1.8M10.5 8.5l1.8 1.8M13.5 5.5l1.8 1.8',
  sliders: 'M3.5 7h17M3.5 12h17M3.5 17h17M7 5v4M15 10v4M10 15v4',
  refresh: 'M19.5 8.5A8 8 0 0 0 5 9.5M4.5 15.5A8 8 0 0 0 19 14.5M19.5 3.5v5h-5M4.5 20.5v-5h5',
  gift: 'M3.5 9.5h17v3.5h-17ZM5 13h14v7.5H5ZM12 9.5v11M12 9.5c-1-3-5.5-4-5.5-1.5S9.5 9.5 12 9.5Zm0 0c1-3 5.5-4 5.5-1.5S14.5 9.5 12 9.5Z',
  heart: 'M12 19.5s-7.5-4.6-7.5-10A4 4 0 0 1 12 7a4 4 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10Z',
  lock: 'M5.5 11h13v9.5h-13ZM8.3 11V8a3.7 3.7 0 0 1 7.4 0v3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  plane: 'M2.5 13.5l7-2.5 4-7.5h2l-2 7.5 5 1.5 1 2-6 .5-3 5.5h-2l1-5.5-7-.5Z',
  palette: 'M12 3.5a8.5 8.5 0 1 0 0 17h1.4a1.9 1.9 0 0 0 0-3.8 1.9 1.9 0 0 1 0-3.8H16a4.5 4.5 0 0 0 4.5-4.5c0-2.9-3.8-4.9-8.5-4.9ZM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01',
  chart: 'M4.5 20V11M12 20V4.5M19.5 20v-7M3 20.5h18',
  leaf: 'M5 19.5c0-8.5 5.5-14 15-15 0 9.5-5.5 15-14 15ZM5 19.5l7.5-7.5',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z',
  alert: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 7.5v6M12 16.5h.01',
  help: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM9.6 9.5a2.4 2.4 0 1 1 3.4 2.2c-.6.3-1 .8-1 1.5v.5M12 16.8h.01',
  logout: 'M14 4.5H5v15h9M10.5 12H20M16.5 8.5 20 12l-3.5 3.5',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  pin: 'M12 21.5s6.5-5.8 6.5-11.5a6.5 6.5 0 0 0-13 0c0 5.7 6.5 11.5 6.5 11.5ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 7.5V12l3 2',
  tag: 'M3.5 3.5h7.5l9.5 9.5-7.5 7.5-9.5-9.5ZM8 8h.01',
  offline: 'M3.5 9a13 13 0 0 1 17 0M6.8 12.5a8.3 8.3 0 0 1 10.4 0M9.8 16a3.6 3.6 0 0 1 4.4 0M12 19.5h.01M4 4l16 16',
  layers: 'M12 3.5l8.5 4.3-8.5 4.3-8.5-4.3ZM3.5 12l8.5 4.3 8.5-4.3M3.5 16.2l8.5 4.3 8.5-4.3',
} as const;

/** Les versions pleines (état actif), en remplissage pair-impair pour garder les jours (porte, bandeau, date). */
const FILLED: Partial<Record<keyof typeof PATHS, string>> = {
  home: 'M12 3.4 2.9 11h2.6v9.6h13V11h2.6ZM10 20.6v-6.1h4v6.1Z',
  dressing: 'M8.6 4 3.5 6.6 2.4 11.4l3.4 1.1V20h12.4v-7.5l3.4-1.1-1.1-4.8L15.4 4c-.5 1.7-1.8 2.7-3.4 2.7S9.1 5.7 8.6 4Z',
  kode: 'M3.5 4.5h17v12h-10L5.5 20.5v-4h-2ZM12 7.6l-.9 2.4-2.4.9 2.4.9.9 2.4.9-2.4 2.4-.9-2.4-.9Z',
  calendar: 'M3.5 6h17v14.5h-17ZM5 11.5v7.5h14v-7.5ZM8 3.5h1.7V6H8ZM14.3 3.5H16V6h-1.7ZM7.5 13.5h3v3h-3Z',
  person: 'M12 12.2a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8ZM4.5 20.5c.6-3.9 3.6-6 7.5-6s6.9 2.1 7.5 6Z',
};

export type IconName = keyof typeof PATHS;

type Props = { name: IconName; size?: number; color: string; strokeWidth?: number; filled?: boolean };

function IconBase({ name, size = 22, color, strokeWidth = 1.7, filled }: Props) {
  const solid = filled ? FILLED[name] : undefined;
  const dots = name === 'more';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      {solid ? (
        <Path d={solid} fill={color} fillRule="evenodd" stroke={color} strokeWidth={0.6} strokeLinejoin="miter" />
      ) : (
        <Path d={PATHS[name]} stroke={color} strokeWidth={dots ? 3 : strokeWidth} strokeLinecap="square" strokeLinejoin="miter" fill="none" />
      )}
    </Svg>
  );
}

export const Icon = memo(IconBase);
