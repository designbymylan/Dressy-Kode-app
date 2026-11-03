'use client';

import Link from 'next/link';
import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { planWithKodi } from '@/app/actions';
import { Garment, SHAPE_BY_CATEGORY } from '@/components/garments';
import { Icon } from '@/components/icons';
import { KodeThinking } from '@/components/KodeThinking';
import { cap, dayName, monthLabel, type Iso } from '@/lib/planning';

/** Ce qu'une case montre : sa tenue (une pièce), ses rendez-vous, son voyage. */
export type MonthCell = {
  iso: Iso;
  main: { url: string | null; category: string; colour: string | null; name: string } | null;
  events: number;
  tripStart: boolean;
  inTrip: boolean;
  label: string;
};

const LETTRES_LUNDI = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Le mois en grand (le Planning de l'app mobile) : chaque jour montre sa
 * tenue, ses rendez-vous, son voyage. On touche un jour pour l'ouvrir. Ou on
 * choisit plusieurs jours, et Kodi prépare une tenue pour chacun, avec les
 * rendez-vous et la météo de chaque jour.
 */
export function CalendarMonth({
  month,
  today,
  day,
  weeks,
  prev,
  next,
  ready,
  base = '/calendrier',
}: {
  month: string;
  today: Iso;
  day: Iso;
  weeks: (MonthCell | null)[][];
  prev: string | null;
  next: string | null;
  /** De quoi composer une tenue : sans, Kodi n'a rien à préparer. */
  ready: boolean;
  /** La page qui porte le calendrier (la planche de design en a une autre). */
  base?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState<Iso[]>([]);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const { name, year } = monthLabel(month);
  const thisYear = Number(today.slice(0, 4));
  const href = (m: string, d: Iso) => `${base}?vue=mois&mois=${m}&jour=${d}`;

  const toggle = (iso: Iso) => setChosen((prevList) => (prevList.includes(iso) ? prevList.filter((d) => d !== iso) : [...prevList, iso].sort()));

  function launch() {
    if (!chosen.length) return;
    start(async () => {
      setMessage(null);
      const res = await planWithKodi({ days: chosen });
      if ('error' in res) return setMessage({ text: res.error, error: true });
      const n = res.planned;
      setMessage({ text: n > 1 ? `${n} tenues prévues par Kodi` : 'Une tenue prévue par Kodi', error: false });
      const only = chosen.length === 1 ? chosen[0] : null;
      setChosen([]);
      setChoosing(false);
      if (only) router.push(href(month, only));
      else router.refresh();
    });
  }

  return (
    <section className="glass card cal-month rise" style={{ '--i': 1 } as CSSProperties} aria-label={`${cap(name)} ${year}`}>
      <div className="cal-week__head">
        <h2 className="cal-title">{cap(name)}{year !== thisYear ? ` ${year}` : ''}</h2>
        <div className="cal-nav">
          {prev ? (
            <Link href={href(prev, day)} className="icon-btn" aria-label="Mois précédent"><Icon name="chevronLeft" size={18} /></Link>
          ) : (
            <span className="icon-btn" aria-disabled="true" style={{ opacity: 0.35 }}><Icon name="chevronLeft" size={18} /></span>
          )}
          {next ? (
            <Link href={href(next, day)} className="icon-btn" aria-label="Mois suivant"><Icon name="chevronRight" size={18} /></Link>
          ) : (
            <span className="icon-btn" aria-disabled="true" style={{ opacity: 0.35 }}><Icon name="chevronRight" size={18} /></span>
          )}
        </div>
      </div>

      <div className="cal-grid">
        {/* Chaque case se lit en entier (« mercredi 5 novembre, tenue prévue… ») : les lettres sont décoratives. */}
        <div className="cal-grid__row" aria-hidden="true">
          {LETTRES_LUNDI.map((l, i) => <span key={i} className="home-kicker" style={{ textAlign: 'center' }}>{l}</span>)}
        </div>
        {weeks.map((week, w) => (
          <div key={w} className="cal-grid__row">
            {week.map((c, k) => {
              if (!c) return <span key={k} />;
              const past = c.iso < today;
              const on = choosing ? chosen.includes(c.iso) : c.iso === day;
              const inner = (
                <>
                  <span className="cal-cell__num">{Number(c.iso.slice(8, 10))}</span>
                  {c.main ? (
                    <span className="cal-cell__piece">
                      {c.main.url ? <img src={c.main.url} alt="" loading="lazy" decoding="async" /> : <Garment shape={SHAPE_BY_CATEGORY[c.main.category] ?? 'tshirt'} size={24} fill={c.main.colour ?? 'var(--tile-2)'} stroke="var(--stage-line)" />}
                    </span>
                  ) : c.tripStart ? (
                    <span className="cal-cell__piece cal-cell__piece--bare"><Icon name="suitcase" size={16} /></span>
                  ) : (
                    <span style={{ height: 16 }} />
                  )}
                  <span className="cal-cell__dots" aria-hidden="true">
                    {Array.from({ length: Math.min(3, c.events) }, (_, i) => <i key={i} />)}
                  </span>
                </>
              );
              const common = {
                className: 'cal-cell',
                'data-on': on,
                'data-today': c.iso === today,
                'data-past': past && !on,
                'data-trip': c.inTrip,
                'aria-label': c.label,
              } as const;
              return choosing ? (
                <button key={c.iso} type="button" {...common} aria-pressed={on} disabled={past} onClick={() => toggle(c.iso)}>{inner}</button>
              ) : (
                <Link key={c.iso} href={href(month, c.iso)} {...common} aria-current={c.iso === day ? 'date' : undefined} scroll={false}>{inner}</Link>
              );
            })}
          </div>
        ))}
      </div>

      {!choosing ? (
        <button type="button" className="btn btn-glass btn-block" disabled={!ready} onClick={() => { setChoosing(true); setChosen([]); setMessage(null); }}>
          <Icon name="sparkle" size={18} /> Choisir des jours pour Kodi
        </button>
      ) : (
        <div className="cal-choose__bar">
          <span className="small muted">{chosen.length ? `${chosen.length} jour${chosen.length > 1 ? 's' : ''} choisi${chosen.length > 1 ? 's' : ''}` : 'Touche les jours à préparer'}</span>
          <button type="button" className="home-label-btn" style={{ paddingRight: 0, color: 'var(--ink)' }} onClick={() => { setChoosing(false); setChosen([]); }}>Annuler</button>
        </div>
      )}
      {!ready ? <p className="small muted">Ajoute un haut et un bas, ou une robe : Kodi aura de quoi composer.</p> : null}
      {message ? <p role={message.error ? 'alert' : 'status'} style={{ fontSize: 12.5, color: message.error ? 'var(--danger)' : 'var(--muted)' }}>{message.text}</p> : null}

      {/* Les jours choisis partent chez Kodi : une tenue par jour. */}
      {choosing ? (
        <div className="band cal-kodi">
          {pending ? (
            <KodeThinking phrases={['Kodi lit tes rendez-vous', 'Kodi regarde la météo', 'Kodi compose chaque jour']} />
          ) : (
            <h3 style={{ fontWeight: 600, fontSize: 20, color: 'var(--butter-ink)' }}>
              {chosen.length ? `Kodi prépare ${chosen.length} jour${chosen.length > 1 ? 's' : ''}` : 'Choisis tes jours'}
            </h3>
          )}
          {chosen.length ? (
            <div className="cal-chips">
              {chosen.map((d) => <span key={d} className="cal-kodi__chip">{dayName(d, today)}</span>)}
            </div>
          ) : null}
          <button type="button" className="btn btn-dark btn-block" disabled={!chosen.length || pending} onClick={launch}>
            <Icon name="sparkle" size={18} /> Préparer {chosen.length > 1 ? 'ces jours' : 'ce jour'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
