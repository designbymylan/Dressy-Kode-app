/**
 * La chaîne de repli, la même pour toutes les données :
 *
 *   1. la valeur en cache, si elle est encore fraîche ;
 *   2. la source principale, puis chaque source de secours, dans l'ordre ;
 *   3. sinon la dernière valeur connue, marquée « ancien », avec son heure ;
 *   4. sinon, pour certaines données, une valeur de secours calculée chez nous ;
 *   5. sinon « indisponible », avec une phrase claire.
 *
 * Aucune de ces étapes ne lève d'erreur : l'app reçoit toujours un bloc
 * lisible, jamais une page cassée.
 */
import type { Bloc, Source } from './types.ts';
import type { Cache, Entree } from './cache.ts';
import { quand } from './temps.ts';

/** Après un échec de toutes les sources, on attend ce délai avant de les réinterroger. */
export const REESSAI_MS = 5 * 60 * 1000;

export const HEURE = 60 * 60 * 1000;
export const JOUR = 24 * HEURE;

export type Demande<P, T> = {
  cle: string;
  duree: number;
  /** Ce que c'est, pour les messages : « Météo », « Jours fériés »… */
  quoi: string;
  sources: Source<P, T>[];
  params: P;
  /** Le tout dernier recours, quand ni les sources ni le cache n'ont rien (calculé chez nous, ne tombe pas). */
  ultime?: { source: Source<P, T>; duree: number; message: string };
  /** Pour les tests : l'heure qu'il est. */
  maintenant?: () => number;
};

const journal = (cle: string, source: string, e: unknown) => console.warn(`[donnees] ${cle} · ${source} : ${(e as Error)?.message ?? e}`);

function bloc<T>(e: Entree, etat: Bloc<T>['etat'], message: string | null): Bloc<T> {
  return { valeur: e.valeur as T, source: e.source, mention: e.mention, maj: e.maj, etat, message };
}

export async function obtenir<P, T>(cache: Cache, d: Demande<P, T>): Promise<Bloc<T>> {
  const now = d.maintenant?.() ?? Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();

  let enCache: Entree | null = null;
  try {
    enCache = await cache.lire(d.cle);
  } catch (e) {
    journal(d.cle, 'cache', e);
  }
  const ancien = (e: Entree) =>
    bloc<T>(e, 'ancien', `${d.quoi} : dernière mise à jour le ${quand(e.maj)}. La source ne répond pas pour l’instant, on réessaie bientôt.`);

  // 1. Encore fraîche.
  if (enCache && Date.parse(enCache.expire) > now) return bloc<T>(enCache, 'frais', null);
  // Les sources viennent d'échouer : on ne les relance pas à chaque ouverture de l'app.
  if (enCache?.reessai && Date.parse(enCache.reessai) > now) return ancien(enCache);

  const ecrire = async (e: Entree) => {
    try {
      await cache.ecrire(d.cle, e);
    } catch (err) {
      journal(d.cle, 'cache', err);
    }
  };

  // 2. Principale, puis secours.
  for (const s of d.sources) {
    try {
      const valeur = await s.lire(d.params);
      const e: Entree = { valeur, source: s.nom, mention: s.mention, maj: iso(now), expire: iso(now + d.duree), reessai: null };
      await ecrire(e);
      return bloc<T>(e, 'frais', null);
    } catch (err) {
      journal(d.cle, s.id, err);
    }
  }

  // 3. La dernière valeur connue.
  if (enCache) {
    await ecrire({ ...enCache, reessai: iso(now + REESSAI_MS) });
    return ancien(enCache);
  }

  // 4. Notre propre secours.
  if (d.ultime) {
    try {
      const valeur = await d.ultime.source.lire(d.params);
      const s = d.ultime.source;
      const e: Entree = { valeur, source: s.nom, mention: s.mention, maj: iso(now), expire: iso(now + d.ultime.duree), reessai: null };
      await ecrire(e);
      return bloc<T>(e, 'frais', d.ultime.message);
    } catch (err) {
      journal(d.cle, d.ultime.source.id, err);
    }
  }

  // 5. Rien.
  return { valeur: null, source: null, mention: null, maj: null, etat: 'indisponible', message: `${d.quoi} : indisponible pour l’instant.` };
}
