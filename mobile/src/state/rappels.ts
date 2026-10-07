/**
 * Les rappels (07/10) : ce que le téléphone annonce, selon l'accord donné.
 *
 * - « planning » : la veille d'un jour où une tenue est prévue ou d'un
 *   rendez-vous, une heure et demie avant un rendez-vous important, et deux
 *   jours avant un départ en voyage ;
 * - « tout » : en plus, la tenue du jour chaque matin (programmée à part,
 *   en rappel quotidien) ;
 * - « non » : rien.
 *
 * Logique pure, sans module natif : la programmation est dans
 * `notifications.ts`. Des notifications locales, posées sur le téléphone,
 * jamais envoyées par un serveur.
 */
import { addDays, dateOf, timeLabel, type Iso, type RdvEvent, type Trip } from './planning';
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

export function rappels(
  choix: NotifChoice | null,
  s: { planned: Record<Iso, Planned>; events: RdvEvent[]; trips: Trip[] },
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
        texte: tenue ? `Ta tenue « ${tenue.title} » est prête.` : 'Kode peut préparer ta tenue en un geste.',
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

  for (const t of s.trips) {
    out.push({ id: `depart-${t.id}`, quand: at(addDays(t.start, -2), 18), titre: `Départ pour ${t.destination} dans deux jours`, texte: 'Tes tenues et ta valise t’attendent.', date: t.start });
  }

  return out
    .filter((r) => r.quand.getTime() > now.getTime() + 60_000)
    .sort((a, b) => a.quand.getTime() - b.quand.getTime())
    .slice(0, MAX_RAPPELS);
}
