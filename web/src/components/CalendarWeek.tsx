import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Agenda } from '@/lib/agenda';
import { ferieDu, hhmm, periode, pontDu, vacancesDu } from '@/lib/contexte';
import { LETTRES, MOIS, addDays, cap, longLabel, offsetOf, weekday } from '@/lib/planning';
import { DotChip } from '@/components/DotChip';
import { Icon } from '@/components/icons';
import { KIND_WORD, WeatherIcon } from '@/components/WeatherIcon';

/**
 * Le jour ouvert, en une ligne et quelques puces : sa météo, son jour férié,
 * ses vacances, la fête du jour. Chaque donnée porte sa source et son heure.
 */
export function DaySummary({ a }: { a: Agenda }) {
  const o = offsetOf(a.day, a.today);
  const w = o >= 0 && o < 14 ? a.weather[o] : null;
  const ctx = a.contexte;
  const ferie = ferieDu(ctx, a.day);
  const pont = pontDu(ctx, a.day);
  const vacances = vacancesDu(ctx, a.day);
  const fete = o === 0 ? ctx?.fete.valeur : null;
  const soleil = o === 0 ? ctx?.soleil.valeur : null;
  const prevision = w ? `${w.low}° le soir` : o >= 0 && ctx?.meteo.valeur ? 'Pas encore de prévision pour ce jour.' : null;
  const notes = [
    ferie && `Jour férié : ${ferie.nom}`,
    pont && `Long week-end ${periode(pont.debut, pont.fin)}${pont.aPoser ? `, ${pont.aPoser} jour à poser` : ''}`,
    vacances && `${vacances.nom} ${periode(vacances.debut, vacances.fin)}`,
    fete && `Bonne fête aux ${fete.prenoms}`,
    soleil && `Soleil de ${hhmm(soleil.lever)} à ${hhmm(soleil.coucher)}`,
  ].filter((x): x is string => !!x);
  const chips = [prevision, ...notes].filter((x): x is string => !!x);
  const trip = a.trips.find((t) => t.starts_on <= a.day && a.day <= t.ends_on);

  return (
    <div className="cal-summary" aria-live="polite">
      <div className="cal-summary__line">
        {w ? <WeatherIcon kind={w.kind} size={22} /> : <Icon name="calendar" size={22} />}
        <strong>
          {cap(longLabel(a.day))}
          {w ? ` · ${w.t}°, ${w.label}` : ''}
        </strong>
      </div>
      {chips.length || trip ? (
        <div className="cal-chips">
          {trip ? <DotChip>{`Voyage · ${trip.destination}`}</DotChip> : null}
          {chips.map((c) => <DotChip key={c}>{c}</DotChip>)}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Le calendrier, au centre de la page : la semaine, sa météo et ses
 * rendez-vous d'un coup d'œil (aujourd'hui et les treize jours suivants,
 * sept à la fois). Le jour ouvert est en bleu, aujourd'hui est cerclé, un
 * point dit qu'il s'y passe quelque chose.
 */
export function CalendarWeek({ a, base = '/calendrier' }: { a: Agenda; base?: string }) {
  const href = (day: string) => `${base}?jour=${day}`;
  const week = Math.floor(offsetOf(a.day, a.today) / 7);
  const from = week * 7;
  const days = Array.from({ length: 7 }, (_, k) => from + k);
  const first = addDays(a.today, from);
  const last = addDays(a.today, from + 6);
  const m1 = Number(first.slice(5, 7)) - 1;
  const m2 = Number(last.slice(5, 7)) - 1;
  const title = m1 === m2 ? MOIS[m1] : `${MOIS[m1]} · ${MOIS[m2]}`;

  return (
    <section className="glass card cal-week rise" style={{ '--i': 1 } as CSSProperties} aria-label="Les deux prochaines semaines">
      <div className="cal-week__head">
        <h2 className="cal-title">{title}</h2>
        <div className="cal-nav">
          {week > 0 ? (
            <Link href={href(a.today)} className="icon-btn" aria-label="Semaine précédente"><Icon name="chevronLeft" size={18} /></Link>
          ) : (
            <span className="icon-btn" aria-disabled="true" style={{ opacity: 0.35 }}><Icon name="chevronLeft" size={18} /></span>
          )}
          {week < 1 ? (
            <Link href={href(addDays(a.today, 7))} className="icon-btn" aria-label="Semaine suivante"><Icon name="chevronRight" size={18} /></Link>
          ) : (
            <span className="icon-btn" aria-disabled="true" style={{ opacity: 0.35 }}><Icon name="chevronRight" size={18} /></span>
          )}
        </div>
      </div>

      <div className="cal-strip" role="group" aria-label="Choisir un jour">
        {days.map((i) => {
          const iso = addDays(a.today, i);
          const w = a.weather[i];
          const ferie = ferieDu(a.contexte, iso);
          const busy = a.events.some((e) => e.date === iso) || !!ferie || !!a.planned[iso];
          const on = iso === a.day;
          const num = Number(iso.slice(8, 10));
          return (
            <Link
              key={iso}
              href={href(iso)}
              className="cal-day"
              data-on={on}
              data-today={i === 0}
              aria-current={on ? 'date' : undefined}
              aria-label={`${cap(longLabel(iso))}${w ? `, ${w.t} degrés, ${w.label || KIND_WORD[w.kind]}` : ''}${ferie ? `, férié, ${ferie.nom}` : busy ? ', quelque chose de prévu' : ''}`}
            >
              <span className="home-kicker">{LETTRES[weekday(iso)]}</span>
              <span className="stat cal-day__num">{num}</span>
              {w ? <WeatherIcon kind={w.kind} size={19} /> : <span style={{ height: 19 }} />}
              <strong className="cal-day__max">{w ? `${w.t}°` : ' '}</strong>
              <span className="home-kicker">{w ? `${w.low}°` : ' '}</span>
              <span className="cal-day__dot" data-busy={busy} />
            </Link>
          );
        })}
      </div>

      <DaySummary a={a} />
    </section>
  );
}
