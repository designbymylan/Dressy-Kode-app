/**
 * Lever et coucher du soleil, secours : sunrise-sunset.org. Sans clé,
 * gratuit ; ses conditions demandent un lien vers le site, d'où la mention.
 * https://sunrise-sunset.org/api
 */
import type { Soleil, Source } from '../types.ts';
import { getJson, exiger } from '../http.ts';
import { heureDe, type ParamsSoleil } from './metnoSoleil.ts';

type Reponse = { status: string; results: { sunrise: string; sunset: string } };

export const URL_SUNRISE = (p: ParamsSoleil) =>
  `https://api.sunrise-sunset.org/json?lat=${p.lat}&lng=${p.lon}&date=${p.jour}&formatted=0&tzid=Europe/Paris`;

export function lireSunrise(r: Reponse): Soleil {
  if (r?.status !== 'OK') throw new Error(`statut ${r?.status ?? 'absent'}`);
  return {
    lever: heureDe(exiger(r.results?.sunrise, 'results.sunrise')),
    coucher: heureDe(exiger(r.results?.sunset, 'results.sunset')),
  };
}

export const sunriseSunset: Source<ParamsSoleil, Soleil> = {
  id: 'sunrise-sunset',
  nom: 'sunrise-sunset.org',
  mention: 'Soleil : sunrise-sunset.org',
  lire: async (p) => lireSunrise(await getJson<Reponse>(URL_SUNRISE(p))),
};
