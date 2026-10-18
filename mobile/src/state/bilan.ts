/**
 * Le bilan du dimanche (09/10) : la semaine en tenues, ce qui a été porté,
 * ce qui dort, ce que Kode a retenu des « Pas pour moi », et la semaine qui
 * vient. Une raison de revenir chaque semaine, sans culpabiliser : une
 * semaine sans tenue notée se tourne vers la suivante.
 *
 * Le dimanche et le lundi, c'est la semaine qui finit (ou vient de finir) ;
 * les autres jours, la semaine en cours jusqu'à aujourd'hui.
 */
import type { Piece } from '../data/wardrobe';
import { addDays, isoFromDate, isoOf, offsetOf, type Iso } from './planning';
import type { Ecart, Raison } from './ecarts';
import type { Planned } from './remote';
import type { RdvEvent } from './planning';

/** Le lundi de la semaine couverte, et son dimanche. */
export function semaineCouverte(now = new Date()): { debut: Iso; fin: Iso } {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const jour = d.getDay(); // 0 : dimanche
  // Lundi : on regarde la semaine qui vient de finir.
  const back = jour === 0 ? 6 : jour === 1 ? 7 : jour - 1;
  d.setDate(d.getDate() - back);
  const debut = isoFromDate(d);
  return { debut, fin: addDays(debut, 6) };
}

/** Le bilan se montre à l'accueil le dimanche et le lundi. */
export const jourDeBilan = (now = new Date()) => now.getDay() === 0 || now.getDay() === 1;

export type Bilan = {
  debut: Iso;
  fin: Iso;
  /** Les sept jours, du lundi au dimanche ; `futur` : pas encore arrivé. */
  jours: { date: Iso; pieces: string[]; futur: boolean }[];
  /** Jours habillés (une tenue notée). */
  habilles: number;
  /** Pièces différentes portées. */
  portees: string[];
  /** Part du dressing portée cette semaine, en %. */
  part: number;
  /** La pièce la plus portée de la semaine (deux ports au moins). */
  fetiche: { id: string; fois: number } | null;
  nouvelles: number;
  ecartees: number;
  /** La raison la plus donnée aux « Pas pour moi » de la semaine. */
  raison: Raison | null;
  /** La semaine qui vient : rendez-vous et tenues déjà prévues. */
  aVenir: { rdv: number; prevues: number };
};

/**
 * Ce qui a été porté, jour par jour : le journal (« Je la porte »), complété
 * par la date du dernier port de chaque pièce (utile au compte de
 * démonstration et aux ports notés avant le journal).
 */
function porteLe(journal: Record<Iso, string[]>, pieces: Piece[], date: Iso): string[] {
  const ids = new Set(journal[date] ?? []);
  const ago = -offsetOf(date);
  for (const p of pieces) if (p.lastWorn === ago) ids.add(p.id);
  const known = new Set(pieces.map((p) => p.id));
  return [...ids].filter((id) => known.has(id));
}

export function bilanDe(
  s: { pieces: Piece[]; journal: Record<Iso, string[]>; ecarts: Ecart[]; events: RdvEvent[]; planned: Record<Iso, Planned> },
  now = new Date(),
): Bilan {
  const { debut, fin } = semaineCouverte(now);
  const today = isoFromDate(now);
  const jours = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(debut, i);
    const futur = date > today;
    return { date, pieces: futur ? [] : porteLe(s.journal, s.pieces, date), futur };
  });
  const fois = new Map<string, number>();
  for (const j of jours) for (const id of j.pieces) fois.set(id, (fois.get(id) ?? 0) + 1);
  const best = [...fois].sort((a, b) => b[1] - a[1])[0];
  const semaine = s.ecarts.filter((e) => e.date >= debut && e.date <= fin);
  const parRaison = new Map<Raison, number>();
  for (const e of semaine) if (e.raison !== 'sans') parRaison.set(e.raison, (parRaison.get(e.raison) ?? 0) + 1);
  const raison = [...parRaison].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  // La semaine qui vient : du lendemain de la semaine couverte, sept jours.
  const suite = Array.from({ length: 7 }, (_, i) => addDays(fin, i + 1)).filter((d) => d >= isoOf(0));
  return {
    debut,
    fin,
    jours,
    habilles: jours.filter((j) => j.pieces.length > 0).length,
    portees: [...fois.keys()],
    part: s.pieces.length ? Math.round((fois.size / s.pieces.length) * 100) : 0,
    fetiche: best && best[1] >= 2 ? { id: best[0], fois: best[1] } : null,
    nouvelles: s.pieces.filter((p) => p.addedDaysAgo <= 6).length,
    ecartees: semaine.length,
    raison,
    aVenir: { rdv: s.events.filter((e) => suite.includes(e.date)).length, prevues: suite.filter((d) => s.planned[d]).length },
  };
}

/** « Ce que Kode a retenu » : la raison la plus donnée, dite simplement. */
export const RETENU: Record<Exclude<Raison, 'sans'>, string> = {
  style: 'des tenues plus proches de ton style',
  couleurs: 'des couleurs mieux accordées',
  confort: 'des tenues où tu es à l’aise',
  meteo: 'des tenues plus justes pour la météo',
  journee: 'des tenues mieux pensées pour tes journées',
  piece: 'moins souvent les pièces que tu as écartées',
};
