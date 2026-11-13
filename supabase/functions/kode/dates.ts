/** Les dates de Kodi, à l'heure de Paris. Logique pure. */

export const PARIS = 'Europe/Paris';

/** Jour au format AAAA-MM-JJ à Paris, décalé de `offset` jours. */
export function parisDay(offset = 0, now = new Date()): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS }).format(now);
  return shift(today, offset);
}

/** Le jour `day` décalé de `n` jours. */
export function shift(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const weekday = (day: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${day}T12:00:00Z`));

/** « jeudi 9 octobre », « samedi 1er novembre ». */
export const dayLabel = (day: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(`${day}T12:00:00Z`))
    .replace(/ 1 /, ' 1er ');

/** « jeudi 13 novembre 2026 » pour un jour donné. */
export const fullLabel = (day: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${day}T12:00:00Z`));

/** Nombre de jours de `a` à `b` (AAAA-MM-JJ). */
export const joursEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
