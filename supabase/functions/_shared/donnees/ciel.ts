/**
 * Le ciel des différentes sources ramené à sept mots, et une courte
 * phrase pour la journée (« averses l'après-midi »).
 */
import type { Ciel } from './types.ts';

export type Nuance = { ciel: Ciel; mot: string };

/**
 * Codes de MET Norway (légende : github.com/metno/weathericons, weather/legend.csv).
 * On lit le code par ses mots plutôt que par une liste : la légende contient
 * des coquilles (« lightssleetshowersandthunder ») qui passent ainsi sans souci.
 */
export function cielMet(code: string): Nuance {
  const c = code.trim().replace(/_(day|night|polartwilight)$/, '');
  if (c.includes('thunder')) return { ciel: 'orage', mot: 'orages' };
  if (c.includes('snow')) return { ciel: 'neige', mot: c.includes('showers') ? 'averses de neige' : 'neige' };
  if (c.includes('sleet')) return { ciel: 'neige', mot: 'neige fondue' };
  if (c.includes('rainshowers')) return { ciel: 'averses', mot: 'averses' };
  if (c.includes('rain')) return { ciel: 'pluie', mot: c.startsWith('light') ? 'pluie fine' : 'pluie' };
  if (c === 'fog') return { ciel: 'brouillard', mot: 'brouillard' };
  if (c === 'clearsky') return { ciel: 'soleil', mot: 'ensoleillé' };
  if (c === 'fair') return { ciel: 'soleil', mot: 'beau temps' };
  if (c === 'partlycloudy') return { ciel: 'nuages', mot: 'éclaircies' };
  return { ciel: 'nuages', mot: 'couvert' };
}

/** Codes WMO d'Open-Meteo (documentation de l'API, variable weather_code). */
export function cielWmo(code: number): Nuance {
  if (code === 0) return { ciel: 'soleil', mot: 'ensoleillé' };
  if (code === 1) return { ciel: 'soleil', mot: 'beau temps' };
  if (code === 2) return { ciel: 'nuages', mot: 'éclaircies' };
  if (code === 3) return { ciel: 'nuages', mot: 'couvert' };
  if (code === 45 || code === 48) return { ciel: 'brouillard', mot: 'brouillard' };
  if (code >= 51 && code <= 57) return { ciel: 'pluie', mot: 'pluie fine' };
  if (code >= 61 && code <= 67) return { ciel: 'pluie', mot: 'pluie' };
  if (code >= 71 && code <= 77) return { ciel: 'neige', mot: 'neige' };
  if (code >= 80 && code <= 82) return { ciel: 'averses', mot: 'averses' };
  if (code === 85 || code === 86) return { ciel: 'neige', mot: 'averses de neige' };
  if (code >= 95) return { ciel: 'orage', mot: 'orages' };
  return { ciel: 'nuages', mot: 'couvert' };
}

const MOUILLE: Ciel[] = ['orage', 'neige', 'pluie', 'averses'];

/** Le moment d'une heure de la journée, pour la phrase du jour. */
function moment(h: number): string {
  if (h < 12) return 'le matin';
  if (h < 14) return 'vers midi';
  if (h < 18) return 'l’après-midi';
  return 'le soir';
}

/**
 * Résume une journée vue heure par heure : le ciel qui compte pour
 * s'habiller (une averse l'emporte sur le soleil), et quand.
 */
export function resumeJour(heures: { h: number; n: Nuance }[]): { ciel: Ciel; libelle: string } {
  for (const ciel of MOUILLE) {
    const mouille = heures.filter((x) => x.n.ciel === ciel);
    if (!mouille.length) continue;
    const tout = mouille.length >= heures.length * 0.6;
    return { ciel, libelle: tout ? mouille[0].n.mot : `${mouille[0].n.mot} ${moment(mouille[0].h)}` };
  }
  const compte = new Map<string, { n: Nuance; k: number }>();
  for (const { n } of heures) {
    const c = compte.get(n.mot) ?? { n, k: 0 };
    c.k++;
    compte.set(n.mot, c);
  }
  const top = [...compte.values()].sort((a, b) => b.k - a.k)[0]?.n ?? { ciel: 'nuages', mot: 'couvert' };
  return { ciel: top.ciel, libelle: top.mot };
}
