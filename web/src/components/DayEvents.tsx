'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { deleteEvent, saveEvent } from '@/app/actions';
import { DotChip } from '@/components/DotChip';
import { Icon } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { CONSTRAINTS, DRESS_CODES, IMPRESSIONS, RDV_KINDS, SETTINGS, STAKES, cap, relativeDay, timeLabel, type Iso, type RdvEvent } from '@/lib/planning';

/**
 * Les rendez-vous du jour ouvert, qu'on ajoute ou corrige ici. Chaque détail
 * (heure, type, importance, tenue voulue, impression, lieu, contraintes) part
 * chez Kodi, qui habille le jour avec tout ça.
 */
export function DayEvents({ day, today, events, base = '/calendrier' }: { day: Iso; today: Iso; events: RdvEvent[]; base?: string }) {
  const [sheet, setSheet] = useState<{ event: RdvEvent | null } | null>(null);
  const label = `${cap(relativeDay(day, today))} · ${events.length ? `${events.length} rendez-vous` : 'rien de prévu'}`;

  return (
    <section className="glass card day-events rise" style={{ '--i': 2 } as CSSProperties} aria-label="Rendez-vous du jour">
      <h2 className="home-tag">{label}</h2>
      {events.map((e) => (
        <button
          key={e.id}
          type="button"
          className="event-row"
          onClick={() => setSheet({ event: e })}
          aria-label={`${timeLabel(e.time) ?? 'Dans la journée'}, ${e.title}${e.place ? `, ${e.place}` : ''}. Modifier`}
        >
          <strong className="event-row__time">{timeLabel(e.time) ?? 'Journée'}</strong>
          <span className="event-row__body">
            <strong>{e.title}</strong>
            {e.place || e.kind || e.dressCode ? (
              <span className="cal-chips">
                {[e.kind, e.dressCode, e.place].filter((x): x is string => !!x).slice(0, 3).map((x) => <DotChip key={x}>{x}</DotChip>)}
              </span>
            ) : null}
          </span>
          <Icon name="chevronRight" size={16} />
        </button>
      ))}
      {day >= today ? (
        <button type="button" className="btn btn-ghost" style={{ alignSelf: 'center' }} onClick={() => setSheet({ event: null })}>
          <Icon name="plus" size={16} /> Ajouter un rendez-vous
        </button>
      ) : events.length === 0 ? (
        <p className="small muted">Rien de noté ce jour-là.</p>
      ) : null}

      {sheet ? <EventSheet key={sheet.event?.id ?? 'nouveau'} day={day} today={today} event={sheet.event} base={base} onClose={() => setSheet(null)} /> : null}
    </section>
  );
}

/** Des puces : une seule à la fois, ou plusieurs (`max` au plus). Toucher la puce choisie la retire. */
function Choices({ options, value, onChange, multi, max, label }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean; max?: number; label: string }) {
  const toggle = (o: string) => {
    const on = value.includes(o);
    if (!multi) return onChange(on ? [] : [o]);
    if (on) return onChange(value.filter((x) => x !== o));
    onChange(max && value.length >= max ? [...value.slice(1), o] : [...value, o]);
  };
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => (
        <button key={o} type="button" className="chip" aria-pressed={value.includes(o)} onClick={() => toggle(o)}>{o}</button>
      ))}
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="field">
    <span>{label}</span>
    {children}
  </div>
);

function EventSheet({ day, today, event, base, onClose }: { day: Iso; today: Iso; event: RdvEvent | null; base: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? day);
  const [time, setTime] = useState(event?.time ?? '');
  const [kind, setKind] = useState(event?.kind ?? '');
  const [dress, setDress] = useState<string[]>(event?.dressCode ? [event.dressCode] : []);
  const [stake, setStake] = useState<string[]>(event?.stake ? [event.stake] : []);
  const [impressions, setImpressions] = useState<string[]>(event?.impressions ?? []);
  const [place, setPlace] = useState(event?.place ?? '');
  const [setting, setSetting] = useState<string[]>(event?.setting ? [event.setting] : []);
  const [constraints, setConstraints] = useState<string[]>(event?.constraints ?? []);
  const [note, setNote] = useState(event?.note ?? '');

  const done = (to: Iso) => {
    onClose();
    if (to !== day) router.push(`${base}?jour=${to}`);
    else router.refresh();
  };

  function save() {
    if (!title.trim()) return setError('Donne un nom à ce rendez-vous.');
    start(async () => {
      setError(null);
      const res = await saveEvent({
        id: event?.id, day: date, title, time: time || null, kind: kind || null, dressCode: dress[0] ?? null, stake: stake[0] ?? null,
        impressions, place: place || null, setting: setting[0] ?? null, constraints, note: note || null,
      });
      if ('error' in res) return setError(res.error);
      done(date);
    });
  }

  function remove() {
    if (!event) return;
    start(async () => {
      setError(null);
      const res = await deleteEvent(event.id);
      if ('error' in res) return setError(res.error);
      done(day);
    });
  }

  return (
    <Sheet kicker="Pour Kodi" title={event ? 'Ce rendez-vous' : 'Un rendez-vous'} onClose={onClose}>
      <form
        className="event-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Nom">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Dîner chez Léa" autoFocus={!event} required />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Jour">
            <input className="input" type="date" value={date} min={event ? undefined : today} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Heure (facultatif)">
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Type">
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Je ne sais pas, Kodi choisit</option>
            {RDV_KINDS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.kinds.map((k) => <option key={k} value={k}>{k}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Tenue voulue">
          <Choices label="Tenue voulue" options={DRESS_CODES} value={dress} onChange={setDress} />
        </Field>
        <Field label="Importance">
          <Choices label="Importance" options={STAKES.map((s) => s.id)} value={stake} onChange={setStake} />
        </Field>
        <Field label="Ce que tu veux dégager (trois au plus)">
          <Choices label="Ce que tu veux dégager" options={IMPRESSIONS} value={impressions} onChange={setImpressions} multi max={3} />
        </Field>
        <Field label="Lieu">
          <input className="input" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={120} placeholder="Chez Léa, bureau, restaurant…" />
        </Field>
        <Field label="Intérieur ou extérieur">
          <Choices label="Intérieur ou extérieur" options={SETTINGS} value={setting} onChange={setSetting} />
        </Field>
        <Field label="Contraintes">
          <Choices label="Contraintes" options={CONSTRAINTS} value={constraints} onChange={setConstraints} multi />
        </Field>
        <Field label="Une note pour Kodi">
          <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} placeholder="Ce que Kodi doit savoir" />
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Évite d’y mettre des informations de santé.</span>
        </Field>

        {error ? <p role="alert" className="note note-error">{error}</p> : null}

        <div className="event-form__actions">
          <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
            {pending ? <><span className="spinner" aria-hidden="true" />Une seconde</> : event ? 'Enregistrer' : 'Ajouter ce rendez-vous'}
          </button>
          {event ? (
            sure ? (
              <button type="button" className="btn btn-glass btn-block" onClick={remove} disabled={pending}>Oui, le retirer</button>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => setSure(true)}>Retirer ce rendez-vous</button>
            )
          ) : null}
        </div>
      </form>
    </Sheet>
  );
}
