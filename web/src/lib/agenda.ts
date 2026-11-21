/**
 * Tout ce que le calendrier lit, en une fois et en parallèle : les tenues
 * prévues (avec leurs vignettes), les rendez-vous, les voyages, le nombre de
 * pièces, les données du jour (météo, fériés, vacances…).
 *
 * Deux vues, comme sur l'app mobile : la semaine (aujourd'hui et les treize
 * jours suivants, avec la météo de chacun, c'est l'Agenda) et le mois (le
 * Planning : un mois en grand, du mois dernier à l'an prochain). Le jour
 * ouvert, la vue et le mois voyagent dans l'adresse (?jour=, ?vue=, ?mois=).
 */
import type { createClient } from '@/lib/supabase/server';
import type { Viewer } from '@/lib/space';
import { parisDay } from '@/lib/dates';
import { outfitViews, OUTFIT_SELECT, type OutfitPiece, type OutfitRow } from '@/lib/kode';
import { loadContexte, semaine, type Contexte, type Weather } from '@/lib/contexte';
import { ISO, addDays, monthGrid, monthKey, offsetOf, shiftMonth, type Iso, type RdvEvent, type Setting, type Stake } from '@/lib/planning';
import { canCompose } from '@/lib/outfits';

type Db = Awaited<ReturnType<typeof createClient>>;

export type Vue = 'semaine' | 'mois';

/** La tenue posée sur un jour. */
export type PlannedDay = { worn: boolean; outfit: { id: string; title: string; pieces: OutfitPiece[] } };

export type CalTrip = { id: string; destination: string; starts_on: string; ends_on: string; purpose: string | null };

export type Agenda = {
  today: Iso;
  /** Le jour ouvert. */
  day: Iso;
  vue: Vue;
  /** Le mois affiché dans la vue « mois » (AAAA-MM). */
  month: string;
  /** La météo des 14 prochains jours (index 0 : aujourd'hui). */
  weather: (Weather | null)[];
  contexte: Contexte | null;
  planned: Record<Iso, PlannedDay>;
  events: RdvEvent[];
  /** Les rendez-vous qui suivent le jour ouvert. */
  later: RdvEvent[];
  trips: CalTrip[];
  /** Un haut et un bas, ou une robe : de quoi composer une tenue. */
  ready: boolean;
  pieces: number;
};

/** Le mois le plus ancien et le plus lointain que l'on ouvre : le mois dernier, et l'an qui vient. */
const MOIS_AVANT = 1;
const MOIS_APRES = 12;

/** Lit les paramètres de l'adresse et les ramène à des valeurs permises. */
export function agendaParams(raw: { jour?: string; vue?: string; mois?: string }, today: Iso): { day: Iso; vue: Vue; month: string } {
  const jour = String(raw.jour ?? '');
  let day = ISO.test(jour) && offsetOf(jour, today) >= -62 && offsetOf(jour, today) <= 400 ? jour : today;
  const o = offsetOf(day, today);
  // La semaine ne couvre que les deux semaines qui viennent : un autre jour s'ouvre dans le mois.
  const vue: Vue = raw.vue === 'mois' || o < 0 || o > 13 ? 'mois' : 'semaine';
  const lo = shiftMonth(monthKey(today), -MOIS_AVANT);
  const hi = shiftMonth(monthKey(today), MOIS_APRES);
  const asked = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(raw.mois ?? '')) ? String(raw.mois) : monthKey(day);
  const month = asked < lo ? lo : asked > hi ? hi : asked;
  if (!ISO.test(day)) day = today;
  return { day, vue, month };
}

