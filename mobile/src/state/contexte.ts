/**
 * Les données du jour (météo, fériés, vacances scolaires, tendances…) telles
 * que la fonction serveur `donnees` les envoie. L'app n'appelle jamais les
 * API elles-mêmes : elle lit ce paquet, déjà mis en cache et passé par la
 * chaîne de repli côté serveur (supabase/functions/_shared/donnees/).
 *
 * Les formats reprennent ceux du serveur (types.ts) ; seuls les champs lus
 * par l'app sont décrits ici.
 */
import { dayDate, type Piece, type Weather } from '../data/wardrobe';

export type Etat = 'frais' | 'ancien' | 'indisponible';
export type Bloc<T> = { valeur: T | null; source: string | null; mention: string | null; maj: string | null; etat: Etat; message: string | null };

type Ciel = 'soleil' | 'nuages' | 'pluie' | 'averses' | 'neige' | 'orage' | 'brouillard';
export type JourMeteo = { date: string; max: number; min: number; ciel: Ciel; libelle: string; pluie: number | null; uv: number | null };
export type Meteo = { maintenant: { t: number; ressenti: number | null; ciel: Ciel; vent: number | null }; jours: JourMeteo[] };
export type Ferie = { date: string; nom: string };
export type Pont = { debut: string; fin: string; jours: number; aPoser: number; feries: string[] };
export type Vacances = { nom: string; debut: string; fin: string };
export type Tendance = { kind: string; libelle: string; variation: number | null };

export type Contexte = {
  jour: string;
  ville: Bloc<{ nom: string }>;
  meteo: Bloc<Meteo>;
  air: Bloc<{ indice: number | null; qualite: string | null; uv: number | null; pollens: { nom: string; grains: number }[] }>;
  soleil: Bloc<{ lever: string; coucher: string }>;
  feries: Bloc<Ferie[]>;
  ponts: Bloc<Pont[]>;
  vacances: Bloc<Vacances[]>;
  tendances: Bloc<Tendance[]>;
  fete: Bloc<{ prenoms: string }>;
};

