/**
 * Les icônes de Dresskode.
 *
 * Depuis le 21/10, elles sont pleines, comme sur le web (components/icons.tsx,
 * planche « Micro icons (solid) ») : formes épaisses, angles arrondis,
 * détails découpés en creux plutôt que dessinés au trait. Chacune a son
 * geste (`anim`), joué quand on appuie sur le bouton qui la porte (`Tap`).
 *
 * Les icônes sans version pleine gardent le jeu au trait du 02/10 (trait 1,6
 * sur une grille de 24, bouts ronds), avec son reflet chromé du 09/10 :
 * une icône noire, grise ou blanche est tracée d'un dégradé métal, une icône
 * de couleur garde sa couleur. `line` force le trait (onglets inactifs).
 * Aucune icône n'est reprise d'un jeu propriétaire.
 */
import { memo, useContext, useId, type ReactNode } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { PressContext } from './press';

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
  arrow: 'M4 12h15M13.5 6.5 19 12l-5.5 5.5',
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
  mail: 'M4 6.5h16v11H4ZM4.5 7l7.5 6 7.5-6',
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
  plane: 'M21 12c0 .9-.7 1.4-1.6 1.4H14l-4.2 6.6H7.6l2.6-6.6H5.6L3.9 16H2.4l1-4-1-4h1.5l1.7 2.6h4.6L7.6 4h2.2l4.2 6.6h5.4c.9 0 1.6.5 1.6 1.4Z',
  palette: 'M12 4a8 8 0 1 0 0 16h1.5a1.8 1.8 0 0 0 0-3.6 1.8 1.8 0 0 1 0-3.6H16a4 4 0 0 0 4-4C20 6 16.4 4 12 4ZM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01',
  chart: 'M5 19v-8M12 19V5M19 19v-6',
  leaf: 'M5 19c0-8 5-13 14-14 0 9-5 14-13 14ZM5 19l7-7',
  moon: 'M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z',
  alert: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 8v5M12 16.5h.01',
  help: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM9.8 9.5a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5v.4M12 16.5h.01',
  logout: 'M14 5H6v14h8M11 12h9M17 9l3 3-3 3',
  eye: 'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6ZM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  pin: 'M12 21s6-5.5 6-11a6 6 0 0 0-12 0c0 5.5 6 11 6 11ZM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  clock: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 8v4l3 2',
  tag: 'M4 4h7l9 9-7 7-9-9ZM8 8h.01',
  offline: 'M4 9a13 13 0 0 1 16 0M7 12.5a8 8 0 0 1 10 0M10 16a3.5 3.5 0 0 1 4 0M12 19.5h.01M4 4l16 16',
  layers: 'M12 4l8 4-8 4-8-4ZM4 12l8 4 8-4M4 16l8 4 8-4',
  gear: 'M10.21 4.82L10.66 2.49L13.34 2.49L13.79 4.82A7.4 7.4 0 0 1 15.81 5.66L17.78 4.33L19.67 6.22L18.34 8.19A7.4 7.4 0 0 1 19.18 10.21L21.51 10.66L21.51 13.34L19.18 13.79A7.4 7.4 0 0 1 18.34 15.81L19.67 17.78L17.78 19.67L15.81 18.34A7.4 7.4 0 0 1 13.79 19.18L13.34 21.51L10.66 21.51L10.21 19.18A7.4 7.4 0 0 1 8.19 18.34L6.22 19.67L4.33 17.78L5.66 15.81A7.4 7.4 0 0 1 4.82 13.79L2.49 13.34L2.49 10.66L4.82 10.21A7.4 7.4 0 0 1 5.66 8.19L4.33 6.22L6.22 4.33L8.19 5.66A7.4 7.4 0 0 1 10.21 4.82ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  bell: 'M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14ZM10 20.5a2 2 0 0 0 4 0',
  suitcase: 'M4 8h16v11H4ZM9 8V5.5h6V8M8 8v11M16 8v11',
  // Sans version au trait : la version pleine sert partout.
  crown: '',
  star: '',
  infinity: '',
  checkCircle: '',
  xCircle: '',
  party: '',
  shirt: '',
} as const;

export type IconName = keyof typeof PATHS;

/** Le geste d'une icône quand on appuie sur ce qui la porte (globals.css : `data-anim`). */
type Anim = 'lift' | 'swing' | 'tilt' | 'pop' | 'beat' | 'spin' | 'gear' | 'nudge' | 'back' | 'bell' | 'twinkle' | 'fly' | 'drop';

