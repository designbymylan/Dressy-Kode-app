/**
 * Jeu d'icônes original, dessiné pour Dresskode : trait 1,6 sur une grille
 * de 24, bouts ronds. Aucune icône n'est reprise d'un jeu propriétaire.
 */
import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

const PATHS = {
  home: 'M4 11.5 12 5l8 6.5V20H4ZM10 20v-5h4v5',
  hanger: 'M12 7.6a2 2 0 1 1 2-2M12 7.6v1.2L3.5 15.5h17L12 8.8',
  kode: 'M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9ZM18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z',
  calendar: 'M5 6.5h14v13H5ZM5 10.5h14M9 4v4M15 4v4',
  person: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  filter: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  share: 'M12 4v11M8 8l4-4 4 4M5 13v6h14v-6',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',
  cloud: 'M7 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9.5a3.5 3.5 0 0 1 0 8.5Z',
  rain: 'M7 15.5a4 4 0 0 1 .6-7.9A5.5 5.5 0 0 1 18 9.2a3.2 3.2 0 0 1-.4 6.3ZM9 18.5l-1 2M13 18.5l-1 2M17 18.5l-1 2',
  showers: 'M8 5.5a3 3 0 0 1 4.9 1.2M7 17a3.5 3.5 0 0 1-.5-6.96A5 5 0 0 1 16 9a3 3 0 0 1 .5 6ZM10 19.5l-.8 1.5M14 19.5l-.8 1.5M4.5 7.5h1M6 4.5l.7.7',
  grid: 'M5 5h5.5v5.5H5ZM13.5 5H19v5.5h-5.5ZM5 13.5h5.5V19H5ZM13.5 13.5H19V19h-5.5Z',
  rails: 'M3 5h18M8 5v2.5L4 13h8L8 7.5M16 5v2.5L12.5 19h7L16 7.5',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4ZM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  image: 'M4 5h16v14H4ZM4 15l4.5-4.5L13 15l2.5-2.5L20 17M15.5 9h.01',
  send: 'M12 19V5M6 11l6-6 6 6',
  trash: 'M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12',
  edit: 'M4 20h4L19 9l-4-4L4 16ZM13 7l4 4',
  bag: 'M5 8h14l-1 12H6ZM9 8V6.5a3 3 0 0 1 6 0V8',
  ruler: 'M4 15 15 4l5 5L9 20ZM8 11l1.5 1.5M11 8l1.5 1.5M14 5.5l1.2 1.2M5.5 14l1.2 1.2',
  sliders: 'M6 4v16M12 4v16M18 4v16M4 8h4M10 15h4M16 10h4',
  refresh: 'M19 8a8 8 0 0 0-14 2M5 16a8 8 0 0 0 14-2M19 4v4h-4M5 20v-4h4',
  gift: 'M4 10h16v3H4ZM5 13h14v7H5ZM12 10v10M12 10c-1-3-5-4-5-1.5S10 10 12 10Zm0 0c1-3 5-4 5-1.5S14 10 12 10Z',
  heart: 'M12 19s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.5C19 14.6 12 19 12 19Z',
  lock: 'M6 11h12v9H6ZM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  plane: 'M3 13.5l7-2.5 4-7h2l-2 7 5 1.5 1 2-6 .5-3 5h-2l1-5-7-.5Z',
  palette: 'M12 4a8 8 0 1 0 0 16h1.5a1.8 1.8 0 0 0 0-3.6 1.8 1.8 0 0 1 0-3.6H16a4 4 0 0 0 4-4C20 6 16.4 4 12 4ZM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01',
  chart: 'M5 19v-8M12 19V5M19 19v-6',
  leaf: 'M5 19c0-8 5-13 14-14 0 9-5 14-13 14ZM5 19l7-7',
  moon: 'M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z',
  help: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM9.8 9.5a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5v.4M12 16.5h.01',
  logout: 'M14 5H6v14h8M11 12h9M17 9l3 3-3 3',
  eye: 'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6ZM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  pin: 'M12 21s6-5.5 6-11a6 6 0 0 0-12 0c0 5.5 6 11 6 11ZM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  clock: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 8v4l3 2',
  tag: 'M4 4h7l9 9-7 7-9-9ZM8 8h.01',
  offline: 'M4 9a13 13 0 0 1 16 0M7 12.5a8 8 0 0 1 10 0M10 16a3.5 3.5 0 0 1 4 0M12 19.5h.01M4 4l16 16',
  layers: 'M12 4l8 4-8 4-8-4ZM4 12l8 4 8-4M4 16l8 4 8-4',
} as const;

export type IconName = keyof typeof PATHS;

type Props = { name: IconName; size?: number; color: string; strokeWidth?: number };

function IconBase({ name, size = 22, color, strokeWidth = 1.6 }: Props) {
  const dots = name === 'more';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d={PATHS[name]}
        stroke={color}
        strokeWidth={dots ? 3 : strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export const Icon = memo(IconBase);
