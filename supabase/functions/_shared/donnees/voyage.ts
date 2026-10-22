/**
 * Les voyages (07/10) : trouver un lieu dans le monde, sa photo et sa météo
 * jour par jour, pour que Kodi prépare une tenue par jour sur place.
 *
 * - Lieux : géocodage d'Open-Meteo (noms en français), secours Nominatim.
 * - Photo : l'image de l'article Wikipédia du lieu (Wikimedia Commons).
 * - Météo : la prévision d'Open-Meteo jusqu'à 16 jours ; au-delà, le temps
 *   qu'il a fait l'an dernier aux mêmes dates (archives d'Open-Meteo),
 *   marqué comme tel. Rien n'est inventé.
 *
 * Même emballage que le reste (Bloc, cache partagé, chaîne de repli).
 * Open-Meteo est gratuit pour un usage non commercial seulement (voir
 * README.md, « Avant un lancement payant »).
 */
import type { Bloc, Ciel, Source } from './types.ts';
import type { Cache } from './cache.ts';
import { getJson, exiger } from './http.ts';
import { cielWmo } from './ciel.ts';
import { JOUR, HEURE, obtenir } from './repli.ts';

export type Lieu = {
  nom: string;
  pays: string | null;
  region: string | null;
  lat: number;
  lon: number;
};

export type JourVoyage = {
  date: string;
  max: number;
  min: number;
  ciel: Ciel;
  libelle: string;
  /** prevision : la vraie prévision ; saison : ce qu'il a fait l'an dernier ce jour-là. */
  nature: 'prevision' | 'saison';
};

export type Photo = { url: string; credit: string; page: string | null };

/* ---- Lieux ---- */

type Geo = { results?: { name: string; latitude: number; longitude: number; country?: string; admin1?: string; population?: number }[] };

export const URL_GEO = (q: string) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=fr&format=json`;

export function lireGeo(r: Geo): Lieu[] {
  const res = exiger(r?.results, 'results (lieu introuvable)');
  return res.map((x) => ({ nom: x.name, pays: x.country ?? null, region: x.admin1 ?? null, lat: x.latitude, lon: x.longitude }));
}

const geo: Source<string, Lieu[]> = {
  id: 'openmeteo-geo',
  nom: 'Open-Meteo',
  mention: 'Lieux : Open-Meteo.com (GeoNames, CC BY 4.0)',
  lire: async (q) => lireGeo(await getJson<Geo>(URL_GEO(q))),
};

type Osm = { name: string; lat: string; lon: string; address?: Record<string, string> }[];

const nominatimMonde: Source<string, Lieu[]> = {
  id: 'nominatim-monde',
  nom: 'OpenStreetMap',
  mention: 'Lieux : © les contributeurs d’OpenStreetMap',
  lire: async (q) => {
    const r = await getJson<Osm>(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=5&addressdetails=1&accept-language=fr`);
    exiger(r?.[0], '[0] (lieu introuvable)');
    return r.map((x) => ({ nom: x.name, pays: x.address?.country ?? null, region: x.address?.state ?? null, lat: Number(x.lat), lon: Number(x.lon) }));
  },
};

const cleTexte = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

export function chercherLieux(cache: Cache, q: string): Promise<Bloc<Lieu[]>> {
  return obtenir(cache, { cle: `lieux:${cleTexte(q)}`, duree: 30 * JOUR, quoi: 'Lieu', sources: [geo, nominatimMonde], params: q });
}

/* ---- Photo ---- */

type Resume = { title?: string; thumbnail?: { source: string }; originalimage?: { source: string }; content_urls?: { mobile?: { page?: string } } };

/** Une vignette Wikimedia à une largeur raisonnable pour un téléphone (960 px). */
export function largeur(url: string, px = 960) {
  return url.replace(/\/(\d+)px-([^/]+)$/, `/${px}px-$2`).replace(/\?.*$/, '');
}

/** La page Commons du fichier, pour le crédit. */
export function pageFichier(url: string): string | null {
  const m = /\/commons\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)\//.exec(url) ?? /\/commons\/[0-9a-f]\/[0-9a-f]{2}\/([^/?]+)/.exec(url);
  return m ? `https://commons.wikimedia.org/wiki/File:${m[1]}` : null;
}

/** Pas un drapeau, un blason, une carte ou un logo : une vraie photo du lieu. */
const PAS_UNE_PHOTO = /drapeau|flag|bandeira|bandera|blason|coat[_ ]of[_ ]arms|escudo|wappen|map|carte|locator|location|logo|seal|sello|emblem|embl[eè]me|signature|\.svg/i;

export const vraiePhoto = (url: string) => /\.jpe?g($|\?|\/)/i.test(url) && !PAS_UNE_PHOTO.test(decodeURIComponent(url.split('/').slice(-2).join('/')));

export function lirePhoto(r: Resume): Photo {
  const src = exiger(r?.thumbnail?.source ?? r?.originalimage?.source, 'thumbnail.source (pas de photo)');
  if (!vraiePhoto(src)) throw new Error('la vignette n’est pas une photo du lieu');
  return { url: largeur(src), credit: 'Photo : Wikimedia Commons, via Wikipédia', page: pageFichier(src) ?? r.content_urls?.mobile?.page ?? null };
}

type Info = { thumburl?: string; url: string; width: number; height: number; mime: string; descriptionurl?: string; extmetadata?: Record<string, { value: string }> };
type Fichiers = { query?: { pages?: { title: string; imageinfo?: Info[] }[] } };

