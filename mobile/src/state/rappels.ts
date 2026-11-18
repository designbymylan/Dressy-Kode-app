/**
 * Les rappels (07/10) : ce que le téléphone annonce, selon l'accord donné.
 *
 * - « planning » : la veille d'un jour où une tenue est prévue ou d'un
 *   rendez-vous, une heure et demie avant un rendez-vous important, deux
 *   jours avant un départ en voyage, et deux jours avant un rendez-vous qui
 *   n'a pas encore de tenue ;
 * - « tout » : en plus, la tenue du jour chaque matin (programmée à part,
 *   en rappel quotidien), le bilan de la semaine le dimanche à 18 h (qui
 *   demande aussi si un événement arrive quand la semaine suivante est vide),
 *   et un coup de pouce du soir : « rien de prévu pour demain » (20 h), qui
 *   demande aussi, si la tenue du jour n'est pas notée, « tu l'as portée ? » ;
 * - « non » : rien.
 *
 * Le coup de pouce du soir reste rare (18/11) : jamais un soir où un autre
 * rappel part déjà, jamais pour qui n'a pas trois pièces,
 * et un seul programmé à la fois, pour qu'une personne qui n'ouvre plus l'app
 * n'en reçoive pas un chaque soir. Tout est reprogrammé à chaque
 * changement d'état (`useRappels.ts`) : une tenue prévue ou portée retire le
 * rappel devenu inutile.
 *
 * Logique pure, sans module natif : la programmation est dans
 * `notifications.ts`. Des notifications locales, posées sur le téléphone,
 * jamais envoyées par un serveur.
 */
import { addDays, dateOf, isoFromDate, timeLabel, type Iso, type RdvEvent, type Trip } from './planning';
import type { NotifChoice, Planned } from './remote';

export type Rappel = { id: string; quand: Date; titre: string; texte: string; date: Iso };

/** iOS garde 64 notifications programmées au plus : on s'en tient aux prochaines. */
export const MAX_RAPPELS = 40;

/** L'heure du rappel quotidien, quand tout est accepté. */
export const MATIN = { hour: 7, minute: 30 };

const at = (iso: Iso, h: number, m = 0) => {
  const d = dateOf(iso);
  d.setHours(h, m, 0, 0);
  return d;
};

const IMPORTANT = new Set(['Important', 'Décisif']);

/** Il faut au moins trois pièces pour qu'une tenue soit possible : avant, on n'insiste pas. */
const PIECES_MINI = 3;