type EventRow = {
  id: string; day: string; starts_at: string | null; title: string; kind: string | null; dress_code: string | null; stake: Stake | null;
  impressions: string[] | null; place: string | null; setting: Setting | null; flags: string[] | null; note: string | null;
};
const EVENT_SELECT = 'id, day, starts_at, title, kind, dress_code, stake, impressions, place, setting, flags, note';
const toEvent = (r: EventRow): RdvEvent => ({
  id: r.id,
  date: r.day.slice(0, 10),
  time: r.starts_at ? r.starts_at.slice(0, 5) : null,
  title: r.title,
  kind: r.kind,
  dressCode: r.dress_code,
  stake: r.stake,
  impressions: r.impressions ?? [],
  place: r.place,
  setting: r.setting,
  constraints: r.flags ?? [],
  note: r.note,
});

export async function loadAgenda(supabase: Db, viewer: Viewer, raw: { jour?: string; vue?: string; mois?: string }): Promise<Agenda> {
  const today = parisDay(0);
  const { day, vue, month } = agendaParams(raw, today);

  // La fenêtre lue : la semaine (deux semaines) ou le mois, et toujours le jour ouvert.
  const grid = monthGrid(month).flat().filter((d): d is Iso => !!d);
  const from0 = vue === 'semaine' ? today : grid[0];
  const to0 = vue === 'semaine' ? addDays(today, 13) : grid[grid.length - 1];
  const from = day < from0 ? day : from0;
  const to = day > to0 ? day : to0;

  const [planned, events, later, trips, garments, contexte] = await Promise.all([
    supabase
      .from('planned_days')
      .select(`day, worn, outfits(${OUTFIT_SELECT})`)
      .eq('space_id', viewer.spaceId)
      .gte('day', from)
      .lte('day', to),
    supabase
      .from('events')
      .select(EVENT_SELECT)
      .eq('space_id', viewer.spaceId)
      .gte('day', from)
      .lte('day', to)
      .order('starts_at', { nullsFirst: false }),
    supabase
      .from('events')
      .select(EVENT_SELECT)
      .eq('space_id', viewer.spaceId)
      .gt('day', day)
      .order('day')
      .order('starts_at', { nullsFirst: false })
      .limit(5),
    supabase
      .from('trips')
      .select('id, destination, starts_on, ends_on, purpose')
      .eq('space_id', viewer.spaceId)
      .gte('ends_on', today)
      .order('starts_on')
      .limit(10),
    supabase.from('garments').select('category_id').eq('status', 'active'),
    loadContexte(supabase),
  ]);

  const rows = ((planned.data ?? []) as unknown as { day: string; worn: boolean; outfits: OutfitRow | null }[]).filter((r) => r.outfits);
  const views = await outfitViews(supabase, rows.map((r) => ({ outfit: r.outfits! })));
  const byDay: Record<Iso, PlannedDay> = {};
  for (const r of rows) {
    const v = views.get(r.outfits!.id);
    if (v) byDay[r.day.slice(0, 10)] = { worn: r.worn, outfit: { id: v.id, title: v.title, pieces: v.pieces } };
  }

  const cats = ((garments.data ?? []) as { category_id: string }[]);
  return {
    today,
    day,
    vue,
    month,
    weather: semaine(contexte),
    contexte,
    planned: byDay,
    events: ((events.data ?? []) as EventRow[]).map(toEvent),
    later: ((later.data ?? []) as EventRow[]).map(toEvent),
    trips: ((trips.data ?? []) as CalTrip[]).map((t) => ({ ...t, starts_on: t.starts_on.slice(0, 10), ends_on: t.ends_on.slice(0, 10) })),
    ready: canCompose(cats),
    pieces: cats.length,
  };
}

/** Les tenues déjà enregistrées, les plus récentes d'abord : on en pose une sur un jour. */
export async function loadSavedOutfits(supabase: Db, viewer: Viewer, limit = 24) {
  const { data } = await supabase
    .from('outfits')
    .select(OUTFIT_SELECT)
    .eq('space_id', viewer.spaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as unknown as OutfitRow[];
  const views = await outfitViews(supabase, rows.map((outfit) => ({ outfit })));
  return rows.map((r) => views.get(r.id)).filter((v): v is NonNullable<typeof v> => !!v);
}
