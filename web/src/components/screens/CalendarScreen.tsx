import Link from 'next/link';
import { Icon } from '@/components/icons';
import { Kodi, KodiSay } from '@/components/Kodi';
import { Cut, Screen, btn } from '@/components/ui';

export type CalendarItem = {
  id: string;
  kind: 'event' | 'outfit';
  title: string;
  time: string | null;
  note: string | null;
  worn?: boolean;
};

export type CalendarData = {
  selected: string;
  today: string;
  week: { date: string; letter: string; day: number; busy: boolean; full: string }[];
  month: string;
  prevMonth: string;
  nextMonth: string;
  prevWeek: string;
  nextWeek: string;
  dayLabel: string;
  items: CalendarItem[];
};

/**
 * Le calendrier en deux temps, comme la référence « découpage de
 * section » : la semaine sur fond blanc, la journée choisie dans un
 * panneau noir qui monte en S. Le jour choisi est une gélule bleue.
 */
export function CalendarScreen({ data }: { data: CalendarData }) {
  const isToday = data.selected === data.today;

  return (
    <Screen>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link href={`/calendrier?jour=${data.prevWeek}`} className={`${btn.icon} dk-btn--sm`} aria-label="Semaine précédente">
          <Icon name="chevronLeft" size={18} />
        </Link>
        <div
          style={{
            flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 14, overflow: 'hidden',
            maskImage: 'linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent)',
          }}
        >
          <span aria-hidden="true" style={{ fontFamily: 'Gambarino, Georgia, serif', fontSize: 24, color: 'var(--tile-2)', whiteSpace: 'nowrap' }}>{data.prevMonth}</span>
          <h1 style={{ fontSize: 32, whiteSpace: 'nowrap' }}>{data.month}</h1>
          <span aria-hidden="true" style={{ fontFamily: 'Gambarino, Georgia, serif', fontSize: 24, color: 'var(--tile-2)', whiteSpace: 'nowrap' }}>{data.nextMonth}</span>
        </div>
        <Link href={`/calendrier?jour=${data.nextWeek}`} className={`${btn.icon} dk-btn--sm`} aria-label="Semaine suivante">
          <Icon name="chevronRight" size={18} />
        </Link>
      </header>

      <nav aria-label="Jours de la semaine" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {data.week.map((d) => {
          const on = d.date === data.selected;
          return (
            <Link
              key={d.date}
              href={`/calendrier?jour=${d.date}`}
              aria-current={on ? 'date' : undefined}
              aria-label={d.full}
              className="dk-tap"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0 8px',
                borderRadius: 999, minHeight: 74,
                background: on ? 'var(--blue-glass)' : 'transparent',
                boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,.85), 0 6px 16px rgba(75,125,165,.28)' : 'none',
                color: on ? '#000' : 'var(--ink)',
                transition: 'background 260ms, box-shadow 260ms',
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 600, color: on ? 'rgba(0,0,0,.6)' : 'var(--subtle)' }}>{d.letter}</span>
              <span style={{ fontSize: 16, fontWeight: on ? 800 : 500, fontVariantNumeric: 'tabular-nums' }}>{d.day}</span>
              <span
                aria-hidden="true"
                style={{
                  width: 5, height: 5, borderRadius: 999,
                  background: d.busy ? (on ? '#000' : 'var(--blue-ink)') : d.date === data.today ? 'var(--subtle)' : 'transparent',
                }}
              />
            </Link>
          );
        })}
      </nav>

      <Cut flip fill label={data.dayLabel}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h2 className="dk-h2" style={{ fontSize: 22, color: 'var(--on-panel)' }}>{isToday ? 'Aujourd’hui' : data.dayLabel}</h2>
          {isToday ? <span className="dk-muted" style={{ fontSize: 13 }}>{data.dayLabel}</span> : null}
        </div>

        {data.items.length ? (
          <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
            {data.items.map((it, i) => {
              const last = i === data.items.length - 1;
              const card = it.kind === 'outfit';
              return (
                <li key={it.id} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 12 }}>
                  <span aria-hidden="true" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                    <span style={{ marginTop: 5, width: 12, height: 12, borderRadius: 999, border: '2.5px solid #fff', background: card ? 'var(--blue)' : 'transparent', zIndex: 1 }} />
                    {!last ? <span style={{ position: 'absolute', top: 20, bottom: 0, width: 2, borderRadius: 2, background: 'rgba(255,255,255,.22)' }} /> : null}
                  </span>
                  <div style={{ paddingBottom: last ? 0 : 20 }}>
                    <div
                      style={card ? {
                        background: '#FFFFFF', color: '#000', borderRadius: 18, padding: '12px 14px',
                        display: 'flex', flexDirection: 'column', gap: 4,
                      } : { display: 'flex', flexDirection: 'column', gap: 3 }}
                    >
                      {card ? (
                        <span className="dk-tag dk-tag--blue" style={{ alignSelf: 'flex-start' }}>
                          {it.worn ? 'Tenue portée' : 'Tenue prévue'}
                        </span>
                      ) : null}
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                        <strong style={{ fontSize: 15 }}>{it.title}</strong>
                        {it.time ? <span style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.75, whiteSpace: 'nowrap' }}>{it.time}</span> : null}
                      </span>
                      {it.note ? (
                        <span style={{ fontSize: 13, fontStyle: 'italic', color: card ? '#5C5C60' : 'var(--on-panel-muted)' }}>{it.note}</span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <KodiSay mood={isToday ? 'idle' : 'sleepy'} size={56} track>
              Rien de prévu {isToday ? 'aujourd’hui' : 'ce jour-là'}. Je te prépare une tenue ?
            </KodiSay>
            <Link href="/kodi?q=tenue" className={btn.butter} style={{ alignSelf: 'flex-start' }}>
              <Icon name="sparkle" size={17} /> Demander une tenue
            </Link>
          </div>
        )}

        <span style={{ position: 'absolute', right: 16, top: -50 }} aria-hidden="true">
          <Kodi mood="idle" size={44} look="down" decorative tap={false} />
        </span>
      </Cut>
    </Screen>
  );
}
