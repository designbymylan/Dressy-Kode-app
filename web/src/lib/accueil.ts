/**
 * Tout ce que l'accueil lit, en une seule fois et en parallèle : le dressing
 * avec ses ports, la tenue prévue aujourd'hui et les six jours suivants, les
 * rendez-vous, le voyage à venir, les tenues déjà écartées (« Pas pour moi »)
 * et les données du jour (météo, fériés, tendances).
 *
 * Le calcul des tenues proposées vit dans lib/outfits.ts, partagé avec le
 * navigateur ; ici, seulement la lecture de la base et la mise en forme.
 */
import type { createClient } from '@/lib/supabase/server';
import type { Viewer } from '@/lib/space';
import { parisDay } from '@/lib/dates';
import { loadPieces } from '@/lib/garments';
import { outfitViews, OUTFIT_SELECT, type OutfitPiece, type OutfitRow } from '@/lib/kode';
import { colourHex } from '@/lib/onboarding';
import { ferieDu, loadContexte, maintenant, semaine, type Contexte, type Weather } from '@/lib/contexte';
import { cleTenue, evite, suggestOutfits, type HomePiece, type Outfit } from '@/lib/outfits';

type Db = Awaited<ReturnType<typeof createClient>>;

/** Un rendez-vous, juste ce que l'accueil en montre. */
export type HomeEvent = { id: string; day: string; title: string; time: string | null };

/** Un jour de « Ta semaine » : son temps, sa tenue prévue, son rendez-vous ou son jour férié. */
export type WeekDay = {
  day: string;
  offset: number;
  weather: Weather | null;
  outfit: { id: string; title: string; pieces: OutfitPiece[] } | null;
  /** Le premier rendez-vous du jour. */
  event: string | null;
  /** Ce qui se lit sous la carte : le rendez-vous, sinon le jour férié. */
  note: string | null;
};

export type HomeTrip = { id: string; destination: string; starts_on: string; ends_on: string };

export type Home = {
  pieces: HomePiece[];
  /** Les tenues du jour : celle déjà prévue d'abord, puis les propositions. */
  outfits: Outfit[];
  /** La tenue prévue pour aujourd'hui, déjà portée ? */
  worn: boolean;
  /** Jours de suite, jusqu'à hier compris, où un port a été noté (la série, 10/11). */
  streak: number;
  weather: Weather | null;
  now: ReturnType<typeof maintenant>;
  city: string | null;
  /** Une ville est donnée dans les réglages (même si la météo n'a pas encore répondu). */
  hasCity: boolean;
  eventsToday: number;
  /** Ce que la personne a dit vivre : « travail », « sorties »… (questionnaire). */
  /** Aujourd'hui puis les six jours suivants (index 0 : aujourd'hui). */
  week: WeekDay[];
  trip: HomeTrip | null;
  contexte: Contexte | null;
};

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DAY_MS;

