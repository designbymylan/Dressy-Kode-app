import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Agenda } from '@/lib/agenda';
import { headToToe } from '@/lib/outfits';
import { cap, dayName, longLabel, monthGrid, monthKey, offsetOf, shiftMonth, spanLabel } from '@/lib/planning';
import { CalendarMonth, type MonthCell } from '@/components/CalendarMonth';
import { DaySummary, CalendarWeek } from '@/components/CalendarWeek';
import { DayEvents } from '@/components/DayEvents';
import { DayOutfit } from '@/components/DayOutfit';
import { Icon } from '@/components/icons';
import { Segment } from '@/components/Segment';
import { Screen, Title } from '@/components/ui';

/** La pièce que la case du mois montre : la plus haute de la tenue, sans les chaussures ni les petits accessoires. */
const NOT_MAIN = new Set(['chaussures', 'sacs', 'accessoires', 'bijoux']);

function monthCells(a: Agenda) {
  const lo = shiftMonth(monthKey(a.today), -1);
  const hi = shiftMonth(monthKey(a.today), 12);
  const weeks = monthGrid(a.month).map((week) =>
    week.map((iso): MonthCell | null => {
      if (!iso) return null;
      const p = a.planned[iso];
      const events = a.events.filter((e) => e.date === iso);
      const trip = a.trips.find((t) => t.starts_on <= iso && iso <= t.ends_on);
      const main = p
        ? headToToe(p.outfit.pieces.map((x) => ({ ...x, category_id: x.category, kind: null }))).find((x) => !NOT_MAIN.has(x.category_id))
        : null;
      return {
        iso,
        main: main ? { url: main.url, category: main.category_id, colour: main.colour, name: main.name } : null,
        events: events.length,
        tripStart: trip?.starts_on === iso,
        inTrip: !!trip,
        label: [
          cap(longLabel(iso)),
          p ? `tenue prévue : ${p.outfit.title}` : null,
          events.length ? `${events.length} rendez-vous` : null,
          trip ? `voyage à ${trip.destination}` : null,
        ].filter(Boolean).join(', '),
      };
    }),
  );
  return { weeks, prev: a.month > lo ? shiftMonth(a.month, -1) : null, next: a.month < hi ? shiftMonth(a.month, 1) : null };
}

/**
 * Le calendrier tel qu'il s'affiche, une fois les données lues
 * (app/(app)/calendrier les lit, la planche /apercu/calendrier les invente).
 * Deux vues, comme sur l'app mobile : la semaine avec sa météo (l'Agenda) et
 * le mois en grand (le Planning). Sous l'une comme sous l'autre, le jour
 * ouvert : ses rendez-vous et sa tenue, qu'on prévoit, change ou retire.
 */
export function CalendarView({ a, base = '/calendrier' }: { a: Agenda; base?: string }) {
  const o = offsetOf(a.day, a.today);
  const dayEvents = a.events.filter((e) => e.date === a.day);
  const planned = a.planned[a.day] ?? null;
  const weekHref = `${base}?jour=${o >= 0 && o <= 13 ? a.day : a.today}`;
  const monthHref = `${base}?vue=mois&jour=${a.day}`;
  const month = a.vue === 'mois' ? monthCells(a) : null;

  return (
    <Screen>
      <Title sub="Prévois tes tenues, jour après jour.">
        <em className="accent">Calendrier</em>
      </Title>

      <div className="rise" style={{ '--i': 1 } as CSSProperties}>
        <Segment
          label="Vue du calendrier"
          value={a.vue}
          options={[
            { value: 'semaine', label: 'Semaine', href: weekHref },
            { value: 'mois', label: 'Mois', href: monthHref },
          ]}
        />
      </div>

      {month ? (
        <>
          <CalendarMonth month={a.month} today={a.today} day={a.day} weeks={month.weeks} prev={month.prev} next={month.next} ready={a.ready} base={base} />
          <section className="glass card cal-solo rise" style={{ '--i': 2, padding: 14 } as CSSProperties} aria-label="Le jour ouvert">
            <DaySummary a={a} />
          </section>
        </>
      ) : (
        <CalendarWeek a={a} base={base} />
      )}

      <DayEvents day={a.day} today={a.today} events={dayEvents} base={base} />
      <DayOutfit day={a.day} today={a.today} planned={planned} ready={a.ready} eventTitle={dayEvents[0]?.title ?? null} />

      {a.vue === 'mois' && a.trips.length > 0 ? (
        <section className="glass card rise" style={{ '--i': 4, padding: 14 } as CSSProperties} aria-label="Voyages">
          <h2 className="home-tag"><Icon name="suitcase" size={14} /> Voyages</h2>
          <ul className="cal-list">
            {a.trips.map((t) => (
              <li key={t.id}>
                <Link href={`${base}?vue=mois&mois=${monthKey(t.starts_on < a.today ? a.today : t.starts_on)}&jour=${t.starts_on < a.today ? a.today : t.starts_on}`} className="cal-list__row">
                  <span className="cal-list__icon"><Icon name="suitcase" size={20} /></span>
                  <span className="cal-list__text">
                    <strong>{t.destination}</strong>
                    <span className="home-kicker">{`${spanLabel(t.starts_on, t.ends_on)}${t.purpose ? ` · ${t.purpose}` : ''}`}</span>
                  </span>
                  <Icon name="chevronRight" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {a.later.length > 0 ? (
        <section className="glass card rise" style={{ '--i': 5, padding: 14 } as CSSProperties} aria-label="Rendez-vous à venir">
          <h2 className="home-tag">{a.vue === 'mois' ? 'Rendez-vous à venir' : 'À venir'}</h2>
          <ul className="cal-list">
            {a.later.map((e) => (
              <li key={e.id}>
                <Link href={`${base}?jour=${e.date}`} className="cal-list__row" aria-label={`${dayName(e.date, a.today)}, ${e.title}`}>
                  <span className="home-kicker cal-list__when">{dayName(e.date, a.today)}</span>
                  <span className="cal-list__title">{e.title}</span>
                  {a.planned[e.date] ? <Icon name="check" size={16} /> : null}
                  <Icon name="chevronRight" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Screen>
  );
}
