/**
 * Les week-ends prolongés, calculés à partir des jours fériés : un férié
 * le lundi ou le vendredi donne trois jours, le mardi ou le jeudi quatre
 * jours avec un pont à poser. Même règle que caldays.com (vérifié dans
 * les tests), mais pour l'année en cours ET la suivante, et pour chaque
 * zone (Alsace-Moselle, outre-mer).
 */
import type { Ferie, Pont } from './types.ts';
import { plusJours, jourSemaine } from './temps.ts';

export function ponts(feries: Ferie[]): Pont[] {
  const bruts: Pont[] = [];
  for (const f of feries) {
    const j = jourSemaine(f.date);
    if (j === 1) bruts.push({ debut: plusJours(f.date, -2), fin: f.date, jours: 3, aPoser: 0, feries: [f.nom] });
    else if (j === 5) bruts.push({ debut: f.date, fin: plusJours(f.date, 2), jours: 3, aPoser: 0, feries: [f.nom] });
    else if (j === 2) bruts.push({ debut: plusJours(f.date, -3), fin: f.date, jours: 4, aPoser: 1, feries: [f.nom] });
    else if (j === 4) bruts.push({ debut: f.date, fin: plusJours(f.date, 3), jours: 4, aPoser: 1, feries: [f.nom] });
  }
  bruts.sort((a, b) => a.debut.localeCompare(b.debut));
  // Deux fériés qui se touchent (Noël un jeudi, le 26 décembre en Alsace) font un seul long week-end.
  const out: Pont[] = [];
  for (const p of bruts) {
    const der = out[out.length - 1];
    if (der && p.debut <= plusJours(der.fin, 1)) {
      const fin = p.fin > der.fin ? p.fin : der.fin;
      const jours = Math.round((Date.parse(fin) - Date.parse(der.debut)) / 86_400_000) + 1;
      const feriesDedans = feries.filter((f) => f.date >= der.debut && f.date <= fin).length;
      const weekend = Array.from({ length: jours }, (_, i) => jourSemaine(plusJours(der.debut, i))).filter((d) => d === 0 || d === 6).length;
      out[out.length - 1] = { debut: der.debut, fin, jours, aPoser: Math.max(0, jours - weekend - feriesDedans), feries: [...der.feries, ...p.feries] };
    } else out.push(p);
  }
  return out;
}
