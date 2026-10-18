/**
 * Météo, secours : Open-Meteo. Sans clé. Données CC BY 4.0.
 * Attention : l'offre gratuite est réservée à un usage NON commercial
 * (moins de 10 000 appels par jour). Avant le lancement payant de l'app :
 * prendre l'offre commerciale d'Open-Meteo ou retirer cette source.
 * https://open-meteo.com/en/docs · https://open-meteo.com/en/terms
 */
import type { Meteo, Source } from '../types.ts';
import { getJson, exiger } from '../http.ts';
import { cielWmo } from '../ciel.ts';
import type { Lieu } from './metno.ts';

type Reponse = {
  current: { temperature_2m: number; apparent_temperature?: number; weather_code: number; wind_speed_10m?: number };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum?: (number | null)[];
    uv_index_max?: (number | null)[];
  };
};

export const URL_OPENMETEO = (l: Lieu) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${l.lat}&longitude=${l.lon}` +
  '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max' +
  '&timezone=Europe%2FParis&forecast_days=10';

export function lireOpenMeteo(r: Reponse): Meteo {
  const c = exiger(r?.current, 'current');
  const d = exiger(r?.daily, 'daily');
  const jours = exiger(d.time, 'daily.time').map((date, i) => {
    const n = cielWmo(exiger(d.weather_code?.[i], 'daily.weather_code'));
    const pluie = d.precipitation_sum?.[i];
    const uv = d.uv_index_max?.[i];
    return {
      date,
      max: Math.round(exiger(d.temperature_2m_max?.[i], 'daily.temperature_2m_max')),
      min: Math.round(exiger(d.temperature_2m_min?.[i], 'daily.temperature_2m_min')),
      ciel: n.ciel,
      libelle: n.mot,
      pluie: typeof pluie === 'number' ? Math.round(pluie * 10) / 10 : null,
      uv: typeof uv === 'number' ? Math.round(uv) : null,
    };
  });
  return {
    maintenant: {
      t: Math.round(exiger(c.temperature_2m, 'current.temperature_2m')),
      ressenti: typeof c.apparent_temperature === 'number' ? Math.round(c.apparent_temperature) : null,
      ciel: cielWmo(exiger(c.weather_code, 'current.weather_code')).ciel,
      vent: typeof c.wind_speed_10m === 'number' ? Math.round(c.wind_speed_10m) : null,
    },
    jours,
  };
}

export const openMeteo: Source<Lieu, Meteo> = {
  id: 'openmeteo',
  nom: 'Open-Meteo',
  mention: 'Météo : Open-Meteo.com (CC BY 4.0)',
  lire: async (l) => lireOpenMeteo(await getJson<Reponse>(URL_OPENMETEO(l))),
};