type Solid = { d?: string; evenodd?: boolean; node?: (color: string) => ReactNode; rotate?: number; anim: Anim };

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];
const CLOUD = 'M7.4 19.5a4.6 4.6 0 0 1-.9-9.1 6.2 6.2 0 0 1 11.8 1.4 3.9 3.9 0 0 1-.6 7.7Z';
const HANGER = 'M12 2.8a3.2 3.2 0 0 0-3.2 3.2 1.1 1.1 0 0 0 2.2 0 1 1 0 1 1 1.5.9c-.9.5-1.6 1.3-1.6 2.4v.4l-8 5.6A2 2 0 0 0 4 19h16a2 2 0 0 0 1.1-3.7l-8-5.6v-.4c0-.2.1-.4.5-.6A3.2 3.2 0 0 0 12 2.8ZM7.4 16.8h9.2L12 13.6Z';
const CHEVRON = 'M8.8 5.2a1.3 1.3 0 0 1 1.8 0l5.9 5.9a1.3 1.3 0 0 1 0 1.8l-5.9 5.9a1.3 1.3 0 0 1-1.8-1.8l5-5-5-5a1.3 1.3 0 0 1 0-1.8Z';
const ARROW_UP = 'M12 4c.4 0 .7.1 1 .4l5.6 5.6a1.4 1.4 0 0 1-2 2l-3.2-3.2v9.8a1.4 1.4 0 0 1-2.8 0V8.8L7.4 12a1.4 1.4 0 0 1-2-2L11 4.4c.3-.3.6-.4 1-.4Z';
const INFO = 'M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Zm0 4.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Zm0 4a1.1 1.1 0 0 0-1.1 1.1v4.5a1.1 1.1 0 0 0 2.2 0v-4.5c0-.6-.5-1.1-1.1-1.1Z';