export function rappels(
  choix: NotifChoice | null,
  s: { planned: Record<Iso, Planned>; events: RdvEvent[]; trips: Trip[]; journal?: Record<Iso, string[]>; nbPieces?: number },
  now: Date,
): Rappel[] {
  if (choix !== 'tout' && choix !== 'planning') return [];
  const out: Rappel[] = [];
  const days = new Set([...Object.keys(s.planned), ...s.events.map((e) => e.date)]);

  for (const day of days) {
    const tenue = s.planned[day];
    const evs = s.events.filter((e) => e.date === day).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
    const first = evs[0];
    const quand = first?.time ? ` à ${timeLabel(first.time)}` : '';
    if (first) {
      out.push({
        id: `veille-${day}`,
        quand: at(addDays(day, -1), 19),
        titre: `Demain : ${first.title}${quand}`,
        texte: tenue ? `Ta tenue « ${tenue.title} » est prête.` : 'Kodi peut préparer ta tenue en un geste.',
        date: day,
      });
    } else if (tenue) {
      out.push({ id: `veille-${day}`, quand: at(addDays(day, -1), 20), titre: 'Demain, ta tenue est prête', texte: `« ${tenue.title} »`, date: day });
    }
    // Un rendez-vous qui compte : un dernier mot avant d'y aller.
    for (const e of evs) {
      if (!e.time || !e.stake || !IMPORTANT.has(e.stake)) continue;
      const [h, m] = e.time.split(':').map(Number);
      const d = at(day, h, m);
      d.setMinutes(d.getMinutes() - 90);
      out.push({ id: `avant-${e.id}`, quand: d, titre: `Dans 1 h 30 : ${e.title}`, texte: tenue ? 'Ta tenue est prête, tu n’as plus qu’à l’enfiler.' : 'Un coup d’œil à ta tenue avant de partir ?', date: day });
    }
  }

  // Un rendez-vous dans deux jours sans tenue : de quoi s'y prendre à temps (un seul rappel par jour).
  for (const day of days) {
    const premier = s.events.filter((e) => e.date === day).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))[0];
    if (!premier || s.planned[day]) continue;
    out.push({
      id: `sans-tenue-${day}`,
      quand: at(addDays(day, -2), 18),
      titre: `Dans deux jours : ${premier.title}`,
      texte: 'Pas encore de tenue prévue. Kodi peut la préparer en un geste.',
      date: day,
    });
  }

  for (const t of s.trips) {
    out.push({ id: `depart-${t.id}`, quand: at(addDays(t.start, -2), 18), titre: `Départ pour ${t.destination} dans deux jours`, texte: 'Tes tenues et ta valise t’attendent.', date: t.start });
  }

  // Tout accepté : le bilan de la semaine, les deux prochains dimanches à 18 h (09/10).
  // Si la semaine suivante est vide, il demande aussi si un événement arrive : un seul message.
  if (choix === 'tout') {
    for (let k = 0; k < 2; k++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((7 - now.getDay()) % 7) + 7 * k);
      const iso = isoFromDate(d);
      const vide = !Array.from({ length: 7 }, (_, i) => addDays(iso, i + 1)).some((j) => s.planned[j] || s.events.some((e) => e.date === j));
      out.push({
        id: `bilan-${iso}`,
        quand: at(iso, 18),
        titre: 'Ton bilan de la semaine',
        texte: vide
          ? 'Ce que tu as porté, ce qui dort. La semaine qui vient est vide : un événement en vue ? Kodi prépare tes tenues.'
          : 'Ce que tu as porté, ce qui dort, et Kodi qui prépare la semaine qui vient.',
        date: iso,
      });
    }

    // Le coup de pouce du soir : « rien de prévu pour demain », un seul, sur l'un des deux prochains soirs,
    // et seulement si une tenue est possible. Un soir où un autre rappel part déjà, on n'en ajoute pas.
    if ((s.nbPieces ?? 0) >= PIECES_MINI) {
      const aujourdhui = isoFromDate(now);
      const pris = new Set(out.map((r) => isoFromDate(r.quand)));
      for (let k = 0; k < 2; k++) {
        const jour = addDays(aujourdhui, k);
        const demain = addDays(jour, 1);
        const rien = !s.planned[demain] && !s.events.some((e) => e.date === demain);
        if (pris.has(jour) || !rien || at(jour, 20).getTime() <= now.getTime() + 60_000) continue;
        out.push({ id: `demain-vide-${jour}`, quand: at(jour, 20), titre: 'Rien de prévu pour demain', texte: 'Un événement, une envie ? Kodi te prépare une tenue en un geste.', date: demain });
        break; // le suivant attend que la personne revienne
      }
      // Ce soir, si la tenue du jour n'est pas notée : la question se glisse dans le rappel du soir, sans en ajouter un.
      const soir = out.find((r) => r.id === `veille-${addDays(aujourdhui, 1)}` || r.id === `demain-vide-${aujourdhui}`);
      if (soir && !(s.journal?.[aujourdhui]?.length ?? 0)) soir.texte += ' Et ta tenue d’aujourd’hui, tu l’as portée ? Note-la.';
    }
  }

  return out
    .filter((r) => r.quand.getTime() > now.getTime() + 60_000)
    .sort((a, b) => a.quand.getTime() - b.quand.getTime())
    .slice(0, MAX_RAPPELS);
}