/** Sans réseau neuf, on garde ce paquet une heure avant de le redemander (fraîcheur « économe »). */
export const RELIRE_APRES = 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** AAAA-MM-JJ du jour à `offset` jours d'aujourd'hui (heure de l'appareil, comme le reste de l'agenda). */
export function jourIso(offset: number): string {
  const d = dayDate(offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Le ciel du serveur en sept mots, ramené aux quatre icônes de l'app. Le
 * libellé, lui, garde le mot juste (« neige », « orages »).
 */
export const KIND: Record<Ciel, Weather['kind']> = { soleil: 'soleil', nuages: 'nuages', brouillard: 'nuages', pluie: 'pluie', neige: 'pluie', averses: 'averses', orage: 'averses' };

/**
 * La météo des 14 prochains jours au format de l'app, rangée par jour
 * (0 : aujourd'hui). null : pas de prévision pour ce jour (au-delà de dix
 * jours, ou météo indisponible).
 */
export function semaine(c: Contexte | null): (Weather | null)[] {
  const jours = new Map((c?.meteo.valeur?.jours ?? []).map((j) => [j.date, j]));
  return Array.from({ length: 14 }, (_, i) => {
    const j = jours.get(jourIso(i));
    if (!j) return null;
    return { t: j.max, low: j.min, kind: KIND[j.ciel] ?? 'nuages', label: j.libelle };
  });
}

/**
 * Il fait nuit : avant le lever ou après le coucher du soleil (heures du
 * serveur pour la ville), sinon avant 7 h ou après 21 h.
 */
export function nuit(c: Contexte | null, at = new Date()): boolean {
  const hhmm = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const s = c?.soleil.valeur;
  return s ? hhmm < s.lever || hhmm >= s.coucher : at.getHours() < 7 || at.getHours() >= 21;
}

/** La température et le ciel du moment, si la météo est connue. `mot` : « soleil », ou « ciel dégagé » la nuit. */
export function maintenant(c: Contexte | null): { t: number; kind: Weather['kind']; mot?: string } | null {
  const m = c?.meteo.valeur?.maintenant;
  if (!m) return null;
  const kind = KIND[m.ciel] ?? 'nuages';
  return { t: m.t, kind, mot: kind === 'soleil' && nuit(c) ? 'ciel dégagé' : undefined };
}

/** « 9 h 10 », ou « hier, 9 h 10 » si la valeur date d'un autre jour. */
export function heureMaj(iso: string): string {
  const d = new Date(iso);
  // Espaces insécables : « 21 h 20 » ne se coupe jamais en fin de ligne.
  const h = `${d.getHours()}\u00a0h\u00a0${pad(d.getMinutes())}`;
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return h;
  const hier = new Date(today);
  hier.setDate(today.getDate() - 1);
  return d.toDateString() === hier.toDateString() ? `hier, ${h}` : `le ${d.getDate()}/${pad(d.getMonth() + 1)}, ${h}`;
}

/**
 * La ligne de crédit à afficher en petit sous la donnée : la source (que sa
 * licence demande de citer) et l'heure de mise à jour. Une valeur ancienne
 * le dit ; une valeur absente donne son message.
 */
export function credit(b: Bloc<unknown> | undefined | null): { text: string; warn: boolean } | null {
  if (!b) return null;
  if (b.etat === 'indisponible' || b.valeur === null) return b.message ? { text: b.message, warn: true } : null;
  const quand = b.maj ? `mise à jour ${heureMaj(b.maj)}` : '';
  if (b.etat === 'ancien') return { text: `${b.mention ?? ''} · ${quand}, la source ne répond pas pour l’instant`, warn: true };
  return { text: [b.mention, quand].filter(Boolean).join(' · '), warn: false };
}

/* ---- Lectures par jour, pour l'agenda et la semaine ---- */

export const ferieDu = (c: Contexte | null, offset: number) => c?.feries.valeur?.find((f) => f.date === jourIso(offset)) ?? null;

export const vacancesDu = (c: Contexte | null, offset: number) => {
  const j = jourIso(offset);
  return c?.vacances.valeur?.find((v) => v.debut <= j && j <= v.fin) ?? null;
};

export const pontDu = (c: Contexte | null, offset: number) => {
  const j = jourIso(offset);
  return c?.ponts.valeur?.find((p) => p.debut <= j && j <= p.fin) ?? null;
};

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const quantieme = (d: number) => (d === 1 ? '1er' : String(d));

/** « 1er novembre » à partir d'une date AAAA-MM-JJ. */
export function dateLongue(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${quantieme(d)} ${MOIS[m - 1]}`;
}

/** « du 25 au 27 décembre » à partir de deux dates AAAA-MM-JJ. */
export function periode(debut: string, fin: string): string {
  const [, m1, d1] = debut.split('-').map(Number);
  const [, m2] = fin.split('-').map(Number);
  return m1 === m2 ? `du ${quantieme(d1)} au ${dateLongue(fin)}` : `du ${dateLongue(debut)} au ${dateLongue(fin)}`;
}

/**
 * Les tendances qui montent ET que le dressing a déjà : « pas besoin
 * d'acheter ». Seulement les vraies hausses (10 % et plus) ; la sélection de
 * saison du serveur (variation null) passe aussi, faute de mieux.
 */
export function tendancesChezToi(c: Contexte | null, pieces: Piece[]): { t: Tendance; pieces: Piece[] }[] {
  const liste = c?.tendances.valeur ?? [];
  return liste
    .filter((t) => t.variation === null || t.variation >= 10)
    .map((t) => ({ t, pieces: pieces.filter((p) => p.kind === t.kind) }))
    .filter((x) => x.pieces.length > 0);
}
