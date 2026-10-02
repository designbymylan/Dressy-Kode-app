/**
 * Ville vers coordonnées, secours : Nominatim (OpenStreetMap). Sans clé.
 * Données ODbL : crédit « © les contributeurs d'OpenStreetMap ».
 * Règles d'usage : 1 appel par seconde au plus, s'identifier, garder les
 * résultats en cache (on les garde 30 jours). Pas pour un usage intensif.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
import type { Source, Ville } from '../types.ts';
import { getJson, exiger } from '../http.ts';

type Reponse = { lat: string; lon: string; name: string; address?: Record<string, string> }[];

export const URL_NOMINATIM = (ville: string) =>
  `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(ville)}&countrycodes=fr&format=jsonv2&limit=1&addressdetails=1`;

export function lireNominatim(r: Reponse): Ville {
  const v = exiger(r?.[0], '[0] (ville introuvable)');
  const iso = exiger(v.address?.['ISO3166-2-lvl6'], 'address.ISO3166-2-lvl6');
  const dep = exiger(/^FR-(\d{2,3}|2A|2B)/.exec(iso)?.[1], 'département dans ISO3166-2-lvl6');
  return {
    nom: exiger(v.name, 'name'),
    lat: Number(exiger(v.lat, 'lat')),
    lon: Number(exiger(v.lon, 'lon')),
    // « 97 » seul ne dit pas quel département d'outre-mer : on garde les trois chiffres quand ils y sont.
    departement: dep,
    nomDepartement: v.address?.state_district ?? null,
  };
}

export const nominatim: Source<string, Ville> = {
  id: 'nominatim',
  nom: 'OpenStreetMap',
  mention: 'Lieu : © les contributeurs d’OpenStreetMap',
  lire: async (ville) => lireNominatim(await getJson<Reponse>(URL_NOMINATIM(ville))),
};
