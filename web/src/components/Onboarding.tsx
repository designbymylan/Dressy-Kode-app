'use client';

import { useState, useTransition } from 'react';
import {
  GENDERS, GOALS, STYLES, ITEMS, COLOURS, AVOID, OCCASIONS,
  MORNING_TIME, TIME_INTENT, ASSISTANCE,
  labelsFor, colourHex, type Answers, type Option,
} from '@/lib/onboarding';
import { saveStyleProfile } from '@/app/actions';
import { btn, ProgressBar } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Kodi, type KodiMood } from '@/components/Kodi';

const STEPS = [
  'identite', 'objectifs', 'style', 'pieces',
  'couleurs', 'eviter', 'occasions', 'rythme', 'aide',
] as const;
const TOTAL = STEPS.length;

/* ---------- briques d'interface ---------- */

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 999,
        background: on ? 'var(--blue-ink)' : 'transparent',
        color: 'var(--bg)',
        border: on ? 'none' : '1.5px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: on ? 'scale(1)' : 'scale(.9)',
        transition: 'transform 380ms var(--spring), background 200ms',
      }}
    >
      {on ? <Icon name="check" size={13} /> : null}
    </span>
  );
}

function Tile({
  option, on, onPick, columns, single,
}: { option: Option; on: boolean; onPick: () => void; columns: number; single?: boolean }) {
  return (
    <button
      type="button"
      role={single ? 'radio' : 'checkbox'}
      aria-checked={on}
      onClick={onPick}
      style={{
        position: 'relative', minHeight: columns === 3 ? 96 : 104,
        border: `1.5px solid ${on ? 'var(--blue-ink)' : 'var(--line)'}`,
        borderRadius: 20, background: on ? 'var(--blue-soft)' : 'var(--surface)', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 10, padding: '14px 8px', boxShadow: on ? '0 6px 18px rgba(75,125,165,.18)' : 'var(--shadow-1)',
        transform: on ? 'translateY(-1px)' : 'none',
        transition: 'border-color 200ms, background 200ms, transform 380ms var(--spring)',
      }}
      className="dk-tap"
    >
      <Check on={on} />
      {option.icon ? (
        <span className={`dk-bubble-ico ${on ? 'dk-bubble-ico--blue' : 'dk-bubble-ico--tile'}`} style={{ transition: 'background 200ms' }}>
          <Icon name={option.icon} size={22} />
        </span>
      ) : null}
      <span style={{ fontSize: 12.5, textAlign: 'center', lineHeight: 1.25 }}>{option.label}</span>
    </button>
  );
}

function TileGrid({
  options, selected, toggle, columns = 2, single,
}: { options: Option[]; selected: string[]; toggle: (id: string) => void; columns?: number; single?: boolean }) {
  return (
    <div role={single ? 'radiogroup' : 'group'} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 10 }}>
      {options.map((o) => (
        <Tile key={o.id} option={o} columns={columns} single={single} on={selected.includes(o.id)} onPick={() => toggle(o.id)} />
      ))}
    </div>
  );
}

function Row({
  option, on, onPick, single,
}: { option: Option; on: boolean; onPick: () => void; single?: boolean }) {
  return (
    <button
      type="button"
      role={single ? 'radio' : 'checkbox'}
      aria-checked={on}
      onClick={onPick}
      style={{
        minHeight: 56, width: '100%', textAlign: 'left',
        border: `1.5px solid ${on ? 'var(--blue-ink)' : 'var(--line)'}`,
        borderRadius: 18, background: on ? 'var(--blue-soft)' : 'var(--surface)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px',
        boxShadow: 'var(--shadow-1)',
        transition: 'border-color 200ms, background 200ms',
      }}
      className="dk-tap"
    >
      {option.icon ? (
        <Icon name={option.icon} size={20} style={{ color: on ? 'var(--blue-ink)' : 'var(--ink)' }} />
      ) : null}
      <span style={{ flex: 1, fontSize: 14.5 }}>{option.label}</span>
      {on ? (
        <Icon name="check" size={18} style={{ color: 'var(--blue-ink)' }} />
      ) : null}
    </button>
  );
}

