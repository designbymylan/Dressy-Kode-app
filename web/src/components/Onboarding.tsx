'use client';

import { useEffect, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import {
  GENDERS, GOALS, STYLES, ITEM_GROUPS, JEWELRY_GROUPS, NO_JEWELRY, METALS, ACCESSORY_GROUPS,
  COLOURS, AVOID, OCCASIONS, MORNING_TIME, TIME_INTENT, ASSISTANCE,
  forWardrobe, toggleIn, labelsFor, colourHex,
  type Answers, type Group, type Option,
} from '@/lib/onboarding';
import { saveStyleProfile } from '@/app/actions';
import { GlossIcon } from '@/components/Gloss';
import { ICON, Icon } from '@/components/ui';

const STEPS = [
  'identite', 'objectifs', 'style', 'pieces', 'bijoux', 'accessoires',
  'couleurs', 'eviter', 'occasions', 'rythme', 'aide',
] as const;
type Step = (typeof STEPS)[number];
const TOTAL = STEPS.length;
/** Fins de chapitre (toi et ton style, ton dressing, tes couleurs, ton rythme) : un nœud s’y forme une fois franchies. */
const KNOTS = [3, 6, 8, 11];

const PENCIL = 'M4 20h4L19 9l-4-4L4 16ZM13.5 6.5l4 4';

/* ---------- briques d’interface ---------- */

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 999,
        background: on ? 'var(--ink)' : 'transparent',
        border: on ? 'none' : '1.5px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background-color 200ms var(--ease)',
      }}
    >
      {on ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--on-ink)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 12 5 5 11-11" />
        </svg>
      ) : null}
    </span>
  );
}

const tileStyle = (on: boolean, columns: number): CSSProperties => ({
  position: 'relative', minHeight: columns === 3 ? 108 : 112,
  borderWidth: 1.5, borderStyle: 'solid', borderColor: on ? 'var(--ink)' : 'var(--glass-edge)',
  borderRadius: 22, background: on ? 'var(--glass-strong)' : 'var(--glass)', cursor: 'pointer',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 10, padding: '14px 8px', boxShadow: 'var(--shadow-glass)',
  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  transition: 'border-color 200ms var(--ease), transform 300ms var(--ease-spring)',
});

function Tile({
  option, on, onPick, columns, single, tone,
}: { option: Option; on: boolean; onPick: () => void; columns: number; single?: boolean; tone: number }) {
  return (
    <button
      type="button"
      role={single ? 'radio' : 'checkbox'}
      aria-checked={on}
      onClick={onPick}
      style={tileStyle(on, columns)}
    >
      <Check on={on} />
      {option.icon ? <GlossIcon d={option.icon} tone={tone} size={46} /> : null}
      <span style={{ fontSize: 12.5, textAlign: 'center', lineHeight: 1.25, fontWeight: 500 }}>{option.label}</span>
    </button>
  );
}

function TileGrid({
  options, selected, toggle, columns = 2, single, toneFrom = 0,
}: { options: Option[]; selected: string[]; toggle: (id: string) => void; columns?: number; single?: boolean; toneFrom?: number }) {
  return (
    <div role={single ? 'radiogroup' : 'group'} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 10 }}>
      {options.map((o, i) => (
        <Tile key={o.id} option={o} columns={columns} single={single} tone={toneFrom + i} on={selected.includes(o.id)} onPick={() => toggle(o.id)} />
      ))}
    </div>
  );
}

function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="eyebrow" style={{ padding: '6px 4px 0' }}>
      {children}
    </h2>
  );
}

function Row({
  option, on, onPick, single, tone,
}: { option: Option; on: boolean; onPick: () => void; single?: boolean; tone: number }) {
  return (
    <button
      type="button"
      role={single ? 'radio' : 'checkbox'}
      aria-checked={on}
      onClick={onPick}
      style={{
        minHeight: 62, width: '100%', textAlign: 'left',
        border: `1.5px solid ${on ? 'var(--ink)' : 'var(--glass-edge)'}`,
        borderRadius: 999, background: on ? 'var(--glass-strong)' : 'var(--glass)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px 0 10px',
        boxShadow: 'var(--shadow-glass)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        transition: 'border-color 200ms var(--ease)',
      }}
    >
      {option.icon ? <GlossIcon d={option.icon} tone={tone} size={40} /> : null}
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>{option.label}</span>
      {on ? <Icon d={ICON.check} size={18} width={2.4} /> : null}
    </button>
  );
}

