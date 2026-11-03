import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { OutfitPiece } from '@/lib/kode';
import type { HomeTrip, WeekDay } from '@/lib/accueil';
import { rowOf, type RowId } from '@/lib/outfits';
import { Garment, SHAPE_BY_CATEGORY } from '@/components/garments';
import { Icon } from '@/components/icons';
import { WeatherIcon, KIND_WORD } from '@/components/WeatherIcon';
import { FillWeek } from '@/components/FillWeek';

const LETTRES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Le jour de la semaine d'une date AAAA-MM-JJ (0 : dimanche), sans dépendre du fuseau du serveur. */
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** « 5 nov. – 9 nov. » : la durée d'un voyage en peu de mots. */
function span(from: string, to: string) {
  const f = (d: string) => `${Number(d.slice(8))} ${MOIS_COURTS[Number(d.slice(5, 7)) - 1]}`;
  return from === to ? f(from) : `${f(from)} au ${f(to)}`;
}

/** Une pièce posée sur la carte d'un jour : sa vignette, ou la silhouette de sa catégorie. */
function Flat({ p, size, style }: { p: OutfitPiece; size: number; style: CSSProperties }) {
  return (
    <span className="flat-piece" style={{ width: size, height: size, ...style }}>
      {p.url ? (
        <img src={p.url} alt="" draggable={false} loading="lazy" decoding="async" />
      ) : (
        <Garment shape={SHAPE_BY_CATEGORY[p.category] ?? 'tshirt'} size={size} fill={p.colour ?? 'var(--tile-2)'} stroke="var(--stage-line)" />
      )}
    </span>
  );
}

/** Une tenue posée à plat : le haut à gauche, le bas qui le chevauche, les chaussures devant. */
function FlatLay({ pieces }: { pieces: OutfitPiece[] }) {
  const W = 126;
  const H = 132;
  const row = (p: OutfitPiece): RowId => rowOf({ category_id: p.category, kind: null, name: p.name });
  const find = (rows: RowId[]) => pieces.find((p) => rows.includes(row(p)));
  const top = find(['haut', 'veste']);
  const bottom = find(['bas']);
  const feet = find(['pieds']);
  return (
    <div className="flat-lay" aria-hidden="true" style={{ width: W, height: H }}>
      {bottom ? <Flat p={bottom} size={top ? W * 0.64 : W * 0.78} style={top ? { right: -2, top: H * 0.18 } : { left: W * 0.11, top: 0 }} /> : null}
      {top ? <Flat p={top} size={W * 0.52} style={{ left: 0, top: 0 }} /> : null}
      {feet ? <Flat p={feet} size={W * 0.56} style={{ left: -2, top: H * 0.42 }} /> : null}
    </div>
  );
}

/** Une petite ligne à point : un mot ou deux. */
const DotLine = ({ text }: { text: string }) => (
  <span className="dot-line"><i aria-hidden="true" /><span>{text}</span></span>
);

function DayCard({ d }: { d: WeekDay }) {
  const date = new Date(`${d.day}T12:00:00Z`);
  const label = d.offset === 1 ? 'Demain' : cap(JOURS_COURTS[weekday(d.day)]);
  const num = String(date.getUTCDate()).padStart(2, '0');
  const said = [
    d.offset === 1 ? 'demain' : JOURS_LONGS[weekday(d.day)],
    `${date.getUTCDate()} ${MOIS_COURTS[date.getUTCMonth()]}`,
    d.weather ? `${d.weather.t} degrés, ${d.weather.label.toLowerCase() || KIND_WORD[d.weather.kind]}` : null,
    d.note,
  ].filter(Boolean).join(', ');

  const top = (
    <>
      <span className="day-top">
        <span className="home-kicker">{label}</span>
        {d.weather ? (
          <span className="day-weather">
            <WeatherIcon kind={d.weather.kind} size={15} />
            <span className="home-kicker">{`${d.weather.t}°`}</span>
          </span>
        ) : null}
      </span>
      <span className="stat day-num">{num}</span>
    </>
  );

  if (!d.outfit) {
    return (
      <Link href={`/calendrier?jour=${d.day}`} className="home-day home-day--empty" aria-label={`Prévoir une tenue : ${said}`}>
        {top}
        <span className="day-plan">
          <span className="day-plan__plus"><Icon name="plus" size={22} /></span>
          <strong>Prévoir</strong>
        </span>
        <span className="day-foot">{d.note ? <DotLine text={d.note} /> : null}</span>
      </Link>
    );
  }
  return (
    <Link href={`/calendrier?jour=${d.day}`} className={`home-day glass${d.offset === 1 ? ' home-day--next' : ''}`} aria-label={`Tenue prévue : ${said}`}>
      {top}
      <FlatLay pieces={d.outfit.pieces} />
      <span className="day-foot"><DotLine text={d.note ?? d.outfit.title ?? 'Prête'} /></span>
    </Link>
  );
}

/**
 * Ta semaine : les tenues prévues et la météo réunies, en grand. Une barre de
 * sept jours dit ce qui est prêt ; chaque jour est une carte ; Kodi peut
 * compléter les jours vides avec le dressing.
 */
export function HomeWeek({
  week,
  trip,
  todayReady,
  canFill,
  credit,
}: {
  week: WeekDay[];
  trip: HomeTrip | null;
  /** Aujourd'hui compte comme prêt quand une tenue est proposée ou portée. */
  todayReady: boolean;
  canFill: boolean;
  credit: string | null;
}) {
  const ready = (d: WeekDay) => (d.offset === 0 ? todayReady : !!d.outfit);
  const count = week.filter(ready).length;
  const empty = week.filter((d) => d.offset > 0 && !d.outfit).map((d) => d.day);

  return (
    <section className="home-week rise" style={{ '--i': 2 } as CSSProperties} aria-labelledby="home-week-title">
      <div className="home-week__head">
        <h2 id="home-week-title" className="home-big">Ta semaine</h2>
        <Link href="/calendrier" className="home-link">Calendrier</Link>
      </div>

      {/* Sept jours : le trait se remplit quand la tenue est prête. */}
      <Link href="/calendrier" className="home-weekbar" aria-label={`${count} jour${count > 1 ? 's' : ''} sur 7 ont leur tenue, ouvrir le calendrier`}>
        {week.map((d) => (
          <span key={d.day} className="home-weekbar__day">
            <span className="home-weekbar__bar" data-on={ready(d)} />
            <span className="home-kicker" data-today={d.offset === 0}>{LETTRES[weekday(d.day)]}</span>
          </span>
        ))}
        <span className="home-kicker home-weekbar__count">{`${count}/7`}</span>
      </Link>

      <div className="home-days scroll-x">
        {week.filter((d) => d.offset > 0).map((d) => (
          <DayCard key={d.day} d={d} />
        ))}
      </div>

      {trip ? (
        <Link href="/calendrier" className="home-trip" aria-label={`Voyage à ${trip.destination}, ${span(trip.starts_on, trip.ends_on)}`}>
          <Icon name="suitcase" size={18} />
          <strong>{`${trip.destination} · ${span(trip.starts_on, trip.ends_on)}`}</strong>
          <Icon name="chevronRight" size={16} />
        </Link>
      ) : null}

      {empty.length > 0 && canFill ? <FillWeek days={empty} /> : null}
      {credit ? <p className="credit">{credit}</p> : null}
    </section>
  );
}
