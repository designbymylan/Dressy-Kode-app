import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/space';
import { parisDay } from '@/lib/dates';
import { Screen, Title, Card, Icon, ICON } from '@/components/ui';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

type Planned = { day: string; worn: boolean; outfits: { id: string; name: string | null } | null };
type Event = { id: string; day: string; title: string; slot: string | null };
type Trip = { id: string; destination: string; starts_on: string; ends_on: string };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dot = (color: string): CSSProperties => ({ width: 5, height: 5, borderRadius: 999, background: color, flex: 'none' });

/** Le mois demandé (?mois=AAAA-MM), ou le mois courant à Paris. */
function monthOf(raw?: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(raw ?? '');
  const base = m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? m : /^(\d{4})-(\d{2})/.exec(parisDay(0))!;
  const year = Number(base[1]);
  const month = Number(base[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = (d: number) => `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return {
    year,
    month,
    lastDay,
    // Lundi en premier : nombre de cases vides avant le 1er.
    lead: (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7,
    first: day(1),
    last: day(lastDay),
    day,
    key: `${year}-${String(month).padStart(2, '0')}`,
  };
}

function shift(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function Calendrier({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const { mois } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion');
  const supabase = await createClient();
  const mo = monthOf(mois);

  const [{ data: planned }, { data: events }, { data: trips }] = await Promise.all([
    supabase
      .from('planned_days')
      .select('day, worn, outfits(id, name)')
      .eq('space_id', viewer.spaceId)
      .gte('day', mo.first)
      .lte('day', mo.last),
    supabase
      .from('events')
      .select('id, day, title, slot')
      .eq('space_id', viewer.spaceId)
      .gte('day', mo.first)
      .lte('day', mo.last)
      .order('day'),
    // Un voyage compte s'il touche le mois, même par un seul jour.
    supabase
      .from('trips')
      .select('id, destination, starts_on, ends_on')
      .eq('space_id', viewer.spaceId)
      .lte('starts_on', mo.last)
      .gte('ends_on', mo.first)
      .order('starts_on'),
  ]);

  const plannedBy = new Map(((planned ?? []) as unknown as Planned[]).map((p) => [p.day, p]));
  const eventsBy = new Map<string, Event[]>();
  for (const e of (events ?? []) as Event[]) eventsBy.set(e.day, [...(eventsBy.get(e.day) ?? []), e]);
  const tripOn = (day: string) => ((trips ?? []) as Trip[]).find((t) => t.starts_on <= day && day <= t.ends_on);

  const today = parisDay(0);
  const days = Array.from({ length: mo.lastDay }, (_, i) => mo.day(i + 1));
  const busy = days.filter((d) => plannedBy.has(d) || eventsBy.has(d) || tripOn(d));

  return (
    <Screen>
      <Title sub="Tenues planifiées, occasions, prêts, voyage.">
        <em className="accent">Calendrier</em>
      </Title>

      <section className="rise" style={{ '--i': 1, display: 'flex', flexDirection: 'column', gap: 12 } as CSSProperties}>
        <nav aria-label="Changer de mois" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Link href={`/calendrier?mois=${shift(mo.year, mo.month, -1)}`} className="chip" aria-label="Mois précédent"
            style={{ width: 44, minHeight: 44, padding: 0, justifyContent: 'center' }}>
            <Icon d={ICON.back} size={18} />
          </Link>
          <h2 style={{ fontSize: 20, textAlign: 'center' }}>
            {cap(MOIS[mo.month - 1])} <span className="muted">{mo.year}</span>
          </h2>
          <Link href={`/calendrier?mois=${shift(mo.year, mo.month, 1)}`} className="chip" aria-label="Mois suivant"
            style={{ width: 44, minHeight: 44, padding: 0, justifyContent: 'center' }}>
            <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
              <Icon d={ICON.back} size={18} />
            </span>
          </Link>
        </nav>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {JOURS.map((j) => (
            <span key={j} className="muted" style={{ textAlign: 'center', fontSize: 11, fontWeight: 500 }}>{j}</span>
          ))}
          {Array.from({ length: mo.lead }, (_, i) => <span key={`vide-${i}`} />)}
          {days.map((day, i) => {
            const isToday = day === today;
            const plan = plannedBy.get(day);
            const hasEvents = (eventsBy.get(day)?.length ?? 0) > 0;
            return (
              <div
                key={day}
                aria-label={`${i + 1} ${MOIS[mo.month - 1]}${isToday ? ', aujourd’hui' : ''}`}
                style={{
                  aspectRatio: '1 / 1', borderRadius: 14, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 14,
                  fontWeight: isToday ? 600 : 500,
                  color: isToday ? '#000000' : 'var(--ink)',
                  background: isToday ? 'var(--blue-glass)' : 'var(--glass)',
                  border: `1px solid ${isToday ? 'rgba(255, 255, 255, 0.7)' : 'var(--glass-edge)'}`,
                }}
              >
                {i + 1}
                <span style={{ display: 'flex', gap: 3, height: 5 }}>
                  {plan ? <span style={dot('var(--blue-ink)')} /> : null}
                  {hasEvents ? <span style={dot('var(--butter)')} /> : null}
                  {tripOn(day) ? <span style={dot('var(--muted)')} /> : null}
                </span>
              </div>
            );
          })}
        </div>

        <p className="muted" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={dot('var(--blue-ink)')} /> Tenue prévue</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={dot('var(--butter)')} /> Rendez-vous</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={dot('var(--muted)')} /> Voyage</span>
        </p>
      </section>

      <section className="rise" style={{ '--i': 2, display: 'flex', flexDirection: 'column', gap: 12 } as CSSProperties}>
        <h2 className="section-title">Le <em className="accent">mois</em></h2>
        {busy.length === 0 ? (
          <Card center i={3}>
            <p className="small muted">
              Rien n’est prévu ce mois-ci. Les tenues, les rendez-vous et les voyages apparaîtront ici.
            </p>
            <Link href="/tenues/nouvelle" className="btn btn-glass btn-block">Composer une tenue</Link>
          </Card>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {busy.map((day) => {
              const plan = plannedBy.get(day);
              const trip = tripOn(day);
              const weekday = JOURS_LONGS[new Date(`${day}T12:00:00Z`).getUTCDay()];
              return (
                <li key={day}>
                  <Card>
                    <p style={{ fontWeight: 600, fontSize: 15 }}>
                      {cap(weekday)} {Number(day.slice(8))} {MOIS[mo.month - 1]}
                      {day === today ? <span className="muted" style={{ fontWeight: 500 }}> · aujourd’hui</span> : null}
                    </p>
                    {plan ? (
                      <p className="small">
                        Tenue : <Link href="/tenues">{plan.outfits?.name ?? 'sans nom'}</Link>
                        {plan.worn ? <span className="muted"> · portée</span> : null}
                      </p>
                    ) : null}
                    {(eventsBy.get(day) ?? []).map((e) => (
                      <p key={e.id} className="small">{e.slot ? `${e.slot} · ` : ''}{e.title}</p>
                    ))}
                    {trip ? <p className="small muted">Voyage : {trip.destination}</p> : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Screen>
  );
}
