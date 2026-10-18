/**
 * Vacances scolaires, secours : OpenHolidays API. Sans clé, gratuit.
 * On cherche la subdivision par le nom de l'académie (les 24 académies de
 * métropole portent les mêmes noms qu'à l'Éducation nationale), sinon par
 * celui du département ou de la collectivité.
 * https://www.openholidaysapi.org
 */
import type { Source, Vacances } from '../types.ts';
import { getJson, exiger } from '../http.ts';
import { plusJours } from '../temps.ts';
import type { ParamsVacances } from './education.ts';

type Noeud = { code: string; category?: { text: string }[]; name?: { text: string }[]; children?: Noeud[] };
type Reponse = { startDate: string; endDate: string; name: { language: string; text: string }[] }[];

export const URL_SUBDIVISIONS = 'https://openholidaysapi.org/Subdivisions?countryIsoCode=FR&languageIsoCode=FR';
export const urlOpenHolidays = (code: string, depuis: string) =>
  `https://openholidaysapi.org/SchoolHolidays?countryIsoCode=FR&subdivisionCode=${code}&languageIsoCode=FR&validFrom=${depuis}&validTo=${plusJours(depuis, 364)}`;

export function trouverSubdivision(arbre: Noeud[], p: ParamsVacances): string {
  const tous: Noeud[] = [];
  const marcher = (n: Noeud[]) => n.forEach((x) => (tous.push(x), x.children && marcher(x.children)));
  marcher(exiger(arbre, 'subdivisions'));
  const nom = (x: Noeud) => x.name?.[0]?.text ?? '';
  const cat = (x: Noeud) => x.category?.[0]?.text ?? '';
  const trouve =
    tous.find((x) => cat(x) === 'académie' && nom(x) === p.academie) ??
    tous.find((x) => cat(x) === 'département' && p.nomDepartement !== null && nom(x) === p.nomDepartement) ??
    tous.find((x) => nom(x).endsWith(p.academie));
  return exiger(trouve?.code, `subdivision pour ${p.academie}`);
}

export function lireOpenHolidays(r: Reponse): Vacances[] {
  if (!Array.isArray(r)) throw new Error('champ manquant : liste des vacances');
  return r.map((v) => ({
    nom: exiger(v.name?.find((n) => n.language === 'FR')?.text ?? v.name?.[0]?.text, 'name[].text'),
    debut: exiger(v.startDate, 'startDate'),
    fin: exiger(v.endDate, 'endDate'),
  }));
}

export const openHolidays: Source<ParamsVacances, Vacances[]> = {
  id: 'openholidays',
  nom: 'OpenHolidays',
  mention: 'Vacances scolaires : OpenHolidays API',
  lire: async (p) => {
    const code = trouverSubdivision(await getJson<Noeud[]>(URL_SUBDIVISIONS), p);
    return lireOpenHolidays(await getJson<Reponse>(urlOpenHolidays(code, p.depuis)));
  },
};
