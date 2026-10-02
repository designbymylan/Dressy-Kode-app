/**
 * node supabase/functions/_shared/donnees/donnees.test.ts        (tout)
 * node supabase/functions/_shared/donnees/donnees.test.ts --hors-ligne
 *
 * 1. Hors ligne : la chaîne de repli, le calcul des ponts, les académies,
 *    les codes météo.
 * 2. En ligne : chaque source est appelée pour de vrai et lue avec le même
 *    code que l'app ; si un champ utilisé disparaît, la lecture échoue et
 *    le test le dit.
 */
import type { Source } from './types.ts';
import { cacheMemoire } from './cache.ts';
import { obtenir, HEURE, REESSAI_MS } from './repli.ts';
import { ponts } from './ponts.ts';
import { academie, ACADEMIES, DEPARTEMENTS } from './academies.ts';
import { cielMet, cielWmo } from './ciel.ts';
import { jourParis, plusJours } from './temps.ts';
import { getJson, parLots } from './http.ts';
import { PIECES } from './pieces.ts';
import { geoplateforme } from './sources/geoplateforme.ts';
import { nominatim } from './sources/nominatim.ts';
import { metno } from './sources/metno.ts';
import { openMeteo } from './sources/openmeteo.ts';
import { openMeteoAir } from './sources/openmeteoAir.ts';
import { metnoSoleil } from './sources/metnoSoleil.ts';
import { sunriseSunset } from './sources/sunriseSunset.ts';
import { feriesGouv, zoneFeries } from './sources/feriesGouv.ts';
import { nager } from './sources/nager.ts';
import { caldays, pontsCaldays } from './sources/caldays.ts';
import { education } from './sources/education.ts';
import { openHolidays } from './sources/openholidays.ts';
import { wikipedia, urlVues, fenetre } from './sources/wikipedia.ts';
import { selectionDeSaison } from './sources/saison.ts';
import { fete } from './sources/fete.ts';
import { contexteDuJour } from './contexte.ts';