function RowList({
  options, selected, pick, single, toneFrom = 0,
}: { options: Option[]; selected: string[]; pick: (id: string) => void; single?: boolean; toneFrom?: number }) {
  return (
    <div role={single ? 'radiogroup' : 'group'} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map((o, i) => (
        <Row key={o.id} option={o} single={single} tone={toneFrom + i} on={selected.includes(o.id)} onPick={() => pick(o.id)} />
      ))}
    </div>
  );
}

/* ---------- « je porte » / « j’aimerais porter » ---------- */

type Wear = 'porte' | 'aimerait' | null;
const WEAR_LABEL: Record<Exclude<Wear, null>, string> = { porte: 'Je porte', aimerait: 'J’aimerais' };

function WearBadge({ state }: { state: Exclude<Wear, null> }) {
  const porte = state === 'porte';
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute', top: 7, right: 7, height: 22, padding: '0 8px', borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500,
        background: porte ? 'var(--ink)' : 'var(--glass-strong)',
        color: porte ? 'var(--on-ink)' : 'var(--ink)',
        border: porte ? 'none' : '1px dashed var(--ink)',
      }}
    >
      <Icon d={porte ? ICON.check : ICON.sparkle} size={11} width={2.4} />
      {WEAR_LABEL[state]}
    </span>
  );
}

function Legend() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ position: 'relative', display: 'inline-block', width: 88, height: 22 }}><WearBadge state="porte" /></span>
        <span style={{ position: 'relative', display: 'inline-block', width: 96, height: 22 }}><WearBadge state="aimerait" /></span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 }}>
        Une touche : tu en portes au quotidien. Deux touches : tu aimerais en porter. Trois touches : on repart de zéro.
      </p>
    </div>
  );
}

/**
 * Grille à trois états. Chaque touche fait tourner l’état de l’option :
 * rien, puis « je porte », puis « j’aimerais porter », puis rien.
 */
