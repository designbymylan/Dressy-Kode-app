/**
 * Ville vers coordonnées, source principale : Géoplateforme de l'IGN
 * (service public de géocodage). Sans clé, Licence Ouverte Etalab 2.0.
 * Limite publiée : 50 appels par seconde et par adresse IP.
 * https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage
 */
import type { Source, Ville } from '../types.ts';
import { getJson, exiger } from '../http.ts';

type Reponse = {
  features: { geometry: { coordinates: [number, number] }; properties: { name: string; citycode: string; context?: string } }[];
};

export const URL_GEOPF = (ville: string) =>
  `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(ville)}&type=municipality&limit=1`;

/** Le département d'un code commune INSEE : « 69123 » donne « 69 », « 97411 » donne « 974 », « 2A004 » donne « 2A ». */
export const departementInsee = (insee: string) => (insee.startsWith('97') ? insee.slice(0, 3) : insee.slice(0, 2));

export function lireGeopf(r: Reponse): Ville {
  const f = exiger(r?.features?.[0], 'features[0] (ville introuvable)');
  const [lon, lat] = exiger(f.geometry?.coordinates, 'geometry.coordinates');
  const p = exiger(f.properties, 'properties');
  return {
    nom: exiger(p.name, 'properties.name'),
    lat: exiger(lat, 'coordinates[1]'),
    lon: exiger(lon, 'coordinates[0]'),
    departement: departementInsee(exiger(p.citycode, 'properties.citycode')),
    nomDepartement: p.context?.split(', ')[1] ?? null,
  };
}

export const geoplateforme: Source<string, Ville> = {
  id: 'geoplateforme',
  nom: 'IGN Géoplateforme',
  mention: 'Lieu : IGN Géoplateforme',
  lire: async (ville) => lireGeopf(await getJson<Reponse>(URL_GEOPF(ville))),
};
