/**
 * La fête du jour (« Bonne fête aux Jérôme »), source : nameday.abalin.net.
 * Sans clé, gratuit ; limite annoncée dans ses en-têtes : 60 appels
 * (x-ratelimit-limit). Une seule ligne de cache par jour pour tout le
 * monde : un appel par jour au plus. Pas de secours : c'est un clin d'œil,
 * l'app s'en passe.
 * https://nameday.abalin.net
 */
import type { Fete, Source } from '../types.ts';
import { getJson, exiger } from '../http.ts';

export const URL_FETE = 'https://nameday.abalin.net/api/V2/today/fr?timezone=Europe%2FParis';

type Reponse = { success?: boolean; data: Record<string, string> };

export function lireFete(r: Reponse): Fete {
  const prenoms = exiger(r?.data?.fr, 'data.fr').trim();
  if (!prenoms || prenoms === 'n/a') throw new Error('pas de fête française ce jour');
  return { prenoms };
}

export const fete: Source<null, Fete> = {
  id: 'nameday',
  nom: 'abalin.net',
  mention: 'Fête du jour : nameday.abalin.net',
  lire: async () => lireFete(await getJson<Reponse>(URL_FETE)),
};
