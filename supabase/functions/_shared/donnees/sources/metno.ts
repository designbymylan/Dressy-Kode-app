/**
 * Météo, source principale : MET Norway (Institut météorologique norvégien).
 * Sans clé. Licence CC BY 4.0 : crédit obligatoire, usage commercial permis.
 * Conditions : s'identifier (User-Agent), ne pas dépasser 20 appels par
 * seconde, coordonnées à 4 décimales au plus (on en garde 2), respecter le
 * cache (on garde une heure).
 * https://api.met.no/weatherapi/locationforecast/2.0/documentation
 */
import type { Meteo, JourMeteo, Source } from '../types.ts';
import { getJson, exiger } from '../http.ts';
import { cielMet, resumeJour, type Nuance } from '../ciel.ts';
import { jourParis, heureParis } from '../temps.ts';

export type Lieu = { lat: number; lon: number };

type Pas = {
  time: string;
  data: {
    instant: { details: Record<string, number | undefined> };
    next_1_hours?: { summary: { symbol_code: string }; details?: { precipitation_amount?: number } };
    next_6_hours?: { summary: { symbol_code: string }; details?: { precipitation_amount?: number; air_temperature_max?: number; air_temperature_min?: number } };
  };
};
type Reponse = { properties: { timeseries: Pas[] } };

export const URL_METNO = (l: Lieu) => `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${l.lat}&lon=${l.lon}`;

const arrondi = (x: number) => Math.round(x);

export function lireMetno(r: Reponse): Meteo {
  const pas = exiger(r?.properties?.timeseries, 'properties.timeseries');
  const premier = exiger(pas[0], 'properties.timeseries[0]');
  const d0 = premier.data.instant.details;
  const symbole0 = exiger(premier.data.next_1_hours?.summary.symbol_code ?? premier.data.next_6_hours?.summary.symbol_code, 'next_1_hours.summary.symbol_code');

  const jours = new Map<string, { t: number[]; pluie: number; uv: number[]; heures: { h: number; n: Nuance }[] }>();
  for (const p of pas) {
    const jour = jourParis(p.time);
    const h = heureParis(p.time);
    const j = jours.get(jour) ?? { t: [], pluie: 0, uv: [], heures: [] };
    jours.set(jour, j);
    const det = p.data.instant.details;
    if (typeof det.air_temperature === 'number') j.t.push(det.air_temperature);
    if (typeof det.ultraviolet_index_clear_sky === 'number') j.uv.push(det.ultraviolet_index_clear_sky);
    const six = p.data.next_6_hours;
    if (six?.details) {
      if (typeof six.details.air_temperature_max === 'number') j.t.push(six.details.air_temperature_max);
      if (typeof six.details.air_temperature_min === 'number') j.t.push(six.details.air_temperature_min);
    }
    // Pluie : l'heure suivante tant qu'elle existe, sinon les six heures suivantes (plus loin, les pas sont de 6 h).
    const une = p.data.next_1_hours;
    if (une) j.pluie += une.details?.precipitation_amount ?? 0;
    else if (six) j.pluie += six.details?.precipitation_amount ?? 0;
    const code = une?.summary.symbol_code ?? six?.summary.symbol_code;
    if (code) j.heures.push({ h, n: cielMet(code) });
  }

  const liste: JourMeteo[] = [];
  for (const [date, j] of jours) {
    if (!j.t.length || !j.heures.length) continue;
    const jour = j.heures.filter((x) => x.h >= 8 && x.h <= 20);
    const { ciel, libelle } = resumeJour(jour.length ? jour : j.heures);
    liste.push({
      date,
      max: arrondi(Math.max(...j.t)),
      min: arrondi(Math.min(...j.t)),
      ciel,
      libelle,
      pluie: Math.round(j.pluie * 10) / 10,
      uv: j.uv.length ? Math.round(Math.max(...j.uv)) : null,
    });
  }

  return {
    maintenant: {
      t: arrondi(exiger(d0.air_temperature, 'instant.details.air_temperature')),
      ressenti: typeof d0.apparent_air_temperature === 'number' ? arrondi(d0.apparent_air_temperature) : null,
      ciel: cielMet(symbole0).ciel,
      vent: typeof d0.wind_speed === 'number' ? arrondi(d0.wind_speed * 3.6) : null,
    },
    jours: liste,
  };
}

export const metno: Source<Lieu, Meteo> = {
  id: 'metno',
  nom: 'MET Norway',
  mention: 'Météo : MET Norway (CC BY 4.0)',
  lire: async (l) => lireMetno(await getJson<Reponse>(URL_METNO(l))),
};