function WearGrid({
  groups, worn, wish, onChange,
}: { groups: Group[]; worn: string[]; wish: string[]; onChange: (worn: string[], wish: string[]) => void }) {
  const state = (id: string): Wear => (worn.includes(id) ? 'porte' : wish.includes(id) ? 'aimerait' : null);
  const cycle = (id: string) => {
    const s = state(id);
    const w = worn.filter((x) => x !== id && x !== NO_JEWELRY.id);
    const d = wish.filter((x) => x !== id);
    if (s === null) onChange([...w, id], d);
    else if (s === 'porte') onChange(w, [...d, id]);
    else onChange(w, d);
  };
  let tone = 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {groups.map((g) => (
        <section key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GroupTitle>{g.label}</GroupTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {g.options.map((o) => {
              const s = state(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => cycle(o.id)}
                  aria-label={`${o.label} : ${s === 'porte' ? 'tu en portes' : s === 'aimerait' ? 'tu aimerais en porter' : 'pas choisi'}. Touche pour changer.`}
                  style={{
                    ...tileStyle(s !== null, 3),
                    borderStyle: s === 'aimerait' ? 'dashed' : 'solid',
                    paddingTop: 30,
                  }}
                >
                  {s ? <WearBadge state={s} /> : null}
                  {o.icon ? <GlossIcon d={o.icon} tone={tone++} size={44} on={s === 'porte'} /> : null}
                  <span style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.25, fontWeight: s ? 600 : 500 }}>{o.label}</span>
                </button>
              );
            })}
          </div>
        </section>
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
                width: 52, height: 52, borderRadius: 999,
                // Une pastille plate de la couleur, à angles droits.
                background: c.hex,
                // Le blanc et la crème disparaîtraient sur fond clair sans ce filet.
                border: `2px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 200ms var(--ease)',
              }}
            >
              {on ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke={['blanc', 'creme', 'beige', 'ciel', 'jaune', 'argente'].includes(c.id) ? '#0D0D0E' : '#FFFFFF'}
                  strokeWidth="2.6" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
                  <path d="M4.5 12.5l4.8 4.8L19.5 7" />
                </svg>
              ) : null}
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Metals({ selected, toggle }: { selected: string[]; toggle: (id: string) => void }) {
  return (
    <div role="group" aria-label="Métal préféré" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      {METALS.map((m) => {
        const on = selected.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => toggle(m.id)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 50, height: 50, borderRadius: 999, background: m.fill, position: 'relative',
                border: `2px solid ${on ? 'var(--ink)' : 'var(--glass-edge)'}`,
                boxShadow: 'inset 0 2px 3px rgba(255,255,255,.8), inset 0 -6px 10px -4px rgba(0,0,0,.25), 0 8px 14px -8px rgba(20,24,40,.45)',
                transform: on ? 'scale(1.06)' : 'none',
                transition: 'transform 300ms var(--ease-spring), border-color 200ms var(--ease)',
              }}
            />
            <span style={{ fontSize: 11.5, fontWeight: 500 }}>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Head({ title, lead }: { title: ReactNode; lead: string }) {
  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h1 style={{ fontSize: 24 }}>{title}</h1>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>{lead}</p>
    </header>
  );
}

/* ---------- le résumé ---------- */

function SummaryCard({
  label, children, onEdit,
}: { label: string; children: ReactNode | null; onEdit: () => void }) {
  const empty = children === null;
  return (
    <div
      className="glass"
      style={{ borderRadius: 22, padding: '14px 10px 14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, letterSpacing: 0, textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontSize: 14.5, lineHeight: 1.4, color: empty ? 'var(--muted)' : 'var(--ink)' }}>
          {empty ? 'Pas encore renseigné' : children}
        </span>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="chip"
        aria-label={`${empty ? 'Ajouter' : 'Modifier'} : ${label}`}
        style={{ flex: 'none', minHeight: 44 }}
      >
        <Icon d={empty ? ICON.plus : PENCIL} size={15} width={1.8} />
        {empty ? 'Ajouter' : 'Modifier'}
      </button>
    </div>
  );
}

const low = (xs: string[]) => xs.join(' · ').toLowerCase();

function summary(a: Answers): { step: Step; label: string; value: ReactNode | null }[] {
  const gender = a.gender ? labelsFor('gender', a.gender)[0].toLowerCase() : null;
  const worn = a.jewelry.includes(NO_JEWELRY.id) ? ['aucun au quotidien'] : labelsFor('jewelry', a.jewelry);
  const jewel = [
    worn.length ? `tu portes : ${low(worn)}` : null,
    a.jewelry_wish.length ? `tu aimerais : ${low(labelsFor('jewelry', a.jewelry_wish))}` : null,
    a.metals.length ? `métal : ${low(labelsFor('metals', a.metals))}` : null,
  ].filter(Boolean);
  const acc = [
    a.accessories.length ? `tu portes : ${low(labelsFor('accessories', a.accessories))}` : null,
    a.accessories_wish.length ? `tu aimerais : ${low(labelsFor('accessories', a.accessories_wish))}` : null,
  ].filter(Boolean);

  return [
    { step: 'identite', label: 'Toi', value: a.display_name.trim() ? `${a.display_name.trim()}${gender ? ` · vêtements ${gender}` : ''}` : null },
    { step: 'objectifs', label: 'Ton objectif', value: a.goals.length ? low(labelsFor('goals', a.goals)) : null },
    { step: 'style', label: 'Ton style', value: a.styles.length ? labelsFor('styles', a.styles).join(' · ') : null },
    { step: 'pieces', label: 'Ce que tu portes le plus', value: a.favourite_items.length ? low(labelsFor('favourite_items', a.favourite_items)) : null },
    { step: 'bijoux', label: 'Tes bijoux', value: jewel.length ? jewel.join(' ; ') : null },
    { step: 'accessoires', label: 'Tes accessoires', value: acc.length ? acc.join(' ; ') : null },
    {
      step: 'couleurs',
      label: 'Tes couleurs',
      value: a.colours.length ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex' }}>
            {a.colours.slice(0, 5).map((id, i) => (
              <span key={id} style={{
                width: 20, height: 20, borderRadius: 999, background: colourHex(id),
                border: '1.5px solid var(--ground)', marginLeft: i ? -7 : 0,
              }} />
            ))}
          </span>
          {labelsFor('colours', a.colours.slice(0, 2)).join(', ').toLowerCase()}
          {a.colours.length > 2 ? ` et ${a.colours.length - 2} de plus` : ''}
        </span>
      ) : null,
    },
    { step: 'eviter', label: 'Tu évites', value: a.avoid.length ? low(labelsFor('avoid', a.avoid)) : null },
    { step: 'occasions', label: 'Pour', value: a.occasions.length ? low(labelsFor('occasions', a.occasions)) : null },
    {
      step: 'rythme',
      label: 'Ton rythme',
      value: a.morning_time
        ? `${labelsFor('morning_time', a.morning_time)[0].toLowerCase()}${a.time_intent ? ` · tu veux ${labelsFor('time_intent', a.time_intent)[0].toLowerCase()}` : ''}`
        : null,
    },
    { step: 'aide', label: 'Je commence par', value: a.assistance ? labelsFor('assistance', a.assistance)[0].toLowerCase() : null },
  ];
}

/* ---------- le parcours ---------- */

export function Onboarding({ initial, adjusting = false }: { initial: Answers; adjusting?: boolean }) {
  // En ajustement depuis le compte, on ouvre directement sur le résumé.
  const [step, setStep] = useState(adjusting ? TOTAL : 0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState<Answers>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const done = step >= TOTAL;
  const key: Step = STEPS[Math.min(step, TOTAL - 1)];

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [step]);

  const goTo = (to: number) => {
    setDir(to >= step ? 1 : -1);
    setStep(Math.max(0, Math.min(TOTAL, to)));
  };
  const next = () => goTo(editing ? TOTAL : step + 1);
  const back = () => goTo(editing || done ? (done ? TOTAL - 1 : TOTAL) : step - 1);
  const edit = (s: Step) => { setEditing(true); goTo(STEPS.indexOf(s)); };
  useEffect(() => { if (done) setEditing(false); }, [done]);

  const toggle = (field: 'goals' | 'styles' | 'favourite_items' | 'colours' | 'avoid' | 'occasions', options: Option[] = []) => (id: string) =>
    setA((prev) => ({ ...prev, [field]: toggleIn(prev[field], id, options) }));

  // Un second clic annule le choix : rien n’oblige à répondre.
  const choose = (field: 'gender' | 'morning_time' | 'time_intent' | 'assistance') => (id: string) =>
    setA((prev) => ({ ...prev, [field]: prev[field] === id ? null : id }));

  const canAdvance = key !== 'identite' || a.display_name.trim().length > 0;
  const items = ITEM_GROUPS
    .map((g) => ({ ...g, options: forWardrobe(g.options, a.gender) }))
    .filter((g) => g.options.length);

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await saveStyleProfile(a);
      if (res?.error) setError(res.error);
    });

  const showBack = done || step > 0 || editing;
  const primaryLabel = pending
    ? 'Kodi prépare ton espace'
    : done
      ? (adjusting ? 'Enregistrer' : 'Entrer dans mon dressing')
      : editing ? 'Revenir au résumé' : step === TOTAL - 1 ? 'Voir le résumé' : 'Continuer';

  return (
    <main
      style={{
        maxWidth: 430, margin: '0 auto', minHeight: '100dvh',
        padding: 'calc(env(safe-area-inset-top, 0px) + 56px) 20px 190px', display: 'flex', flexDirection: 'column', gap: 20,
      }}
    >
      {!done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Le fil de progression : un point de couture qui avance, un nœud à chaque chapitre franchi. */}
          <div
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={TOTAL}
            aria-label={`Question ${step + 1} sur ${TOTAL}`}
            className="thread"
          >
            <span className="thread-line thread-todo" />
            <span className="thread-line thread-done" style={{ width: `${((step + 1) / TOTAL) * 100}%` }} />
            {KNOTS.map((end) => (
              <span
                key={end}
                className="thread-knot"
                data-tied={step >= end || undefined}
                style={{ left: end === TOTAL ? 'calc(100% - 4.5px)' : `${(end / TOTAL) * 100}%` }}
              />
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{step + 1}/{TOTAL}</span>
        </div>
      ) : null}

      <div key={done ? 'resume' : key} className={dir > 0 ? 'step-in' : 'step-back'} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {key === 'identite' && !done ? (
          <>
            <Head title={<>Faisons <em className="accent">connaissance</em></>} lead="Deux choses et on y va." />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, letterSpacing: 0, textTransform: 'uppercase', color: 'var(--muted)' }}>
                Comment tu t’appelles ?
              </span>
              <input
                type="text" value={a.display_name} autoFocus autoComplete="given-name"
                onChange={(e) => setA({ ...a, display_name: e.target.value })}
                placeholder="Ton prénom" className="input"
              />
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 12, letterSpacing: 0, textTransform: 'uppercase', color: 'var(--muted)' }}>
                Quels vêtements je te montre ?
              </span>
              <TileGrid options={GENDERS} selected={a.gender ? [a.gender] : []} toggle={choose('gender')} single toneFrom={3} />
              <button
                type="button"
                onClick={() => setA({ ...a, gender: a.gender === 'non_precise' ? null : 'non_precise' })}
                className="btn btn-ghost"
                aria-pressed={a.gender === 'non_precise'}
                style={{ color: a.gender === 'non_precise' ? 'var(--ink)' : 'var(--muted)', fontWeight: a.gender === 'non_precise' ? 600 : 500 }}
              >
                {a.gender === 'non_precise' ? <Icon d={ICON.check} size={16} width={2.4} /> : null}
                Je préfère ne pas dire
              </button>
            </div>
          </>
        ) : null}

        {key === 'objectifs' && !done ? (
          <>
            <Head
              title={<>Qu’est-ce que tu veux <em className="accent">obtenir</em> ?</>}
              lead="Choisis-en plusieurs, ou « Un peu de tout » si tout te parle."
            />
            <TileGrid options={GOALS} selected={a.goals} toggle={toggle('goals', GOALS)} />
          </>
        ) : null}

        {key === 'style' && !done ? (
          <>
            <Head title={<>Ton style, tu le décrirais <em className="accent">comment</em> ?</>} lead="Prends ce qui te ressemble." />
            <TileGrid options={STYLES} selected={a.styles} toggle={toggle('styles')} columns={3} toneFrom={1} />
          </>
        ) : null}

        {key === 'pieces' && !done ? (
          <>
            <Head
              title={<>Qu’est-ce que tu portes le <em className="accent">plus</em> ?</>}
              lead="Ce que tu mets vraiment, pas ce qui dort au fond. Autant de pièces que tu veux."
            />
            {items.map((g, gi) => (
              <section key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <GroupTitle>{g.label}</GroupTitle>
                <TileGrid options={g.options} selected={a.favourite_items} toggle={toggle('favourite_items')} columns={3} toneFrom={gi * 2} />
              </section>
            ))}
          </>
        ) : null}

        {key === 'bijoux' && !done ? (
          <>
            <Head title={<>Et tes <em className="accent">bijoux</em> ?</>} lead="Pour que Kodi les glisse dans tes tenues, ou te suggère ceux qui leur manquent." />
            <Legend />
            <WearGrid
              groups={JEWELRY_GROUPS}
              worn={a.jewelry}
              wish={a.jewelry_wish}
              onChange={(jewelry, jewelry_wish) => setA({ ...a, jewelry, jewelry_wish })}
            />
            <button
              type="button"
              role="checkbox"
              aria-checked={a.jewelry.includes(NO_JEWELRY.id)}
              onClick={() => setA({ ...a, jewelry: a.jewelry.includes(NO_JEWELRY.id) ? [] : [NO_JEWELRY.id] })}
              className="chip"
              style={{ alignSelf: 'center', minHeight: 44 }}
            >
              {NO_JEWELRY.label}
            </button>
            <GroupTitle>Plutôt quel métal ?</GroupTitle>
            <Metals
              selected={a.metals}
              toggle={(id) => setA({ ...a, metals: toggleIn(a.metals, id, METALS.map((m) => ({ id: m.id, label: m.label, alone: m.id === 'mixte' }))) })}
            />
          </>
        ) : null}

        {key === 'accessoires' && !done ? (
          <>
            <Head title={<>Tes <em className="accent">accessoires</em></>} lead="Ceux de tous les jours, et ceux que tu aimerais oser." />
            <Legend />
            <WearGrid
              groups={ACCESSORY_GROUPS}
              worn={a.accessories}
              wish={a.accessories_wish}
              onChange={(accessories, accessories_wish) => setA({ ...a, accessories, accessories_wish })}
            />
          </>
        ) : null}

        {key === 'couleurs' && !done ? (
          <>
            <Head title={<>Tes <em className="accent">couleurs</em></>} lead="Celles que tu portes volontiers." />
            <Swatches selected={a.colours} toggle={toggle('colours')} />
          </>
        ) : null}

        {key === 'eviter' && !done ? (
          <>
            <Head title={<>Et ce que tu <em className="accent">évites</em> ?</>} lead={"Pour ne pas te proposer ce qui ne te ressemble pas."} />
            <RowList options={AVOID} selected={a.avoid} pick={toggle('avoid')} toneFrom={2} />
          </>
        ) : null}

        {key === 'occasions' && !done ? (
          <>
            <Head title={<>Tu t’habilles pour <em className="accent">quoi</em> ?</>} lead="Plusieurs réponses possibles." />
            <TileGrid options={OCCASIONS} selected={a.occasions} toggle={toggle('occasions')} toneFrom={4} />
          </>
        ) : null}

        {key === 'rythme' && !done ? (
          <>
            <Head title={<>Ton rythme le <em className="accent">matin</em></>} lead="Pour savoir si je dois aller vite ou prendre le temps." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <GroupTitle>Combien de temps pour t’habiller</GroupTitle>
              <RowList options={MORNING_TIME} selected={a.morning_time ? [a.morning_time] : []} pick={choose('morning_time')} single toneFrom={2} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <GroupTitle>Et ce temps, tu voudrais…</GroupTitle>
              <TileGrid options={TIME_INTENT} selected={a.time_intent ? [a.time_intent] : []} toggle={choose('time_intent')} columns={3} single toneFrom={1} />
            </div>
          </>
        ) : null}

        {key === 'aide' && !done ? (
          <>
            <Head title={<>Comment je peux t’<em className="accent">aider</em> ?</>} lead="Ce que tu attends de moi en premier." />
            <RowList options={ASSISTANCE} selected={a.assistance ? [a.assistance] : []} pick={choose('assistance')} single toneFrom={1} />
          </>
        ) : null}

        {done ? (
          <>
            <GlossIcon d={ICON.sparkle} tone={1} size={48} />
            <Head
              title={<>{a.display_name.trim() || 'Toi'}, voilà ce que j’ai <em className="accent">compris</em></>}
              lead="Quelque chose ne va pas, ou manque ? Touche « Modifier » : tu reviens ici juste après."
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {summary(a).map((s) => (
                <SummaryCard key={s.step} label={s.label} onEdit={() => edit(s.step)}>{s.value}</SummaryCard>
              ))}
            </div>

            {error ? (
              <p role="alert" className="note note-error pop">{error}</p>
            ) : null}
          </>
        ) : null}
      </div>

      {/* Barre d’action fixe : le pouce la trouve toujours au même endroit. */}
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 5,
          maxWidth: 430, margin: '0 auto', padding: '16px 20px calc(env(safe-area-inset-bottom, 0px) + 16px)',
          background: 'linear-gradient(to top, var(--bg) 64%, transparent)',
          display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6,
        }}
      >
        <div style={{ display: 'flex', gap: 10 }}>
          {showBack ? (
            <button
              type="button"
              onClick={back}
              disabled={pending}
              className="btn btn-glass btn-icon"
              aria-label={editing ? 'Revenir au résumé' : 'Revenir à la question précédente'}
              style={{ width: 54, height: 54, minHeight: 54, flex: 'none' }}
            >
              <Icon d={ICON.back} size={20} width={2} />
            </button>
          ) : null}
          <button
            type="button"
            disabled={(!done && !canAdvance) || pending}
            aria-busy={pending || undefined}
            onClick={() => (done ? submit() : next())}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {primaryLabel}
          </button>
        </div>
        {!done && !editing && step > 0 ? (
          <button type="button" onClick={next} className="btn btn-ghost" style={{ minHeight: 40, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Passer
          </button>
        ) : null}
      </div>
    </main>
  );
}