export async function loadHome(supabase: Db, viewer: Viewer): Promise<Home> {
  const today = parisDay(0);
  const since = new Date(Date.now() - 92 * DAY_MS).toISOString();

  const [garments, stats, planned, events, trips, feedback, contexte, wornDays] = await Promise.all([
    loadPieces(supabase),
    supabase.from('garment_stats').select('garment_id, wear_count, last_worn_on').eq('space_id', viewer.spaceId),
    supabase
      .from('planned_days')
      .select(`day, worn, outfits(${OUTFIT_SELECT})`)
      .eq('space_id', viewer.spaceId)
      .gte('day', today)
      .lte('day', parisDay(6)),
    supabase
      .from('events')
      .select('id, day, title, starts_at')
      .eq('space_id', viewer.spaceId)
      .gte('day', today)
      .lte('day', parisDay(6))
      .order('starts_at', { nullsFirst: false }),
    supabase
      .from('trips')
      .select('id, destination, starts_on, ends_on')
      .eq('space_id', viewer.spaceId)
      .gte('ends_on', today)
      .order('starts_on')
      .limit(1),
    supabase
      .from('outfit_feedback')
      .select('garment_ids, reason, target_ids, created_at')
      .eq('space_id', viewer.spaceId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),
    loadContexte(supabase),
    // Les jours où un port a été noté, sur deux mois : de quoi compter la série.
    supabase.from('wears').select('worn_on, garments!inner(space_id)').eq('garments.space_id', viewer.spaceId).gte('worn_on', parisDay(-62)).lt('worn_on', today),
  ]);

  const statOf = new Map(
    ((stats.data ?? []) as { garment_id: string; wear_count: number | null; last_worn_on: string | null }[]).map((s) => [s.garment_id, s]),
  );
  const todayN = dayNumber(today);
  const pieces: HomePiece[] = garments.map((g) => {
    const st = statOf.get(g.id);
    return {
      id: g.id,
      name: g.name,
      category_id: g.category_id,
      kind: g.kind,
      colour: g.colors[0] ? colourHex(g.colors[0]) : null,
      url: g.url,
      wears: st?.wear_count ?? 0,
      lastWorn: st?.last_worn_on ? Math.max(0, todayN - dayNumber(st.last_worn_on)) : null,
      addedDaysAgo: Math.max(0, todayN - dayNumber(g.created_at.slice(0, 10))),
      season: g.season,
    };
  });
  const known = new Set(pieces.map((p) => p.id));

  // Les tenues prévues, avec leurs vignettes signées en un seul aller-retour.
  const rows = ((planned.data ?? []) as unknown as { day: string; worn: boolean; outfits: OutfitRow | null }[]).filter((r) => r.outfits);
  const views = await outfitViews(supabase, rows.map((r) => ({ outfit: r.outfits! })));
  const plannedOn = new Map(rows.map((r) => [r.day, { worn: r.worn, view: views.get(r.outfits!.id) ?? null }]));

  const weekWeather = semaine(contexte);
  const weather = weekWeather[0];
  const eventList = ((events.data ?? []) as { id: string; day: string; title: string; starts_at: string | null }[]).map((e) => ({
    id: e.id, day: e.day.slice(0, 10), title: e.title, time: e.starts_at ? e.starts_at.slice(0, 5) : null,
  }));

  const week: WeekDay[] = Array.from({ length: 7 }, (_, offset) => {
    const day = parisDay(offset);
    const p = plannedOn.get(day);
    const first = eventList.find((e) => e.day === day);
    return {
      day,
      offset,
      weather: weekWeather[offset],
      outfit: p?.view ? { id: p.view.id, title: p.view.title, pieces: p.view.pieces } : null,
      event: first?.title ?? null,
      note: first?.title ?? ferieDu(contexte, day)?.nom ?? null,
    };
  });

  // La tenue du jour : celle déjà prévue (par Kodi ou à la main) passe avant les propositions.
  const plan = plannedOn.get(today);
  const planned0: Outfit | null = (() => {
    if (!plan?.view) return null;
    const ids = plan.view.pieces.map((p) => p.id).filter((id) => known.has(id));
    if (!ids.length) return null;
    return { id: `p-${plan.view.id}`, saved: plan.view.id, title: plan.view.title, why: 'Prévue pour aujourd’hui.', pieces: ids };
  })();
  const av = evite(((feedback.data ?? []) as { garment_ids: string[]; reason: string; target_ids: string[]; created_at: string }[]));
  const proposed = suggestOutfits(pieces, weather, av);
  const seen = new Set<string>();
  const outfits = [planned0, ...proposed]
    .filter((o): o is Outfit => !!o)
    .filter((o) => {
      const k = cleTenue(o.pieces);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 3);

  // La série : on remonte depuis hier tant que chaque jour a un port.
  const days = new Set(((wornDays.data ?? []) as { worn_on: string }[]).map((w) => w.worn_on));
  let streak = 0;
  while (streak < 62 && days.has(parisDay(-1 - streak))) streak++;

  return {
    pieces,
    outfits,
    worn: Boolean(plan?.worn) && Boolean(planned0),
    streak,
    weather,
    now: maintenant(contexte),
    city: contexte?.ville.valeur?.nom ?? null,
    hasCity: Boolean(viewer.settings.city),
    eventsToday: eventList.filter((e) => e.day === today).length,
    week,
    trip: ((trips.data ?? []) as HomeTrip[])[0] ?? null,
    contexte,
  };
}
