/**
 * Les données du jour (météo, fériés, tendances…) telles que la fonction
 * serveur `donnees` les envoie. Le site n'appelle jamais une API externe :
 * il lit ce paquet, déjà mis en cache et passé par la chaîne de repli côté
 * serveur (supabase/functions/_shared/donnees/). Mêmes formats et mêmes
 * lectures que l'app mobile (mobile/src/state/contexte.ts).
 *
 * Si la fonction ne répond pas, l'accueil s'affiche quand même, sans météo
 * ni tendances : on ne bloque jamais une page sur une donnée du jour.
 */
import type { createClient } from '@/lib/supabase/server';
import { parisDay } from '@/lib/dates';

type Db = Awaited<ReturnType<typeof createClient>>;

export type Etat = 'frais' | 'ancien' | 'indisponible';
export type Bloc<T> = { valeur: T | null; source: string | null; mention: string | null; maj: string | null; etat: Etat; message: string | null };

type Ciel = 'soleil' | 'nuages' | 'pluie' | 'averses' | 'neige' | 'orage' | 'brouillard';
export type JourMeteo = { date: string; max: number; min: number; ciel: Ciel; libelle: string; pluie: number | null; uv: number | null };
export type Meteo = { maintenant: { t: number; ressenti: number | null; ciel: Ciel; vent: number | null }; jours: JourMeteo[] };
export type Ferie = { date: string; nom: string };
export type Tendance = { kind: string; libelle: string; variation: number | null };

export type Contexte = {
  jour: string;
  ville: Bloc<{ nom: string }>;
  meteo: Bloc<Meteo>;
  feries: Bloc<Ferie[]>;
  tendances: Bloc<Tendance[]>;
};

/** Le ciel ramené aux quatre icônes de l'app. */
export type Kind = 'soleil' | 'nuages' | 'pluie' | 'averses';
/** Le temps d'un jour : température, ciel en quatre icônes, et le mot juste du serveur. */
export type Weather = { t: number; low?: number; kind: Kind; label: string };

const KIND: Record<Ciel, Kind> = { soleil: 'soleil', nuages: 'nuages', brouillard: 'nuages', pluie: 'pluie', neige: 'pluie', averses: 'averses', orage: 'averses' };

/** Au-delà, on laisse la page s'afficher sans la météo. */
const DELAI_MS = 2500;

/**
 * Le paquet du jour pour la ville du profil, ou null s'il n'arrive pas à
 * temps ou si la fonction répond une erreur.
 */
export async function loadContexte(supabase: Db): Promise<Contexte | null> {
  try {
    const appel = supabase.functions
      .invoke<Contexte>('donnees', { body: {} })
      .then(({ data, error }) => (error || !data ? null : data));
    const attente = new Promise<null>((resolve) => setTimeout(() => resolve(null), DELAI_MS));
    return await Promise.race([appel, attente]);
  } catch {
    return null;
  }
}

/** La météo des 14 prochains jours, rangée par jour (0 : aujourd'hui) ; null : pas de prévision ce jour-là. */
export function semaine(c: Contexte | null): (Weather | null)[] {
  const jours = new Map((c?.meteo.valeur?.jours ?? []).map((j) => [j.date, j]));
  return Array.from({ length: 14 }, (_, i) => {
    const j = jours.get(parisDay(i));
    if (!j) return null;
    return { t: j.max, low: j.min, kind: KIND[j.ciel] ?? 'nuages', label: j.libelle };
  });
}

/** Il fait nuit : avant 7 h ou après 21 h à Paris (le serveur ne donne le lever et le coucher qu'à l'app mobile). */
function nuit(at = new Date()): boolean {
  const h = Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }).format(at));
  return h < 7 || h >= 21;
}

/** La température et le ciel du moment, si la météo est connue. `mot` : « ciel dégagé » la nuit. */
export function maintenant(c: Contexte | null): { t: number; kind: Kind; mot?: string } | null {
  const m = c?.meteo.valeur?.maintenant;
  if (!m) return null;
  const kind = KIND[m.ciel] ?? 'nuages';
  return { t: m.t, kind, mot: kind === 'soleil' && nuit() ? 'ciel dégagé' : undefined };
}

/** Le jour férié d'une date AAAA-MM-JJ, s'il y en a un. */
export const ferieDu = (c: Contexte | null, day: string) => c?.feries.valeur?.find((f) => f.date === day) ?? null;

/** « mise à jour 9 h 10 » : l'heure à laquelle la donnée a été relue, à Paris. */
function heureMaj(iso: string): string {
  const d = new Date(iso);
  // Un seul morceau de la date, sans l'unité que le français ajoute (« 23 h »).
  const part = (type: 'hour' | 'minute' | 'day' | 'month') =>
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hourCycle: 'h23', hour: 'numeric', minute: '2-digit', day: 'numeric', month: '2-digit' })
      .formatToParts(d)
      .find((p) => p.type === type)?.value ?? '';
  // Espaces insécables : « 21 h 20 » ne se coupe jamais en fin de ligne.
  const heure = `${Number(part('hour'))} h ${part('minute')}`;
  const jour = (x: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(x);
  if (jour(d) === jour(new Date())) return heure;
  const hier = new Date(Date.now() - 86_400_000);
  return jour(d) === jour(hier) ? `hier, ${heure}` : `le ${part('day')}/${part('month')}, ${heure}`;
}

/**
 * La ligne de crédit à montrer en petit sous une donnée : la source (que sa
 * licence demande de citer) et l'heure de mise à jour. Toute donnée affichée
 * porte sa source et son heure (règle du projet).
 */
export function credit(blocs: (Bloc<unknown> | undefined | null)[]): string | null {
  const lignes = blocs.flatMap((b) => {
    if (!b || b.etat === 'indisponible' || b.valeur === null) return [];
    const quand = b.maj ? `mise à jour ${heureMaj(b.maj)}` : '';
    if (b.etat === 'ancien') return [`${b.mention ?? ''} · ${quand}, la source ne répond pas pour l’instant`];
    return [[b.mention, quand].filter(Boolean).join(' · ')];
  });
  const uniques = [...new Set(lignes.filter(Boolean))];
  return uniques.length ? uniques.join(' · ') : null;
}

/**
 * Les tendances qui montent ET que le dressing a déjà : « pas besoin
 * d'acheter ». Seulement les vraies hausses (10 % et plus) ; la sélection de
 * saison du serveur (variation null) passe aussi, faute de mieux.
 */
export function tendancesChezToi<P extends { kind: string | null }>(c: Contexte | null, pieces: P[]): { t: Tendance; pieces: P[] }[] {
  const liste = c?.tendances.valeur ?? [];
  return liste
    .filter((t) => t.variation === null || t.variation >= 10)
    .map((t) => ({ t, pieces: pieces.filter((p) => p.kind === t.kind) }))
    .filter((x) => x.pieces.length > 0);
}