/** Les versions pleines, reprises du web (mêmes tracés), et celles propres au mobile. */
const SOLID: Partial<Record<IconName, Solid>> = {
  home: { d: 'M10.6 3.2a2.2 2.2 0 0 1 2.8 0l6.9 5.8c.5.4.7 1 .7 1.6v8.4a2 2 0 0 1-2 2h-4.2v-4.5a2.8 2.8 0 0 0-5.6 0V21H5a2 2 0 0 1-2-2v-8.4c0-.6.3-1.2.7-1.6Z', anim: 'lift' },
  hanger: { d: HANGER, evenodd: true, anim: 'swing' },
  kode: { d: 'M12 2.5c.5 0 .9.3 1 .8l.8 3.2a5 5 0 0 0 3.7 3.7l3.2.8a1 1 0 0 1 0 2l-3.2.8a5 5 0 0 0-3.7 3.7l-.8 3.2a1 1 0 0 1-2 0l-.8-3.2a5 5 0 0 0-3.7-3.7l-3.2-.8a1 1 0 0 1 0-2l3.2-.8a5 5 0 0 0 3.7-3.7l.8-3.2c.1-.5.5-.8 1-.8Z', anim: 'twinkle' },
  calendar: { d: 'M7 2.6c.6 0 1.1.5 1.1 1.1V4h7.8v-.3a1.1 1.1 0 1 1 2.2 0V4h.4A2.5 2.5 0 0 1 21 6.5v12a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-12A2.5 2.5 0 0 1 5.5 4h.4v-.3c0-.6.5-1.1 1.1-1.1ZM6.6 11.2h2.8V14H6.6Zm4 0h2.8V14h-2.8Zm4 0h2.8V14h-2.8Zm-8 4h2.8V18H6.6Zm4 0h2.8V18h-2.8Z', evenodd: true, anim: 'lift' },
  person: { d: 'M12 3a4.2 4.2 0 1 1 0 8.4A4.2 4.2 0 0 1 12 3Zm0 10c4.6 0 8.3 2.4 8.3 5.8 0 1.2-.9 2.2-2.1 2.2H5.8a2.1 2.1 0 0 1-2.1-2.2C3.7 15.4 7.4 13 12 13Z', anim: 'lift' },
  search: { d: 'M10.8 3a7.8 7.8 0 0 1 6.2 12.5l3.6 3.6a1.4 1.4 0 0 1-2 2l-3.6-3.6A7.8 7.8 0 1 1 10.8 3Zm0 2.7a5.1 5.1 0 1 0 0 10.2 5.1 5.1 0 0 0 0-10.2Z', evenodd: true, anim: 'tilt' },
  plus: { d: 'M12 4.4c.8 0 1.4.6 1.4 1.4v4.8h4.8a1.4 1.4 0 0 1 0 2.8h-4.8v4.8a1.4 1.4 0 0 1-2.8 0v-4.8H5.8a1.4 1.4 0 0 1 0-2.8h4.8V5.8c0-.8.6-1.4 1.4-1.4Z', anim: 'spin' },
  minus: { d: 'M5.8 10.6h12.4a1.4 1.4 0 0 1 0 2.8H5.8a1.4 1.4 0 0 1 0-2.8Z', anim: 'pop' },
  filter: { d: 'M4 6.2h7.1a2.9 2.9 0 0 1 5.6 0H20a1.2 1.2 0 0 1 0 2.4h-3.3a2.9 2.9 0 0 1-5.6 0H4a1.2 1.2 0 0 1 0-2.4Zm0 9.2h1.9a2.9 2.9 0 0 1 5.6 0H20a1.2 1.2 0 0 1 0 2.4h-8.5a2.9 2.9 0 0 1-5.6 0H4a1.2 1.2 0 0 1 0-2.4Z', anim: 'tilt' },
  sliders: { d: 'M4 6.2h7.1a2.9 2.9 0 0 1 5.6 0H20a1.2 1.2 0 0 1 0 2.4h-3.3a2.9 2.9 0 0 1-5.6 0H4a1.2 1.2 0 0 1 0-2.4Zm0 9.2h1.9a2.9 2.9 0 0 1 5.6 0H20a1.2 1.2 0 0 1 0 2.4h-8.5a2.9 2.9 0 0 1-5.6 0H4a1.2 1.2 0 0 1 0-2.4Z', anim: 'tilt' },
  back: { d: 'M15.2 5.2a1.3 1.3 0 0 1 0 1.8l-5 5 5 5a1.3 1.3 0 1 1-1.8 1.8l-5.9-5.9a1.3 1.3 0 0 1 0-1.8l5.9-5.9a1.3 1.3 0 0 1 1.8 0Z', anim: 'back' },
  chevron: { d: CHEVRON, anim: 'nudge' },
  up: { d: CHEVRON, rotate: -90, anim: 'lift' },
  down: { d: CHEVRON, rotate: 90, anim: 'drop' },
  arrow: { d: ARROW_UP, rotate: 90, anim: 'nudge' },
  send: { d: ARROW_UP, anim: 'lift' },
  close: { d: 'M6.3 6.3a1.3 1.3 0 0 1 1.8 0L12 10.2l3.9-3.9a1.3 1.3 0 1 1 1.8 1.8L13.8 12l3.9 3.9a1.3 1.3 0 0 1-1.8 1.8L12 13.8l-3.9 3.9a1.3 1.3 0 0 1-1.8-1.8l3.9-3.9-3.9-3.9a1.3 1.3 0 0 1 0-1.8Z', anim: 'spin' },
  check: { d: 'M20 6.2a1.3 1.3 0 0 1 0 1.9l-9.8 9.8a1.3 1.3 0 0 1-1.9 0L4 13.6a1.3 1.3 0 1 1 1.9-1.9l3.4 3.4 8.9-8.9a1.3 1.3 0 0 1 1.8 0Z', anim: 'pop' },
  checkCircle: { d: 'M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Zm4.2 6.3a1.1 1.1 0 0 0-1.6 0l-3.9 4-1.5-1.5a1.1 1.1 0 1 0-1.6 1.6l2.3 2.3a1.1 1.1 0 0 0 1.6 0l4.7-4.8a1.1 1.1 0 0 0 0-1.6Z', evenodd: true, anim: 'pop' },
  xCircle: { d: 'M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19ZM9.4 8.1a1 1 0 0 0-1.3 1.3l2.6 2.6-2.6 2.6a1 1 0 1 0 1.3 1.3l2.6-2.6 2.6 2.6a1 1 0 0 0 1.3-1.3L13.3 12l2.6-2.6a1 1 0 0 0-1.3-1.3L12 10.7Z', evenodd: true, anim: 'pop' },
  more: {
    node: (c) => (
      <>
        <Circle cx="5.5" cy="12" r="2.2" fill={c} />
        <Circle cx="12" cy="12" r="2.2" fill={c} />
        <Circle cx="18.5" cy="12" r="2.2" fill={c} />
      </>
    ),
    anim: 'pop',
  },
  sun: {
    node: (c) => (
      <>
        <Circle cx="12" cy="12" r="4.6" fill={c} />
        {RAYS.map((a) => (
          <Rect key={a} x="10.9" y="1.6" width="2.2" height="3.6" rx="1.1" fill={c} transform={`rotate(${a} 12 12)`} />
        ))}
      </>
    ),
    anim: 'spin',
  },
  cloud: { d: CLOUD, anim: 'lift' },
  rain: {
    node: (c) => (
      <>
        <Path d={CLOUD} fill={c} transform="translate(0 -3.2)" />
        {[8, 12, 16].map((x) => (
          <Rect key={x} x={x - 1} y="17.6" width="2" height="4" rx="1" fill={c} transform={`rotate(18 ${x} 19.6)`} />
        ))}
      </>
    ),
    anim: 'drop',
  },
  showers: {
    node: (c) => (
      <>
        <Circle cx="8.2" cy="7.6" r="3.6" fill={c} />
        <Path d={CLOUD} fill={c} transform="translate(2.4 1.6) scale(0.86)" />
      </>
    ),
    anim: 'lift',
  },
  grid: { d: 'M5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5v-4A1.5 1.5 0 0 1 5.5 4Zm9 0h4A1.5 1.5 0 0 1 20 5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 13 9.5v-4A1.5 1.5 0 0 1 14.5 4Zm-9 9h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5v-4A1.5 1.5 0 0 1 5.5 13Zm9 0h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5Z', anim: 'pop' },
  rails: {
    node: (c) => (
      <>
        <Rect x="2.5" y="3.4" width="19" height="2.4" rx="1.2" fill={c} />
        <Path d={HANGER} fillRule="evenodd" clipRule="evenodd" fill={c} transform="translate(-0.6 3.6) scale(0.62)" />
        <Path d={HANGER} fillRule="evenodd" clipRule="evenodd" fill={c} transform="translate(9.6 3.6) scale(0.62)" />
      </>
    ),
    anim: 'swing',
  },
  camera: { d: 'M8.6 4.5a1.5 1.5 0 0 1 1.3-.8h4.2c.6 0 1.1.3 1.3.8l.8 1.5h2.3A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-9A2.5 2.5 0 0 1 5.5 6h2.3Zm3.4 4.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z', evenodd: true, anim: 'pop' },
  image: { d: 'M5.5 3.5h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Zm10 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM6 18h12.2a.6.6 0 0 0 .5-1l-3.6-4.6a.9.9 0 0 0-1.4 0l-2 2.4-1.6-1.9a.9.9 0 0 0-1.4 0L5.5 17a.6.6 0 0 0 .5 1Z', evenodd: true, anim: 'lift' },
  mail: { d: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm1.6 3.3a1 1 0 0 0-1.2 1.6l5.8 4.4a1.4 1.4 0 0 0 1.6 0l5.8-4.4a1 1 0 1 0-1.2-1.6L12 12.4Z', evenodd: true, anim: 'fly' },
  trash: { d: 'M9.5 2.8h5A1.5 1.5 0 0 1 16 4.3V5h3.8a1.2 1.2 0 0 1 0 2.4H4.2a1.2 1.2 0 0 1 0-2.4H8v-.7a1.5 1.5 0 0 1 1.5-1.5ZM5.4 8.8h13.2l-.8 10.4a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8Z', anim: 'tilt' },
  edit: { d: 'M16.3 3.4a2.3 2.3 0 0 1 3.3 0l1 1a2.3 2.3 0 0 1 0 3.3L9.3 19a2 2 0 0 1-1 .5l-3.7.9a1 1 0 0 1-1.2-1.2l.9-3.7c.1-.4.3-.7.5-1Z', anim: 'tilt' },
  bag: { d: 'M8 7V6a4 4 0 1 1 8 0v1h1.6a1.5 1.5 0 0 1 1.5 1.4l.8 11a1.5 1.5 0 0 1-1.5 1.6H5.6a1.5 1.5 0 0 1-1.5-1.6l.8-11A1.5 1.5 0 0 1 6.4 7Zm2 0h4V6a2 2 0 1 0-4 0Z', evenodd: true, anim: 'swing' },
  ruler: { d: 'M3.5 8.5h17A1.5 1.5 0 0 1 22 10v4a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 14v-4a1.5 1.5 0 0 1 1.5-1.5ZM6 8.5v3.2h1.3V8.5Zm3.6 0v2.2h1.3V8.5Zm3.6 0v3.2h1.3V8.5Zm3.6 0v2.2h1.3V8.5Z', evenodd: true, rotate: -45, anim: 'tilt' },
  refresh: { d: 'M12 4a8 8 0 0 1 7.2 4.5V6.8a1.2 1.2 0 0 1 2.4 0v4.6c0 .7-.5 1.2-1.2 1.2h-4.6a1.2 1.2 0 0 1 0-2.4h1.8A5.6 5.6 0 1 0 17.4 14a1.2 1.2 0 0 1 2.3.7A8 8 0 1 1 12 4Z', anim: 'spin' },
  gift: { d: 'M12 8c-1.8-3.4-5.6-4.2-5.6-1.8 0 1.4 2.6 1.8 5.6 1.8Zm0 0c1.8-3.4 5.6-4.2 5.6-1.8 0 1.4-2.6 1.8-5.6 1.8ZM4 8.6h7.2v3.9H4a1 1 0 0 1-1-1V9.6a1 1 0 0 1 1-1Zm8.8 0H20a1 1 0 0 1 1 1v1.9a1 1 0 0 1-1 1h-7.2ZM4.6 13.6h6.6V21H6.1a1.5 1.5 0 0 1-1.5-1.5Zm8.2 0h6.6v5.9a1.5 1.5 0 0 1-1.5 1.5h-5.1Z', anim: 'pop' },
  heart: { d: 'M12 20.6c-.3 0-.6-.1-.8-.3C8.3 18 3 14.2 3 9.2a5 5 0 0 1 5-5c1.6 0 3 .8 4 2 1-1.2 2.4-2 4-2a5 5 0 0 1 5 5c0 5-5.3 8.8-8.2 11.1-.2.2-.5.3-.8.3Z', anim: 'beat' },
  lock: { d: 'M12 2.5A4.5 4.5 0 0 1 16.5 7v2h.5a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 21H7a2.5 2.5 0 0 1-2.5-2.5v-7A2.5 2.5 0 0 1 7 9h.5V7A4.5 4.5 0 0 1 12 2.5Zm0 2.3A2.2 2.2 0 0 0 9.8 7v2h4.4V7A2.2 2.2 0 0 0 12 4.8Z', evenodd: true, anim: 'pop' },
  plane: { d: 'M21 12c0 .9-.7 1.4-1.6 1.4H14l-4.2 6.6H7.6l2.6-6.6H5.6L3.9 16H2.4l1-4-1-4h1.5l1.7 2.6h4.6L7.6 4h2.2l4.2 6.6h5.4c.9 0 1.6.5 1.6 1.4Z', anim: 'fly' },
  palette: { d: 'M12 3a9 9 0 0 0 0 18c1.2 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 22 9.7C22 5.9 17.5 3 12 3Zm-5 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z', evenodd: true, anim: 'tilt' },
  chart: { d: 'M5.5 12h2A1.5 1.5 0 0 1 9 13.5v5A1.5 1.5 0 0 1 7.5 20h-2A1.5 1.5 0 0 1 4 18.5v-5A1.5 1.5 0 0 1 5.5 12Zm5.5-8h2a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 13 20h-2a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 11 4Zm5.5 4h2A1.5 1.5 0 0 1 20 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 16.5 8Z', anim: 'lift' },
  leaf: { d: 'M20.5 3.5c.3 0 .5.2.5.5 0 9.3-5.5 15-13 15H6.6c-.4 1-.7 1.7-.8 2.1a1 1 0 0 1-1.9-.6c1.2-4 3.7-7.2 7.7-9.3a.8.8 0 1 0-.8-1.4c-2.6 1.4-4.6 3.2-6 5.3C5 8.6 10.9 3.5 20.5 3.5Z', anim: 'swing' },
  moon: { d: 'M20.3 14.4a.9.9 0 0 0-1.1-.7A7.6 7.6 0 0 1 10.3 4.8a.9.9 0 0 0-1.2-1A9 9 0 1 0 20.3 15a1 1 0 0 0 0-.6Z', anim: 'swing' },
  // Le « i » de l'information, retourné : un point d'exclamation.
  alert: { d: INFO, evenodd: true, rotate: 180, anim: 'pop' },
  logout: { d: 'M5.5 3h7A1.5 1.5 0 0 1 14 4.5V10h-3.5a2 2 0 0 0 0 4H14v5.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3Zm11.1 5.1a1 1 0 0 1 1.1.2l3.3 3a1 1 0 0 1 0 1.4l-3.3 3a1 1 0 0 1-1.7-.7V14h-5.5a2 2 0 0 1 0-4H16V9c0-.4.2-.7.6-.9Z', anim: 'nudge' },
  eye: { d: 'M12 5c5 0 8.6 3.6 9.8 6.1.3.6.3 1.2 0 1.8C20.6 15.4 17 19 12 19s-8.6-3.6-9.8-6.1a2 2 0 0 1 0-1.8C3.4 8.6 7 5 12 5Zm0 3.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z', evenodd: true, anim: 'pop' },
  pin: { d: 'M12 2.5a7.5 7.5 0 0 1 7.5 7.5c0 5.4-5.6 10.3-6.8 11.3a1.1 1.1 0 0 1-1.4 0C10.1 20.3 4.5 15.4 4.5 10A7.5 7.5 0 0 1 12 2.5Zm0 4.7a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z', evenodd: true, anim: 'lift' },
  clock: { d: 'M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Zm0 4.3c-.6 0-1.1.5-1.1 1.1V12c0 .3.1.6.3.8l2.8 2.8a1.1 1.1 0 0 0 1.6-1.6l-2.5-2.5V7.9c0-.6-.5-1.1-1.1-1.1Z', evenodd: true, anim: 'gear' },
  tag: { d: 'M3 4.5A1.5 1.5 0 0 1 4.5 3h6.3c.4 0 .8.2 1.1.4l8.6 8.6a1.5 1.5 0 0 1 0 2.2l-6.3 6.3a1.5 1.5 0 0 1-2.2 0l-8.6-8.6a1.5 1.5 0 0 1-.4-1.1Zm4.5 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z', evenodd: true, anim: 'tilt' },
  layers: { d: 'M11.3 3.2a1.6 1.6 0 0 1 1.4 0l7.8 3.9a1 1 0 0 1 0 1.8l-7.8 3.9a1.6 1.6 0 0 1-1.4 0L3.5 8.9a1 1 0 0 1 0-1.8Zm-7 9.4 7 3.5a1.6 1.6 0 0 0 1.4 0l7-3.5.8.4a1 1 0 0 1 0 1.8l-7.8 3.9a1.6 1.6 0 0 1-1.4 0l-7.8-3.9a1 1 0 0 1 0-1.8Z', anim: 'lift' },
  gear: {
    node: (c) => (
      <Path
        fillRule="evenodd"
        fill={c}
        stroke={c}
        strokeWidth={1.4}
        strokeLinejoin="round"
        d="M9.19 4.83 10.65 4.42 10.59 2.6 13.41 2.6 13.35 4.42 14.81 4.83 15.09 4.95 16.4 5.68 17.7 4.4 19.6 6.3 18.32 7.6 19.05 8.91 19.17 9.19 19.58 10.65 21.4 10.59 21.4 13.41 19.58 13.35 19.17 14.81 19.05 15.09 18.32 16.4 19.6 17.7 17.7 19.6 16.4 18.32 15.09 19.05 14.81 19.17 13.35 19.58 13.41 21.4 10.59 21.4 10.65 19.58 9.19 19.17 8.91 19.05 7.6 18.32 6.3 19.6 4.4 17.7 5.68 16.4 4.95 15.09 4.83 14.81 4.42 13.35 2.6 13.41 2.6 10.59 4.42 10.65 4.83 9.19 4.95 8.91 5.68 7.6 4.4 6.3 6.3 4.4 7.6 5.68 8.91 4.95ZM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z"
      />
    ),
    anim: 'gear',
  },
  bell: { d: 'M12 2.6a6.4 6.4 0 0 0-6.4 6.4v3.5l-1.4 2.7A1.5 1.5 0 0 0 5.5 17.4h13a1.5 1.5 0 0 0 1.3-2.2l-1.4-2.7V9A6.4 6.4 0 0 0 12 2.6Zm-2.7 16.2h5.4a2.7 2.7 0 0 1-5.4 0Z', anim: 'bell' },
  suitcase: { d: 'M9 3.5h6A1.5 1.5 0 0 1 16.5 5v1.5h2A2.5 2.5 0 0 1 21 9v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18V9a2.5 2.5 0 0 1 2.5-2.5h2V5A1.5 1.5 0 0 1 9 3.5Zm.7 3h4.6V5.7H9.7Z', evenodd: true, anim: 'lift' },
  crown: { d: 'M3.6 7.4a1 1 0 0 1 1.6-.6l3.3 2.7 2.6-4.6a1 1 0 0 1 1.8 0l2.6 4.6 3.3-2.7a1 1 0 0 1 1.6.6l-1.5 9.4a1.5 1.5 0 0 1-1.5 1.2H6.6a1.5 1.5 0 0 1-1.5-1.2Z', anim: 'pop' },
  star: { d: 'M12 2.9c.4 0 .8.2 1 .6l2.2 4.6 5 .7c.9.1 1.3 1.2.6 1.9l-3.6 3.5.9 5c.1.9-.8 1.6-1.6 1.2L12 18l-4.5 2.4c-.8.4-1.8-.3-1.6-1.2l.9-5-3.6-3.5c-.7-.7-.3-1.8.6-1.9l5-.7L11 3.5c.2-.4.6-.6 1-.6Z', anim: 'pop' },
  infinity: { d: 'M7 7.5c1.9 0 3.4 1.2 5 3 1.6-1.8 3.1-3 5-3a4.5 4.5 0 0 1 0 9c-1.9 0-3.4-1.2-5-3-1.6 1.8-3.1 3-5 3a4.5 4.5 0 0 1 0-9Zm0 2.5a2 2 0 1 0 0 4c1 0 2-.7 3.3-2-1.3-1.3-2.3-2-3.3-2Zm10 0c-1 0-2 .7-3.3 2 1.3 1.3 2.3 2 3.3 2a2 2 0 1 0 0-4Z', evenodd: true, anim: 'pop' },
  party: {
    node: (c) => (
      <>
        <Path d="M8.6 7.4a1 1 0 0 1 1.6-.3l6.7 6.7a1 1 0 0 1-.3 1.6L4.4 21a1.1 1.1 0 0 1-1.4-1.4Z" fill={c} />
        <Circle cx="14.8" cy="4.2" r="1.4" fill={c} />
        <Circle cx="19.8" cy="9.2" r="1.4" fill={c} />
        <Path d="M17.8 3.2a1 1 0 0 1 1.4 1.4l-1.4 1.4a1 1 0 0 1-1.4-1.4Z" fill={c} />
      </>
    ),
    anim: 'twinkle',
  },
  shirt: { d: 'M8.4 3.2a1 1 0 0 1 .9-.1 3 3 0 0 0 5.4 0 1 1 0 0 1 .9.1l5.6 2.9a1 1 0 0 1 .4 1.3l-1.6 3.3a1 1 0 0 1-1.3.5l-1.2-.6v8.9a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5v-8.9l-1.2.6a1 1 0 0 1-1.3-.5L2.4 7.4a1 1 0 0 1 .4-1.3Z', anim: 'swing' },
};

/**
 * Les versions au trait des quatre onglets (web : NAV_LINES) : la barre de
 * la référence montre l'onglet inactif au trait et l'actif en plein.
 */
export const NAV_LINES: Partial<Record<IconName, string>> = {
  home: 'M4 10.4 12 3.8l8 6.6V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1ZM10 20v-4.2a2 2 0 0 1 4 0V20',
  hanger: 'M12 9.4v-.9c0-.8.6-1.3 1.2-1.7A2 2 0 1 0 10 5.2M12 9.4l-8 5.6a1.2 1.2 0 0 0 .7 2.2h14.6a1.2 1.2 0 0 0 .7-2.2Z',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5ZM4 10h16M8 3v4M16 3v4',
  person: 'M12 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7ZM5 20c0-3.2 3.1-5.3 7-5.3s7 2.1 7 5.3',
};

/** Une icône a-t-elle sa version pleine ? */
export const hasSolid = (name: IconName) => !!SOLID[name];

type Props = {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  /** Couleur pleine, sans reflet chromé (icônes au trait). */
  flat?: boolean;
  /** Le trait, même quand la version pleine existe. */
  line?: boolean;
  /** Pas de geste à l'appui (barre d'onglets, qui a le sien). */
  still?: boolean;
};

const rgb = (color: string): [number, number, number] | null => {
  const h = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(h)) return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  if (/^#[0-9a-f]{3}$/i.test(h)) return [parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), parseInt(h[3] + h[3], 16)];
  return null;
};
const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
const mix = ([r, g, b]: [number, number, number], to: number, t: number) => `#${hex(r + (to - r) * t)}${hex(g + (to - g) * t)}${hex(b + (to - b) * t)}`;

/**
 * Les cinq arrêts du reflet : sombre, gris, éclat, gris, sombre (ou l'inverse
 * pour une icône claire). `null` pour une couleur qui n'est pas un gris.
 */
export function chromeStops(color: string): string[] | null {
  const c = rgb(color);
  if (!c || Math.max(...c) - Math.min(...c) > 24) return null;
  const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  return lum < 0.5 ? [0.04, 0.42, 0.72, 0.38, 0.08].map((t) => mix(c, 255, t)) : [0.02, 0.38, 0, 0.42, 0.12].map((t) => mix(c, 0, t));
}

const OFFSETS = ['0', '0.38', '0.52', '0.68', '1'];

function LineIcon({ name, size, color, strokeWidth, flat }: Required<Pick<Props, 'name' | 'size' | 'color' | 'strokeWidth'>> & { flat?: boolean }) {
  const dots = name === 'more';
  // Un identifiant par icône : sur le web, les dégradés partagent la même page.
  const id = `chrome${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const stops = flat ? null : chromeStops(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      {stops && (
        <Defs>
          {/* Sur la grille de 24 et non sur la forme : un trait droit (moins, points) garde son reflet. */}
          <LinearGradient id={id} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            {stops.map((c, i) => (
              <Stop key={i} offset={OFFSETS[i]} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
      )}
      <Path
        d={PATHS[name]}
        stroke={stops ? `url(#${id})` : color}
        strokeWidth={dots ? 3 : strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function SolidIcon({ glyph, size, color }: { glyph: Solid; size: number; color: string }) {
  const shape = glyph.node ? glyph.node(color) : <Path d={glyph.d} fill={color} fillRule={glyph.evenodd ? 'evenodd' : undefined} clipRule={glyph.evenodd ? 'evenodd' : undefined} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {glyph.rotate ? <G transform={`rotate(${glyph.rotate} 12 12)`}>{shape}</G> : shape}
    </Svg>
  );
}

/** Le geste de l'icône, piloté par l'appui du bouton qui la porte (0 au repos, 1 enfoncé). */
function Gesture({ anim, pressed, children }: { anim: Anim; pressed: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => {
    const p = pressed.value;
    switch (anim) {
      case 'lift':
        return { transform: [{ translateY: -2 * p }] };
      case 'drop':
        return { transform: [{ translateY: 2 * p }] };
      case 'nudge':
        return { transform: [{ translateX: 3 * p }] };
      case 'back':
        return { transform: [{ translateX: -3 * p }] };
      case 'fly':
        return { transform: [{ translateX: 3 * p }, { translateY: -3 * p }] };
      case 'pop':
      case 'beat':
        return { transform: [{ scale: 1 + 0.2 * p }] };
      case 'twinkle':
        return { transform: [{ scale: 1 + 0.2 * p }, { rotate: `${18 * p}deg` }] };
      case 'spin':
        return { transform: [{ rotate: `${90 * p}deg` }] };
      case 'gear':
        return { transform: [{ rotate: `${60 * p}deg` }] };
      case 'tilt':
      case 'bell':
        return { transform: [{ rotate: `${-14 * p}deg` }] };
      case 'swing':
        return { transform: [{ rotate: `${-18 * p}deg` }] };
    }
  });
  return <Animated.View style={[anim === 'bell' && { transformOrigin: '50% 10%' }, style]}>{children}</Animated.View>;
}

function IconBase({ name, size = 22, color, strokeWidth = 1.6, flat, line, still }: Props) {
  const pressed = useContext(PressContext);
  const reduced = useReducedMotion();
  // Le trait est demandé mais n'existe pas (couronne, infini…) : la version pleine le remplace.
  const glyph = line && PATHS[name] ? undefined : SOLID[name];
  if (!glyph) return <LineIcon name={name} size={size} color={color} strokeWidth={strokeWidth} flat={flat} />;
  const icon = <SolidIcon glyph={glyph} size={size} color={color} />;
  if (!pressed || still || reduced) return icon;
  return (
    <Gesture anim={glyph.anim} pressed={pressed}>
      {icon}
    </Gesture>
  );
}

export const Icon = memo(IconBase);