function RowList({
  options, selected, pick, single,
}: { options: Option[]; selected: string[]; pick: (id: string) => void; single?: boolean }) {
  return (
    <div role={single ? 'radiogroup' : 'group'} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map((o) => (
        <Row key={o.id} option={o} single={single} on={selected.includes(o.id)} onPick={() => pick(o.id)} />
      ))}
    </div>
  );
}

function Swatches({ selected, toggle }: { selected: string[]; toggle: (id: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      {COLOURS.map((c) => {
        const on = selected.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-label={c.label}
            onClick={() => toggle(c.id)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, minHeight: 44,
            }}
          >
            <span
              style={{
                width: 52, height: 52, borderRadius: 999, background: c.hex,
                // Le blanc et la crème disparaîtraient sur fond clair sans ce filet.
                border: `2px solid ${on ? 'var(--blue-ink)' : 'var(--line)'}`,
                boxShadow: on ? '0 0 0 3px var(--blue-soft)' : 'none',
                boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 200ms cubic-bezier(.2,.8,.2,1)',
              }}
            >
              {on ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke={['blanc', 'creme', 'beige', 'ciel', 'jaune'].includes(c.id) ? '#0D0D0E' : '#FFFFFF'}
                  strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m4 12 5 5 11-11" />
                </svg>
              ) : null}
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--muted)', textAlign: 'center' }}>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Kodi pose chaque question ; sa tête change avec le sujet. */
const STEP_MOOD: Record<(typeof STEPS)[number], KodiMood> = {
  identite: 'wave',
  objectifs: 'thinking',
  style: 'love',
  pieces: 'wink',
  couleurs: 'love',
  eviter: 'thinking',
  occasions: 'happy',
  rythme: 'sleepy',
  aide: 'listening',
};

function Head({ title, lead, mood = 'idle' }: { title: string; lead: string; mood?: KodiMood }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Kodi mood={mood} size={68} track />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <h1 style={{ fontSize: 27 }}>{title}</h1>
        <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>{lead}</p>
      </div>
    </header>
  );
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface)', borderRadius: 20, padding: '14px 16px', border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-1)', display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
        {label}
      </span>
      <span style={{ fontSize: 14.5, lineHeight: 1.4 }}>{children}</span>
    </div>
  );
}

/* ---------- le parcours ---------- */

