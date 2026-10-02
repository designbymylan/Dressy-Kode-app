/**
 * Lever et coucher du soleil, source principale : MET Norway (Sunrise 3.0).
 * Sans clé, CC BY 4.0, mêmes conditions que la météo MET Norway.
 * https://api.met.no/weatherapi/sunrise/3.0/documentation
 */
import type { Soleil, Source } from '../types.ts';
import { getJson, exiger } from '../http.ts';
import { PARIS } from '../temps.ts';

export type ParamsSoleil = { lat: number; lon: number; jour: string };

/** Le décalage horaire de Paris ce jour-là : « +02:00 » l'été, « +01:00 » l'hiver. */
export function decalageParis(jour: string): string {
  const nom = new Intl.DateTimeFormat('en-US', { timeZone: PARIS, timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${jour}T12:00:00Z`))
    .find((p) => p.type === 'timeZoneName')?.value;
  return nom?.replace('GMT', '') || '+01:00';
}

/** « 2026-10-01T07:49+02:00 » donne « 07:49 » (l'heure locale est déjà dans la chaîne). */
export const heureDe = (iso: string) => exiger(/T(\d{2}:\d{2})/.exec(iso)?.[1], 'heure dans ' + iso);

export const URL_METNO_SOLEIL = (p: ParamsSoleil) =>
  `https://api.met.no/weatherapi/sunrise/3.0/sun?lat=${p.lat}&lon=${p.lon}&date=${p.jour}&offset=${encodeURIComponent(decalageParis(p.jour))}`;

type Reponse = { properties: { sunrise?: { time: string }; sunset?: { time: string } } };

export function lireMetnoSoleil(r: Reponse): Soleil {
  return {
    lever: heureDe(exiger(r?.properties?.sunrise?.time, 'properties.sunrise.time')),
    coucher: heureDe(exiger(r?.properties?.sunset?.time, 'properties.sunset.time')),
  };
}

export const metnoSoleil: Source<ParamsSoleil, Soleil> = {
  id: 'metno-soleil',
  nom: 'MET Norway',
  mention: 'Soleil : MET Norway (CC BY 4.0)',
  lire: async (p) => lireMetnoSoleil(await getJson<Reponse>(URL_METNO_SOLEIL(p))),
};
