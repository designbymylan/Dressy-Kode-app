/**
 * Le contexte du jour en quelques lignes de français, pour Kodi. Seules
 * les données connues y figurent ; une valeur ancienne porte son heure.
 * Kodi ne cite pas ses sources dans la conversation : la mention reste à
 * l'écran, à côté de la donnée.
 */
import type { Bloc } from './types.ts';
import type { Contexte } from './contexte.ts';
import { plusJours, quand } from './temps.ts';

/** « dimanche 1er novembre ». */
const jourLong = (jour: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(`${jour}T12:00:00Z`))
    .replace(/ 1 /, ' 1er ');

const mm = (x: number) => `${String(x).replace('.', ',')} mm`;

const heure = (hhmm: string) => {
  const [h, m] = hhmm.split(':');
  return `${Number(h)} h ${m}`;
};

const signe = (n: number) => `${n > 0 ? '+' : ''}${n} %`;

/** La ligne d’un bloc, ou rien s’il est indisponible ; « (donnée du 2 octobre à 9 h 10, pas plus récente) » s’il est ancien. */
function ligne<T>(b: Bloc<T>, f: (v: T) => string | null): string | null {
  if (b.valeur === null || b.etat === 'indisponible') return null;
  const texte = f(b.valeur);
  if (!texte) return null;
  return b.etat === 'ancien' && b.maj ? `${texte} (donnée du ${quand(b.maj)}, pas plus récente)` : texte;
}

export function contexteTexte(c: Contexte): string {
  const dans = (jours: number) => plusJours(c.jour, jours);
  const lignes = [
    ligne(c.ville, (v) => `Ville : ${v.nom}.`),
    ligne(c.meteo, (m) => {
      const n = m.maintenant;
      const jours = m.jours.slice(0, 7).map((j) =>
        `${jourLong(j.date)} ${j.min}° à ${j.max}°, ${j.libelle}${j.pluie ? `, ${mm(j.pluie)} de pluie` : ''}${j.uv && j.uv >= 3 ? `, UV ${j.uv}` : ''}`,
      );
      return `Météo maintenant : ${n.t}°${n.ressenti !== null && n.ressenti !== n.t ? ` (ressenti ${n.ressenti}°)` : ''}${n.vent !== null && n.vent >= 30 ? `, vent ${n.vent} km/h` : ''}.\nMétéo des prochains jours : ${jours.join(' ; ')}.`;
    }),
    ligne(c.air, (a) => {
      const bouts = [a.qualite && `qualité de l’air ${a.qualite}`, a.pollens.length ? `pollens : ${a.pollens.map((p) => p.nom).join(', ')}` : null].filter(Boolean);
      return bouts.length ? `Air : ${bouts.join(' ; ')}.` : null;
    }),
    ligne(c.soleil, (s) => `Soleil : lever ${heure(s.lever)}, coucher ${heure(s.coucher)}.`),
    ligne(c.feries, (l) => {
      const proches = l.filter((f) => f.date <= dans(60));
      return proches.length ? `Jours fériés des deux prochains mois : ${proches.map((f) => `${f.nom} (${jourLong(f.date)})`).join(' ; ')}.` : null;
    }),
    ligne(c.ponts, (l) => {
      const proches = l.filter((p) => p.debut <= dans(90));
      return proches.length
        ? `Week-ends prolongés à venir : ${proches.map((p) => `du ${jourLong(p.debut)} au ${jourLong(p.fin)}${p.aPoser ? ` (${p.aPoser} jour à poser)` : ''}`).join(' ; ')}.`
        : null;
    }),
    ligne(c.vacances, (l) => {
      const proches = l.slice(0, 2);
      return proches.length ? `Vacances scolaires : ${proches.map((v) => `${v.nom} du ${jourLong(v.debut)} au ${jourLong(v.fin)}`).join(' ; ')}.` : null;
    }),
    ligne(c.tendances, (l) => {
      if (l.every((t) => t.variation === null)) return `Pièces de saison : ${l.map((t) => t.libelle.toLowerCase()).join(', ')}.`;
      const monte = l.filter((t) => (t.variation ?? 0) >= 10).slice(0, 5);
      return monte.length ? `Pièces qui intéressent de plus en plus cette semaine : ${monte.map((t) => `${t.libelle.toLowerCase()} ${signe(t.variation!)}`).join(', ')}.` : null;
    }),
    ligne(c.fete, (f) => `Fête du jour : ${f.prenoms}.`),
  ].filter(Boolean);
  return lignes.length ? `Ce que l’on sait du jour :\n${lignes.join('\n')}` : '';
}
