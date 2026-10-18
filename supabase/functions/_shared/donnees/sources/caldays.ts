/**
 * Jours fériés, second secours : caldays.com. Sans clé, CC BY 4.0.
 * Testé le 2 octobre 2026 : ne donne que l'année en cours (le paramètre
 * d'année est ignoré) et les jours nationaux seulement.
 * Son calcul des week-ends prolongés sert de témoin dans les tests pour
 * vérifier le nôtre (ponts.ts).
 * https://caldays.com
 */
import type { Ferie, Pont, Source } from '../types.ts';
import { getJson, exiger } from '../http.ts';
import type { ParamsFeries } from './feriesGouv.ts';

export const URL_CALDAYS = 'https://caldays.com/api/holidays/fr';
export const URL_CALDAYS_PONTS = 'https://caldays.com/api/long-weekends/fr';

type Reponse = { year: number; holidays: { date: string; name: string }[] };
type ReponsePonts = { longWeekends: { start: string; end: string; days: number; bridgeDays: number; holidays: { date: string; name: string }[] }[] };

export function lireCaldays(r: Reponse): Ferie[] {
  const h = exiger(r?.holidays, 'holidays');
  if (!h.length) throw new Error('champ manquant : holidays vide');
  return h.map((x) => ({ date: exiger(x.date, 'holidays[].date'), nom: exiger(x.name, 'holidays[].name') }));
}

export function lirePontsCaldays(r: ReponsePonts): Pont[] {
  return exiger(r?.longWeekends, 'longWeekends').map((w) => ({
    debut: w.start,
    fin: w.end,
    jours: w.days,
    aPoser: w.bridgeDays,
    feries: w.holidays.map((h) => h.name),
  }));
}

export const caldays: Source<ParamsFeries, Ferie[]> = {
  id: 'caldays',
  nom: 'caldays.com',
  mention: 'Jours fériés : caldays.com (CC BY 4.0)',
  lire: async () => lireCaldays(await getJson<Reponse>(URL_CALDAYS)),
};

export const pontsCaldays = async () => lirePontsCaldays(await getJson<ReponsePonts>(URL_CALDAYS_PONTS));
