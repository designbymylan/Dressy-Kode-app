/**
 * Tendances, source principale : les consultations des articles de
 * Wikipédia en français (API Wikimedia Pageviews). Sans clé, données CC0.
 * Un signal sans marque : quand on lit beaucoup plus sur le trench cette
 * semaine que le mois dernier, c'est qu'on y pense.
 * Conditions : s'identifier (User-Agent), pas de rafales (on fait 3 appels
 * à la fois, une fois par jour pour tout le monde).
 * https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html
 */
import type { Source, Tendance } from '../types.ts';
import { getJson, parLots } from '../http.ts';
import { plusJours } from '../temps.ts';
import { PIECES } from '../pieces.ts';

type Reponse = { items: { timestamp: string; views: number }[] };

/** Les chiffres de la veille ne sont pas toujours prêts : on s'arrête deux jours avant. */
export function fenetre(jour: string) {
  const fin = plusJours(jour, -2);
  return { debut: plusJours(fin, -34), recent: plusJours(fin, -6), fin };
}

const compact = (j: string) => j.replaceAll('-', '');

export const urlVues = (titre: string, debut: string, fin: string) =>
  `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/fr.wikipedia/all-access/user/${encodeURIComponent(titre)}/daily/${compact(debut)}/${compact(fin)}`;

/** Moins de 300 lectures sur cinq semaines (moins de 10 par jour) : trop peu pour parler de tendance. */
const SEUIL = 300;

export function variation(r: Reponse, jour: string): number | null {
  const { recent } = fenetre(jour);
  const rc = compact(recent);
  if (!Array.isArray(r?.items)) throw new Error('champ manquant : items');
  let avant = 0;
  let apres = 0;
  for (const it of r.items) {
    if (typeof it.views !== 'number' || typeof it.timestamp !== 'string') throw new Error('champ manquant : items[].views');
    // Les jours sans lecture sont absents de la réponse : ils comptent pour zéro.
    if (it.timestamp.slice(0, 8) >= rc) apres += it.views;
    else avant += it.views;
  }
  if (avant + apres < SEUIL || avant === 0) return null;
  return Math.round(((apres / 7) / (avant / 28) - 1) * 100);
}

export const wikipedia: Source<{ jour: string }, Tendance[]> = {
  id: 'wikipedia',
  nom: 'Wikipédia',
  mention: 'Tendances : consultations de Wikipédia',
  lire: async ({ jour }) => {
    const { debut, fin } = fenetre(jour);
    const res = await parLots(PIECES, 3, async (p) => variation(await getJson<Reponse>(urlVues(p.wiki, debut, fin)), jour));
    const ok = res.filter((r) => r.status === 'fulfilled').length;
    if (ok < PIECES.length / 2) {
      const raison = res.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason;
      throw new Error(`${PIECES.length - ok} articles sans réponse (${raison?.message ?? raison})`);
    }
    return PIECES.flatMap((p, i) => {
      const r = res[i];
      return r.status === 'fulfilled' && r.value !== null ? [{ kind: p.kind, libelle: p.libelle, variation: r.value }] : [];
    }).sort((a, b) => (b.variation ?? 0) - (a.variation ?? 0));
  },
};
