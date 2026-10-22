/**
 * Le contexte du jour pour une ville : tout ce que l'app affiche et ce
 * que Kodi lit avant de répondre. Chaque morceau passe par la chaîne de
 * repli (repli.ts) et arrive dans le même emballage (types.ts).
 */
import type { Air, Bloc, Fete, Ferie, Meteo, Pont, Soleil, Tendance, Vacances, Ville } from './types.ts';
import type { Cache } from './cache.ts';
import { obtenir, HEURE, JOUR } from './repli.ts';
import { jourParis } from './temps.ts';
import { ponts } from './ponts.ts';
import { academie } from './academies.ts';
import { geoplateforme } from './sources/geoplateforme.ts';
import { nominatim } from './sources/nominatim.ts';
import { metno } from './sources/metno.ts';
import { openMeteo } from './sources/openmeteo.ts';
import { openMeteoAir } from './sources/openmeteoAir.ts';
import { metnoSoleil } from './sources/metnoSoleil.ts';
import { sunriseSunset } from './sources/sunriseSunset.ts';
import { feriesGouv, zoneFeries } from './sources/feriesGouv.ts';
import { nager } from './sources/nager.ts';
import { caldays } from './sources/caldays.ts';
import { education } from './sources/education.ts';
import { openHolidays } from './sources/openholidays.ts';
import { wikipedia } from './sources/wikipedia.ts';
import { saison } from './sources/saison.ts';
import { fete } from './sources/fete.ts';

export type Contexte = {
  /** Le jour (Paris) pour lequel le contexte a été assemblé. */
  jour: string;
  ville: Bloc<Ville>;
  meteo: Bloc<Meteo>;
  air: Bloc<Air>;
  soleil: Bloc<Soleil>;
  /** Les jours fériés des douze prochains mois. */
  feries: Bloc<Ferie[]>;
  /** Les week-ends prolongés à venir. */
  ponts: Bloc<Pont[]>;
  /** Les vacances scolaires en cours et à venir (académie de la ville). */
  vacances: Bloc<Vacances[]>;
  tendances: Bloc<Tendance[]>;
  fete: Bloc<Fete>;
};

const rien = <T>(message: string): Bloc<T> => ({ valeur: null, source: null, mention: null, maj: null, etat: 'indisponible', message });

/** Garde la provenance d'un bloc en changeant sa valeur (filtrer « à venir », calculer les ponts). */
const avec = <A, B>(b: Bloc<A>, f: (a: A) => B): Bloc<B> => ({ ...b, valeur: b.valeur === null ? null : f(b.valeur) });

/** « Saint-Étienne » et « saint etienne » partagent la même ligne de cache. */
export const cleVille = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Deux décimales (environ un kilomètre) : assez précis, et la même ligne de cache pour tout un quartier. */
const deux = (x: number) => Math.round(x * 100) / 100;

export async function contexteDuJour(cache: Cache, villeSaisie: string | null): Promise<Contexte> {
  const jour = jourParis();
  const annee = Number(jour.slice(0, 4));
  const nomVille = villeSaisie?.trim().slice(0, 80) || null;

  // Tendances et fête du jour ne dépendent pas de la ville : elles partent tout de suite.
  const tendancesP = obtenir(cache, {
    cle: 'tendances',
    duree: JOUR,
    quoi: 'Tendances',
    sources: [wikipedia],
    params: { jour },
    ultime: { source: saison, duree: HEURE, message: 'Sélection de saison, en attendant les chiffres du moment.' },
  });
  const feteP = obtenir(cache, { cle: `fete:${jour}`, duree: JOUR, quoi: 'Fête du jour', sources: [fete], params: null });

  const introuvable = 'Ville introuvable : vérifie son nom dans ton profil.';
  const trouvee: Bloc<Ville> = nomVille
    ? await obtenir(cache, { cle: `ville:${cleVille(nomVille)}`, duree: 30 * JOUR, quoi: 'Lieu', sources: [geoplateforme, nominatim], params: nomVille })
    : rien('Ajoute ta ville pour la météo et les vacances scolaires.');
  // Les deux géocodeurs ont échoué : le plus probable est un nom mal écrit.
  const ville = trouvee.etat === 'indisponible' && nomVille ? { ...trouvee, message: introuvable } : trouvee;
  const v = ville.valeur;
  const lieu = v ? { lat: deux(v.lat), lon: deux(v.lon) } : null;
  const dep = v?.departement ?? null;
  const acad = dep ? academie(dep) : null;
  const zone = zoneFeries(dep ?? '');
  const sansVille = <T>() => rien<T>(nomVille ? introuvable : 'Ajoute ta ville pour la météo.');

  const [meteo, air, soleil, feries, vacances, tendances, laFete] = await Promise.all([
    lieu ? obtenir(cache, { cle: `meteo:${lieu.lat},${lieu.lon}`, duree: HEURE, quoi: 'Météo', sources: [metno, openMeteo], params: lieu }) : sansVille<Meteo>(),
    lieu ? obtenir(cache, { cle: `air:${lieu.lat},${lieu.lon}`, duree: HEURE, quoi: 'Air et pollens', sources: [openMeteoAir], params: lieu }) : sansVille<Air>(),
    lieu
      ? obtenir(cache, { cle: `soleil:${lieu.lat},${lieu.lon}:${jour}`, duree: JOUR, quoi: 'Soleil', sources: [metnoSoleil, sunriseSunset], params: { ...lieu, jour } })
      : sansVille<Soleil>(),
    obtenir(cache, { cle: `feries:${zone}:${annee}`, duree: JOUR, quoi: 'Jours fériés', sources: [feriesGouv, nager, caldays], params: { zone, annees: [annee, annee + 1] } }),
    acad
      ? obtenir(cache, { cle: `vacances:${cleVille(acad)}`, duree: JOUR, quoi: 'Vacances scolaires', sources: [education, openHolidays], params: { academie: acad, nomDepartement: v?.nomDepartement ?? null, depuis: jour } })
      : rien<Vacances[]>(v ? 'Vacances scolaires : académie inconnue pour cette ville.' : nomVille ? introuvable : 'Ajoute ta ville pour les vacances scolaires.'),
    tendancesP,
    feteP,
  ]);

  const unAn = `${annee + 1}${jour.slice(4)}`;
  const feriesAVenir = avec(feries, (l) => l.filter((f) => f.date >= jour && f.date <= unAn));
  return {
    jour,
    ville,
    meteo: avec(meteo, (m) => ({ ...m, jours: m.jours.filter((j) => j.date >= jour) })),
    air,
    soleil,
    feries: feriesAVenir,
    ponts: { ...avec(feries, (l) => ponts(l).filter((p) => p.fin >= jour && p.debut <= unAn)), source: 'Dresskode', mention: feries.mention && `${feries.mention} · ponts calculés par Dresskode` },
    vacances: avec(vacances, (l) => l.filter((x) => x.fin >= jour)),
    tendances,
    fete: laFete,
  };
}