export function Onboarding({ initial, adjusting = false }: { initial: Answers; adjusting?: boolean }) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const done = step >= TOTAL;
  const key = STEPS[Math.min(step, TOTAL - 1)];

  const toggle = (field: keyof Answers) => (id: string) =>
    setA((prev) => {
      const list = prev[field] as string[];
      return { ...prev, [field]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
    });

  // Un second clic annule le choix : rien n'oblige à répondre.
  const choose = (field: keyof Answers) => (id: string) =>
    setA((prev) => ({ ...prev, [field]: prev[field] === id ? null : id }));

  const canAdvance = key !== 'identite' || a.display_name.trim().length > 0;

  const submit = () =>
    start(async () => {
      const res = await saveStyleProfile(a);
      if (res?.error) setError(res.error);
    });

  return (
    <main className="dk-screen" style={{ ['--screen-pb' as string]: '150px', gap: 20 }}>
      {!done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ProgressBar value={((step + 1) / TOTAL) * 100} size="sm" label={`Étape ${step + 1} sur ${TOTAL}`} style={{ flex: 1 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{step + 1}/{TOTAL}</span>
        </div>
      ) : null}

      {key === 'identite' && !done ? (
        <>
          <Head mood={STEP_MOOD.identite} title="Salut 👋" lead="Deux choses et on y va." />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Comment tu t&apos;appelles ?
            </span>
            <input
              type="text" value={a.display_name} autoFocus
              onChange={(e) => setA({ ...a, display_name: e.target.value })}
              placeholder="Ton prénom" className="dk-input"
            />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Quels vêtements je te montre ?
            </span>
            <TileGrid options={GENDERS} selected={a.gender ? [a.gender] : []} toggle={choose('gender')} single />
            <button
              type="button"
              onClick={() => setA({ ...a, gender: a.gender === 'non_precise' ? null : 'non_precise' })}
              style={{
                minHeight: 44, border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 13.5, color: a.gender === 'non_precise' ? 'var(--ink)' : 'var(--muted)',
                fontWeight: a.gender === 'non_precise' ? 600 : 400,
                textDecoration: a.gender === 'non_precise' ? 'none' : 'underline',
              }}
            >
              Je préfère ne pas dire
            </button>
          </div>
        </>
      ) : null}

      {key === 'objectifs' && !done ? (
        <>
          <Head mood={STEP_MOOD.objectifs} title={"Qu’est-ce que tu veux obtenir ?"} lead="Tu peux en choisir plusieurs." />
          <TileGrid options={GOALS} selected={a.goals} toggle={toggle('goals')} />
        </>
      ) : null}

      {key === 'style' && !done ? (
        <>
          <Head mood={STEP_MOOD.style} title="Ton style, tu le décrirais comment ?" lead="Prends ce qui te ressemble." />
          <TileGrid options={STYLES} selected={a.styles} toggle={toggle('styles')} columns={3} />
        </>
      ) : null}

      {key === 'pieces' && !done ? (
        <>
          <Head mood={STEP_MOOD.pieces} title={"Qu’est-ce que tu portes le plus ?"} lead="Ce que tu mets vraiment, pas ce qui dort au fond." />
          <TileGrid options={ITEMS} selected={a.favourite_items} toggle={toggle('favourite_items')} columns={3} />
        </>
      ) : null}

      {key === 'couleurs' && !done ? (
        <>
          <Head mood={STEP_MOOD.couleurs} title="Tes couleurs" lead="Celles que tu portes volontiers." />
          <Swatches selected={a.colours} toggle={toggle('colours')} />
        </>
      ) : null}

      {key === 'eviter' && !done ? (
        <>
          <Head mood={STEP_MOOD.eviter} title="Et ce que tu évites ?" lead={"Ça m’évite de te proposer à côté."} />
          <RowList options={AVOID} selected={a.avoid} pick={toggle('avoid')} />
        </>
      ) : null}

      {key === 'occasions' && !done ? (
        <>
          <Head mood={STEP_MOOD.occasions} title={"Tu t’habilles pour quoi ?"} lead="Plusieurs réponses possibles." />
          <TileGrid options={OCCASIONS} selected={a.occasions} toggle={toggle('occasions')} />
        </>
      ) : null}

      {key === 'rythme' && !done ? (
        <>
          <Head mood={STEP_MOOD.rythme} title="Ton rythme le matin" lead="Pour savoir si je dois aller vite ou prendre le temps." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Combien de temps pour t&apos;habiller
            </span>
            <RowList options={MORNING_TIME} selected={a.morning_time ? [a.morning_time] : []} pick={choose('morning_time')} single />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Et ce temps, tu voudrais…
            </span>
            <TileGrid options={TIME_INTENT} selected={a.time_intent ? [a.time_intent] : []} toggle={choose('time_intent')} columns={3} single />
          </div>
        </>
      ) : null}

      {key === 'aide' && !done ? (
        <>
          <Head mood={STEP_MOOD.aide} title={"Comment je peux t’aider ?"} lead="Ce que tu attends de moi en premier." />
          <RowList options={ASSISTANCE} selected={a.assistance ? [a.assistance] : []} pick={choose('assistance')} single />
        </>
      ) : null}

      {done ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
            <Kodi mood="celebrate" size={120} track shadow />
          </div>
          <Head
            mood="love"
            title={`${a.display_name || 'Toi'}, voilà ce que j’ai compris`}
            lead="Tu pourras tout changer depuis ton compte."
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {a.styles.length ? <SummaryCard label="Ton style">{labelsFor('styles', a.styles).join(' · ')}</SummaryCard> : null}
            {a.colours.length ? (
              <SummaryCard label="Tes couleurs">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex' }}>
                    {a.colours.slice(0, 5).map((id, i) => (
                      <span key={id} style={{
                        width: 20, height: 20, borderRadius: 999, background: colourHex(id),
                        border: '1.5px solid var(--surface)', marginLeft: i ? -7 : 0,
                      }} />
                    ))}
                  </span>
                  {labelsFor('colours', a.colours.slice(0, 2)).join(', ').toLowerCase()}
                  {a.colours.length > 2 ? ` et ${a.colours.length - 2} de plus` : ''}
                </span>
              </SummaryCard>
            ) : null}
            {a.favourite_items.length ? <SummaryCard label="Ce que tu portes">{labelsFor('favourite_items', a.favourite_items).join(' · ').toLowerCase()}</SummaryCard> : null}
            {a.occasions.length ? <SummaryCard label="Pour">{labelsFor('occasions', a.occasions).join(' · ').toLowerCase()}</SummaryCard> : null}
            {a.avoid.length ? <SummaryCard label="Tu évites">{labelsFor('avoid', a.avoid).join(' · ').toLowerCase()}</SummaryCard> : null}
            {a.morning_time ? (
              <SummaryCard label="Ton rythme">
                {labelsFor('morning_time', a.morning_time)[0].toLowerCase()}
                {a.time_intent ? ` · tu veux ${labelsFor('time_intent', a.time_intent)[0].toLowerCase()}` : ''}
              </SummaryCard>
            ) : null}
            {a.goals.length ? <SummaryCard label="Ton objectif">{labelsFor('goals', a.goals).join(' · ').toLowerCase()}</SummaryCard> : null}
            {a.assistance ? <SummaryCard label="Je commence par">{labelsFor('assistance', a.assistance)[0].toLowerCase()}</SummaryCard> : null}
          </div>

          {!a.styles.length && !a.colours.length && !a.goals.length ? (
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--muted)' }}>
              Tu as tout passé, c&apos;est très bien : je partirai de ce que tu ajoutes
              dans ton dressing, et j&apos;affinerai en te voyant faire.
            </p>
          ) : null}

          {error ? (
            <p role="alert" style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--tile)', borderRadius: 14, padding: '10px 14px' }}>
              {error}
            </p>
          ) : null}
        </>
      ) : null}

      {/* Barre d'action fixe : le pouce la trouve toujours au même endroit. */}
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20,
          maxWidth: 430, margin: '0 auto', padding: '18px 20px calc(20px + env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, var(--bg) 70%, transparent)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}
      >
        {!done && step > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" onClick={() => setStep((s) => s - 1)} className="dk-btn dk-btn--ghost dk-btn--sm dk-tap">
              <Icon name="chevronLeft" size={16} /> Revenir
            </button>
            <button type="button" onClick={() => setStep((s) => s + 1)} className="dk-btn dk-btn--ghost dk-btn--sm dk-tap">
              Passer <Icon name="chevronRight" size={16} />
            </button>
          </div>
        ) : null}

        <button
          type="button"
          disabled={(!done && !canAdvance) || pending}
          onClick={() => (done ? submit() : setStep((s) => s + 1))}
          className={`${btn.primary} dk-btn--block`}
        >
          {pending ? 'Un instant…' : done ? (adjusting ? 'Enregistrer' : 'Entrer dans mon dressing') : step === TOTAL - 1 ? 'Voir le résumé' : 'Continuer'}
          {pending ? null : <Icon name="chevronRight" size={18} />}
        </button>
      </div>
    </main>
  );
}
