/**
 * Air, UV et pollens : Open-Meteo Air Quality (données Copernicus CAMS).
 * Sans clé. Mêmes conditions qu'Open-Meteo : gratuit pour un usage non
 * commercial seulement. Pas de source de secours gratuite vérifiée : si
 * elle tombe, la dernière valeur connue, puis rien (ce n'est qu'un conseil
 * en plus, l'app s'en passe).
 * https://open-meteo.com/en/docs/air-quality-api
 */
import type { Air, Source } from '../types.ts';
import { getJson, exiger } from '../http.ts';
import type { Lieu } from './metno.ts';

const POLLENS: [champ: string, nom: string][] = [
  ['grass_pollen', 'graminées'],
  ['birch_pollen', 'bouleau'],
  ['alder_pollen', 'aulne'],
  ['mugwort_pollen', 'armoise'],
  ['olive_pollen', 'olivier'],
  ['ragweed_pollen', 'ambroisie'],
];

type Reponse = { current: Record<string, number | null | string> };

export const URL_AIR = (l: Lieu) =>
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${l.lat}&longitude=${l.lon}` +
  `&current=european_aqi,uv_index,${POLLENS.map(([c]) => c).join(',')}&timezone=Europe%2FParis`;

/** Les seuils de l'indice européen (EEA) : 0-20 bon, 20-40 correct, 40-60 moyen, 60-80 mauvais, au-delà très mauvais. */
function qualite(i: number): Air['qualite'] {
  if (i <= 20) return 'bonne';
  if (i <= 40) return 'correcte';
  if (i <= 60) return 'moyenne';
  if (i <= 80) return 'mauvaise';
  return 'très mauvaise';
}

export function lireAir(r: Reponse): Air {
  const c = exiger(r?.current, 'current');
  if (!('european_aqi' in c)) throw new Error('champ manquant : current.european_aqi');
  const indice = typeof c.european_aqi === 'number' ? Math.round(c.european_aqi) : null;
  const uv = typeof c.uv_index === 'number' ? Math.round(c.uv_index) : null;
  const pollens = POLLENS.map(([champ, nom]) => ({ nom, grains: typeof c[champ] === 'number' ? Math.round(c[champ] as number) : 0 }))
    .filter((p) => p.grains > 0)
    .sort((a, b) => b.grains - a.grains);
  return { indice, qualite: indice === null ? null : qualite(indice), uv, pollens };
}

export const openMeteoAir: Source<Lieu, Air> = {
  id: 'openmeteo-air',
  nom: 'Open-Meteo',
  mention: 'Air et pollens : Open-Meteo.com, Copernicus CAMS (CC BY 4.0)',
  lire: async (l) => lireAir(await getJson<Reponse>(URL_AIR(l))),
};