let fails = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` · ${detail}` : ''}`);
};
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ================================================================ hors ligne

console.log('\n· Hors ligne');

{
  const manquants: string[] = [];
  for (let n = 1; n <= 95; n++) {
    const d = String(n).padStart(2, '0');
    if (d !== '20' && !academie(d)) manquants.push(d);
  }
  for (const d of ['2A', '2B', '971', '972', '973', '974', '976']) if (!academie(d)) manquants.push(d);
  check('chaque département a son académie', manquants.length === 0, manquants.join(', '));
  check('aucun département dans deux académies', new Set(DEPARTEMENTS).size === DEPARTEMENTS.length);
  check('zone de fériés : Strasbourg en Alsace-Moselle', zoneFeries('67') === 'alsace-moselle');
  check('zone de fériés : La Réunion', zoneFeries('974') === 'la-reunion');
  check('zone de fériés : Lyon en métropole', zoneFeries('69') === 'metropole');
}

{
  check('MET : coquille de la légende lue comme orage', cielMet('lightssleetshowersandthunder ').ciel === 'orage');
  check('MET : suffixe _day retiré', cielMet('partlycloudy_day').mot === 'éclaircies');
  check('MET : averses', cielMet('rainshowers_night').ciel === 'averses');
  check('MET : neige fondue', cielMet('heavysleet').ciel === 'neige');
  check('MET : pluie fine', cielMet('lightrain').mot === 'pluie fine');
  check('WMO : 0 soleil, 3 couvert, 81 averses, 95 orage', [0, 3, 81, 95].map((c) => cielWmo(c).ciel).join() === 'soleil,nuages,averses,orage');
}

{
  // Les fériés 2026 de calendrier.api.gouv.fr et les week-ends prolongés relevés chez caldays.com le 30 septembre 2026.
  const f2026 = [
    ['2026-01-01', '1er janvier'], ['2026-04-06', 'Lundi de Pâques'], ['2026-05-01', '1er mai'], ['2026-05-08', '8 mai'],
    ['2026-05-14', 'Ascension'], ['2026-05-25', 'Lundi de Pentecôte'], ['2026-07-14', '14 juillet'], ['2026-08-15', 'Assomption'],
    ['2026-11-01', 'Toussaint'], ['2026-11-11', '11 novembre'], ['2026-12-25', 'Jour de Noël'],
  ].map(([date, nom]) => ({ date, nom }));
  const attendu = '2026-01-01/2026-01-04/4/1 2026-04-04/2026-04-06/3/0 2026-05-01/2026-05-03/3/0 2026-05-08/2026-05-10/3/0 2026-05-14/2026-05-17/4/1 2026-05-23/2026-05-25/3/0 2026-07-11/2026-07-14/4/1 2026-12-25/2026-12-27/3/0';
  const calcule = ponts(f2026).map((p) => `${p.debut}/${p.fin}/${p.jours}/${p.aPoser}`).join(' ');
  check('ponts 2026 calculés = ponts de caldays', calcule === attendu, calcule === attendu ? '' : calcule);
  const fusion = ponts([{ date: '2025-12-25', nom: 'Noël' }, { date: '2025-12-26', nom: 'Saint-Étienne' }]);
  check('deux fériés qui se suivent font un seul long week-end', fusion.length === 1 && fusion[0].jours === 4 && fusion[0].aPoser === 0, JSON.stringify(fusion));
}

{
  const t0 = Date.parse('2026-10-02T08:00:00Z');
  let t = t0;
  const maintenant = () => t;
  let appels = 0;
  const ok = (nom: string, v: number): Source<null, number> => ({ id: nom, nom, mention: `crédit ${nom}`, lire: async () => (appels++, v) });
  const ko = (nom: string): Source<null, number> => ({ id: nom, nom, mention: '', lire: async () => { appels++; throw new Error('en panne'); } });
  const cache = cacheMemoire();
  const muet = console.warn;
  console.warn = () => {};

  let b = await obtenir(cache, { cle: 'x', duree: HEURE, quoi: 'Test', sources: [ko('a'), ok('b', 2)], params: null, maintenant });
  check('principale en panne : le secours prend le relais', b.etat === 'frais' && b.valeur === 2 && b.mention === 'crédit b');

  appels = 0;
  t = t0 + HEURE / 2;
  b = await obtenir(cache, { cle: 'x', duree: HEURE, quoi: 'Test', sources: [ok('a', 1)], params: null, maintenant });
  check('valeur fraîche servie depuis le cache, sans appel', b.valeur === 2 && appels === 0);

  t = t0 + 2 * HEURE;
  b = await obtenir(cache, { cle: 'x', duree: HEURE, quoi: 'Météo', sources: [ko('a'), ko('b')], params: null, maintenant });
  check('tout en panne : dernière valeur connue, marquée ancienne', b.etat === 'ancien' && b.valeur === 2 && b.maj === new Date(t0).toISOString());
  check('… avec son heure dans le message', /2 octobre à 10 h 00/.test(b.message ?? ''), b.message ?? '');

  appels = 0;
  t += REESSAI_MS / 2;
  b = await obtenir(cache, { cle: 'x', duree: HEURE, quoi: 'Météo', sources: [ko('a')], params: null, maintenant });
  check('pas de nouvel essai avant cinq minutes', b.etat === 'ancien' && appels === 0);

  b = await obtenir(cacheMemoire(), { cle: 'y', duree: HEURE, quoi: 'Météo', sources: [ko('a')], params: null, maintenant });
  check('tout en panne et rien en cache : indisponible, message clair', b.etat === 'indisponible' && b.valeur === null && b.message === 'Météo : indisponible pour l’instant.');

  b = await obtenir(cacheMemoire(), { cle: 'z', duree: HEURE, quoi: 'Tendances', sources: [ko('a')], params: null, maintenant, ultime: { source: ok('maison', 9), duree: HEURE, message: 'de saison' } });
  check('dernier recours maison quand rien d’autre', b.etat === 'frais' && b.valeur === 9 && b.message === 'de saison');

  const z = cacheMemoire();
  const saisonnier = { source: ok('maison', 9), duree: HEURE, message: 'de saison' };
  await obtenir(z, { cle: 'z', duree: HEURE, quoi: 'Tendances', sources: [ko('a')], params: null, maintenant, ultime: saisonnier });
  t += 2 * HEURE;
  b = await obtenir(z, { cle: 'z', duree: HEURE, quoi: 'Tendances', sources: [ko('a')], params: null, maintenant, ultime: saisonnier });
  check('le secours maison n’est jamais présenté comme une valeur ancienne', b.etat === 'frais' && b.message === 'de saison');

  const casse = { lire: async () => { throw new Error('base en panne'); }, ecrire: async () => { throw new Error('base en panne'); } };
  b = await obtenir(casse, { cle: 'w', duree: HEURE, quoi: 'Test', sources: [ok('a', 3)], params: null, maintenant });
  check('cache en panne : la source répond quand même', b.etat === 'frais' && b.valeur === 3);
  console.warn = muet;
}

check('sélection de saison en octobre : le trench en tête', selectionDeSaison('2026-10-02')[0]?.kind === 'trench');

// ================================================================ en ligne

if (process.argv.includes('--hors-ligne')) {
  console.log(fails ? `\n${fails} échec(s)` : '\nTout est vert (hors ligne).');
  process.exit(fails ? 1 : 0);
}

console.log('\n· En ligne (vraies API)');

const jour = jourParis();
const annee = Number(jour.slice(0, 4));
const LYON = { lat: 45.76, lon: 4.84 };

async function essai(label: string, f: () => Promise<string | void>) {
  const t = Date.now();
  try {
    const detail = await f();
    check(label, true, `${Date.now() - t} ms${detail ? ` · ${detail}` : ''}`);
  } catch (e) {
    check(label, false, (e as Error).message);
  }
}
const vrai = (cond: boolean, quoi: string) => {
  if (!cond) throw new Error(quoi);
};

await essai('IGN Géoplateforme : Lyon', async () => {
  const v = await geoplateforme.lire('Lyon');
  vrai(v.departement === '69' && v.nomDepartement === 'Rhône', JSON.stringify(v));
  return `${v.nom} ${v.lat},${v.lon} dép. ${v.departement}`;
});
await essai('IGN Géoplateforme : Saint-Denis (La Réunion) donne 974', async () => {
  const v = await geoplateforme.lire('Saint-Denis 97400');
  vrai(v.departement === '974', JSON.stringify(v));
});
/** Nominatim : un appel par seconde au plus (règle d'usage) ; sur 429, un seul nouvel essai après 3 s. */
async function poliment<T>(f: () => Promise<T>): Promise<T> {
  await pause(1500);
  try {
    return await f();
  } catch (e) {
    if ((e as { status?: number }).status !== 429) throw e;
    await pause(3000);
    return f();
  }
}

await essai('Nominatim : Lyon', async () => {
  const v = await poliment(() => nominatim.lire('Lyon'));
  vrai(v.departement === '69', JSON.stringify(v));
  return `${v.nom} ${v.lat.toFixed(2)},${v.lon.toFixed(2)}`;
});
await essai('MET Norway : météo de Lyon', async () => {
  const m = await metno.lire(LYON);
  vrai(m.jours.length >= 7, `${m.jours.length} jours`);
  return `${m.maintenant.t}°, ${m.jours.length} jours, aujourd'hui ${m.jours[0].min}° à ${m.jours[0].max}°, ${m.jours[0].libelle}`;
});
await essai('Open-Meteo : météo de Lyon', async () => {
  const m = await openMeteo.lire(LYON);
  vrai(m.jours.length === 10 && m.jours.every((j) => j.pluie !== null), `${m.jours.length} jours`);
  return `${m.maintenant.t}°, ${m.jours[0].libelle}, pluie ${m.jours[0].pluie} mm`;
});
await essai('Open-Meteo Air : Lyon', async () => {
  const a = await openMeteoAir.lire(LYON);
  vrai(a.indice !== null, 'indice absent');
  return `indice ${a.indice} (${a.qualite}), UV ${a.uv}, pollens ${a.pollens.map((p) => p.nom).join(', ') || 'aucun'}`;
});
await essai('MET Norway Sunrise : Lyon', async () => {
  const s = await metnoSoleil.lire({ ...LYON, jour });
  vrai(/^\d\d:\d\d$/.test(s.lever) && /^\d\d:\d\d$/.test(s.coucher), JSON.stringify(s));
  return `lever ${s.lever}, coucher ${s.coucher}`;
});
await essai('sunrise-sunset.org : Lyon', async () => {
  const s = await sunriseSunset.lire({ ...LYON, jour });
  vrai(/^\d\d:\d\d$/.test(s.lever), JSON.stringify(s));
  return `lever ${s.lever}, coucher ${s.coucher}`;
});
await essai(`calendrier.api.gouv.fr : métropole ${annee} et ${annee + 1}`, async () => {
  const f = await feriesGouv.lire({ zone: 'metropole', annees: [annee, annee + 1] });
  vrai(f.length >= 22, `${f.length} jours`);
  return `${f.length} jours`;
});
await essai('calendrier.api.gouv.fr : Alsace-Moselle a deux jours de plus', async () => {
  const [m, a] = await Promise.all([feriesGouv.lire({ zone: 'metropole', annees: [annee] }), feriesGouv.lire({ zone: 'alsace-moselle', annees: [annee] })]);
  vrai(a.length === m.length + 2, `${m.length} contre ${a.length}`);
});
await essai(`Nager.Date : ${annee} et ${annee + 1}`, async () => {
  const f = await nager.lire({ zone: 'metropole', annees: [annee, annee + 1] });
  vrai(f.length >= 22, `${f.length} jours`);
  return `${f.length} jours`;
});
await essai('caldays.com : fériés de l’année', async () => {
  const f = await caldays.lire({ zone: 'metropole', annees: [annee] });
  vrai(f.length >= 11, `${f.length} jours`);
  return `${f.length} jours`;
});
await essai('nos ponts = ceux de caldays.com (année en cours)', async () => {
  const [f, c] = await Promise.all([feriesGouv.lire({ zone: 'metropole', annees: [annee] }), pontsCaldays()]);
  const a = ponts(f).map((p) => `${p.debut}/${p.fin}/${p.jours}/${p.aPoser}`).join(' ');
  const b = c.map((p) => `${p.debut}/${p.fin}/${p.jours}/${p.aPoser}`).join(' ');
  vrai(a === b, `nous ${a} · caldays ${b}`);
  return `${c.length} week-ends`;
});
await essai('Éducation nationale : vacances de l’académie de Lyon', async () => {
  const v = await education.lire({ academie: 'Lyon', nomDepartement: 'Rhône', depuis: jour });
  vrai(v.length >= 3, `${v.length} périodes`);
  return v.slice(0, 2).map((x) => `${x.nom} ${x.debut} → ${x.fin}`).join(' ; ');
});
await essai('Éducation nationale : chaque académie existe dans le jeu de données', async () => {
  const r = await getJson<{ results: { location: string }[] }>(
    'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?select=location&group_by=location&limit=100',
  );
  const connues = new Set(r.results.map((x) => x.location));
  const absentes = ACADEMIES.filter((a) => !connues.has(a));
  vrai(absentes.length === 0, `absentes : ${absentes.join(', ')}`);
  return `${connues.size} lieux`;
});
await essai('OpenHolidays : vacances de l’académie de Lyon', async () => {
  const v = await openHolidays.lire({ academie: 'Lyon', nomDepartement: 'Rhône', depuis: jour });
  vrai(v.length >= 3, `${v.length} périodes`);
  return v.slice(0, 2).map((x) => `${x.nom} ${x.debut} → ${x.fin}`).join(' ; ');
});
await essai(`Wikimedia : les ${PIECES.length} articles répondent`, async () => {
  const { debut, fin } = fenetre(jour);
  const res = await parLots(PIECES, 3, (p) => getJson(urlVues(p.wiki, debut, fin)));
  const ko = PIECES.filter((_, i) => res[i].status === 'rejected').map((p, i) => `${p.wiki}`);
  vrai(ko.length === 0, `sans réponse : ${ko.join(', ')}`);
});
await pause(1000);
await essai('Wikimedia : tendances calculées', async () => {
  const t = await wikipedia.lire({ jour });
  vrai(t.length >= 10, `${t.length} pièces`);
  return t.slice(0, 4).map((x) => `${x.libelle} ${x.variation! > 0 ? '+' : ''}${x.variation} %`).join(', ');
});
await essai('nameday.abalin.net : fête du jour', async () => {
  const f = await fete.lire(null);
  return f.prenoms;
});
await essai('contexte complet pour Lyon (cache en mémoire)', async () => {
  const cache = cacheMemoire();
  const c = await contexteDuJour(cache, 'Lyon');
  const etats = Object.entries(c).filter(([k]) => k !== 'jour').map(([k, b]) => `${k}:${(b as { etat: string }).etat}`);
  vrai(c.meteo.etat === 'frais' && c.feries.etat === 'frais' && c.vacances.etat === 'frais', etats.join(' '));
  const t = Date.now();
  await contexteDuJour(cache, 'lyon');
  return `${etats.join(' ')} · second appel ${Date.now() - t} ms (cache)`;
});

await essai('ville introuvable : un message clair, et les fériés quand même', async () => {
  await pause(1500); // ce cas interroge aussi Nominatim
  const c = await contexteDuJour(cacheMemoire(), 'Zzqxw-ville-qui-n-existe-pas');
  vrai(c.ville.etat === 'indisponible' && c.ville.message?.startsWith('Ville introuvable') === true, c.ville.message ?? '');
  vrai(c.vacances.message?.startsWith('Ville introuvable') === true, c.vacances.message ?? '');
  vrai(c.feries.etat === 'frais', c.feries.etat);
});

console.log(fails ? `\n${fails} échec(s)` : '\nTout est vert.');
process.exit(fails ? 1 : 0);
