import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { todayParis } from '@/lib/wardrobe';
import { CalendarScreen, type CalendarItem } from '@/components/screens/CalendarScreen';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const month = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' });
const full = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Les dates sont manipulées à midi UTC : aucun changement d'heure ne les fait glisser. */
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (s: string, days: number) => iso(new Date(at(s).getTime() + days * 86400000));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function Calendrier({ searchParams }: { searchParams: Promise<{ jour?: string }> }) {
  const { jour } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');

  const today = todayParis();
  const selected = jour && /^\d{4}-\d{2}-\d{2}$/.test(jour) && !Number.isNaN(at(jour).getTime()) ? jour : today;
  const monday = shift(selected, -((at(selected).getUTCDay() + 6) % 7));
  const sunday = shift(monday, 6);

  const supabase = await createClient();
  const [{ data: events }, { data: planned }] = await Promise.all([
    supabase.from('events').select('id, day, title, slot, note, dress_code').gte('day', monday).lte('day', sunday),
    supabase.from('planned_days').select('day, outfit_id, worn').gte('day', monday).lte('day', sunday),
  ]);

  const outfitIds = (planned ?? []).map((p) => p.outfit_id).filter(Boolean) as string[];
  const { data: outfits } = outfitIds.length
    ? await supabase.from('outfits').select('id, name').in('id', outfitIds)
    : { data: [] as { id: string; name: string }[] };
  const outfitName = new Map((outfits ?? []).map((o) => [o.id, o.name]));

  const busy = new Set([...(events ?? []).map((e) => e.day), ...(planned ?? []).map((p) => p.day)]);

  const items: CalendarItem[] = [
    ...(planned ?? [])
      .filter((p) => p.day === selected)
      .map((p) => ({
        id: `p-${p.day}`,
        kind: 'outfit' as const,
        title: (p.outfit_id && outfitName.get(p.outfit_id)) || 'Tenue du jour',
        time: null,
        note: null,
        worn: Boolean(p.worn),
      })),
    ...(events ?? [])
      .filter((e) => e.day === selected)
      .sort((a, b) => String(a.slot ?? '').localeCompare(String(b.slot ?? '')))
      .map((e) => ({
        id: String(e.id),
        kind: 'event' as const,
        title: e.title,
        time: e.slot ?? null,
        note: e.note ?? (e.dress_code ? `Tenue : ${e.dress_code}` : null),
      })),
  ];

  const m = at(selected);
  const prev = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() - 1, 15));
  const next = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 15));

  return (
    <CalendarScreen
      data={{
        selected,
        today,
        week: LETTERS.map((letter, i) => {
          const date = shift(monday, i);
          return { date, letter, day: at(date).getUTCDate(), busy: busy.has(date), full: full.format(at(date)) };
        }),
        month: cap(month.format(m)),
        prevMonth: cap(month.format(prev)),
        nextMonth: cap(month.format(next)),
        prevWeek: shift(selected, -7),
        nextWeek: shift(selected, 7),
        dayLabel: cap(full.format(m)),
        items,
      }}
    />
  );
}