const sansBalises = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Parmi les images d'un article : la plus grande photo en paysage, avec son auteur et sa licence. */
export function choisirPhoto(r: Fichiers): Photo {
  const pages = exiger(r?.query?.pages, 'query.pages (aucune image)');
  const photos = pages
    .map((p) => ({ titre: p.title, i: p.imageinfo?.[0] }))
    .filter((x): x is { titre: string; i: Info } => !!x.i && x.i.mime === 'image/jpeg' && x.i.width >= 1000 && x.i.width >= x.i.height * 1.2 && !PAS_UNE_PHOTO.test(x.titre))
    .sort((x, z) => z.i.width * z.i.height - x.i.width * x.i.height);
  const best = exiger(photos[0], 'aucune photo en paysage');
  const auteur = best.i.extmetadata?.Artist?.value ? sansBalises(best.i.extmetadata.Artist.value).slice(0, 60) : null;
  const licence = best.i.extmetadata?.LicenseShortName?.value ?? null;
  const qui = [auteur, licence].filter(Boolean).join(', ');
  return { url: best.i.thumburl ?? best.i.url, credit: qui ? `Photo : ${qui}, Wikimedia Commons` : 'Photo : Wikimedia Commons', page: best.i.descriptionurl ?? null };
}

const URL_FICHIERS = (titre: string) =>
  'https://fr.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1' +
  `&titles=${encodeURIComponent(titre)}&generator=images&gimlimit=60&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=960` +
  '&iiextmetadatafilter=Artist|LicenseShortName';

/** La vignette de l'article, quand c'est une vraie photo du lieu. */
const photoWiki: Source<string, Photo> = {
  id: 'wikipedia-photo',
  nom: 'Wikipédia',
  mention: 'Photo : Wikimedia Commons, via Wikipédia',
  lire: async (titre) => lirePhoto(await getJson<Resume>(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titre.replace(/ /g, '_'))}`)),
};

/** Sinon, la plus grande photo en paysage de l'article. */
const photoArticle: Source<string, Photo> = {
  id: 'wikipedia-images',
  nom: 'Wikimedia Commons',
  mention: 'Photo : Wikimedia Commons',
  lire: async (titre) => choisirPhoto(await getJson<Fichiers>(URL_FICHIERS(titre))),
};

export function photoDuLieu(cache: Cache, nom: string): Promise<Bloc<Photo>> {
  return obtenir(cache, { cle: `photo:${cleTexte(nom)}`, duree: 30 * JOUR, quoi: 'Photo du lieu', sources: [photoWiki, photoArticle], params: nom });
}

/* ---- Météo ---- */

type Daily = { daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] } };

type Plage = { lat: number; lon: number; debut: string; fin: string };

function lireJours(r: Daily, nature: JourVoyage['nature'], decale = 0): JourVoyage[] {
  const d = exiger(r?.daily, 'daily');
  return exiger(d.time, 'daily.time').map((date, i) => {
    const n = cielWmo(exiger(d.weather_code?.[i], 'daily.weather_code'));
    return {
      date: decale ? `${Number(date.slice(0, 4)) + decale}${date.slice(4)}` : date,
      max: Math.round(exiger(d.temperature_2m_max?.[i], 'daily.temperature_2m_max')),
      min: Math.round(exiger(d.temperature_2m_min?.[i], 'daily.temperature_2m_min')),
      ciel: n.ciel,
      libelle: n.mot,
      nature,
    };
  });
}

const DAILY = 'daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto';

const prevision: Source<Plage, JourVoyage[]> = {
  id: 'openmeteo-voyage',
  nom: 'Open-Meteo',
  mention: 'Météo : Open-Meteo.com (CC BY 4.0)',
  lire: async (p) =>
    lireJours(await getJson<Daily>(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&start_date=${p.debut}&end_date=${p.fin}&${DAILY}`), 'prevision'),
};

const anDernier = (iso: string) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;

const saison: Source<Plage, JourVoyage[]> = {
  id: 'openmeteo-archive',
  nom: 'Open-Meteo',
  mention: 'Météo : l’an dernier aux mêmes dates, Open-Meteo.com (CC BY 4.0)',
  lire: async (p) =>
    lireJours(
      await getJson<Daily>(`https://archive-api.open-meteo.com/v1/archive?latitude=${p.lat}&longitude=${p.lon}&start_date=${anDernier(p.debut)}&end_date=${anDernier(p.fin)}&${DAILY}`),
      'saison',
      1,
    ),
};

const plus = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * La météo du voyage, jour par jour : la prévision pour les 15 prochains
 * jours, l'an dernier pour le reste. Deux blocs, crédités chacun.
 */
export async function meteoVoyage(cache: Cache, lat: number, lon: number, debut: string, fin: string, aujourdhui: string): Promise<{ prevision: Bloc<JourVoyage[]> | null; saison: Bloc<JourVoyage[]> | null }> {
  const lim = plus(aujourdhui, 15);
  const pos = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const pDebut = debut < aujourdhui ? aujourdhui : debut;
  const pFin = fin < lim ? fin : lim;
  const sDebut = debut > lim ? debut : plus(lim, 1);
  const [p, s] = await Promise.all([
    pDebut <= pFin ? obtenir(cache, { cle: `voyage:${pos}:${pDebut}:${pFin}`, duree: 3 * HEURE, quoi: 'Météo du voyage', sources: [prevision], params: { lat, lon, debut: pDebut, fin: pFin } }) : null,
    sDebut <= fin ? obtenir(cache, { cle: `saison:${pos}:${sDebut}:${fin}`, duree: 30 * JOUR, quoi: 'Météo de saison', sources: [saison], params: { lat, lon, debut: sDebut, fin } }) : null,
  ]);
  return { prevision: p, saison: s };
}
