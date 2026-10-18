/** Les dates des données, toujours à l'heure de Paris. */

export const PARIS = 'Europe/Paris';

const jourFmt = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS, year: 'numeric', month: '2-digit', day: '2-digit' });
const heureFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, hour: 'numeric', hourCycle: 'h23' });

/** AAAA-MM-JJ à Paris pour un instant donné. */
export const jourParis = (d: Date | string = new Date()) => jourFmt.format(typeof d === 'string' ? new Date(d) : d);

/** L'heure (0 à 23) à Paris pour un instant donné. */
export const heureParis = (d: Date | string) => Number(heureFmt.format(typeof d === 'string' ? new Date(d) : d));

/** Décale un jour AAAA-MM-JJ de `n` jours. */
export function plusJours(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 dimanche … 6 samedi. */
export const jourSemaine = (jour: string) => new Date(`${jour}T12:00:00Z`).getUTCDay();

/** « 2 octobre à 9 h 10 », pour dire de quand date une valeur. */
export function quand(iso: string): string {
  const d = new Date(iso);
  const jour = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, day: 'numeric', month: 'long' }).format(d);
  const [h, m] = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(d)
    .split(':');
  return `${jour} à ${Number(h)} h ${m}`;
}
