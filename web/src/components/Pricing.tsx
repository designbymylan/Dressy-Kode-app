'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { Kodi } from '@/components/Kodi';
import { btn } from '@/components/ui';
import { FEATURES, FREE_LIMITS, PLANS, eur, perMonth, saving, type Period, type Plan, type PlanId } from '@/lib/plans';

/**
 * Les deux offres, d'après la référence « design price » : un tableau de
 * comparaison à deux colonnes, puis une feuille qui monte pour choisir
 * entre le mois et l'année. La colonne choisie passe en bleu.
 */
export function Pricing({ current }: { current: PlanId }) {
  const [pick, setPick] = useState<Plan['id']>(current === 'sapologue' ? 'fashion' : 'sapologue');
  const [open, setOpen] = useState(false);
  const plan = PLANS[pick];
  const off = saving(plan);

  return (
    <section
      id="offres"
      aria-label="Abonnements"
      style={{
        scrollMarginTop: 60, borderRadius: 28, padding: '24px 14px 16px', display: 'flex', flexDirection: 'column', gap: 18,
        background: 'linear-gradient(180deg, var(--blue-soft) 0%, var(--surface) 46%, var(--surface) 100%)',
        border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
        <span className="dk-label" style={{ color: 'var(--ink)', letterSpacing: '.14em' }}>Offres Dressy</span>
        <h2 style={{ fontSize: 30 }}>Passe à {plan.name}</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>{plan.tagline}</p>
      </header>

      <div role="radiogroup" aria-label="Choisis ton offre" style={{ display: 'grid', gridTemplateColumns: '1fr 58px 80px', alignItems: 'center', gap: 2 }}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Choisis ton offre</span>
        {(['fashion', 'sapologue'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={pick === id}
            className="dk-chip dk-tap"
            onClick={() => setPick(id)}
            style={{ minHeight: 32, padding: '0 8px', justifyContent: 'center', fontSize: 12 }}
          >
            {PLANS[id].name}
          </button>
        ))}
      </div>

      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {FEATURES.map((f) => (
          <li key={f.title} style={{ display: 'grid', gridTemplateColumns: '1fr 58px 80px', alignItems: 'center', gap: 2 }}>
            <span style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
              <Icon name={f.icon} size={22} />
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{f.title}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.35 }}>{f.sub}</span>
              </span>
            </span>
            {([f.fashion, f.sapologue] as const).map((has, col) => {
              const colPlan = col ? 'Sapologue' : 'Fashion';
              const lit = (col ? 'sapologue' : 'fashion') === pick;
              return (
                <span key={col} style={{ display: 'grid', placeItems: 'center' }}>
                  {has ? (
                    <Icon
                      name="checkCircle"
                      size={22}
                      label={`Inclus dans ${colPlan}`}
                      style={{ color: lit ? 'var(--blue-ink)' : 'var(--subtle)', transition: 'color 240ms' }}
                    />
                  ) : (
                    <Icon name="xCircle" size={22} label={`Non inclus dans ${colPlan}`} style={{ color: 'var(--tile-2)' }} />
                  )}
                </span>
              );
            })}
          </li>
        ))}
      </ul>

      {current === pick ? (
        <p className="dk-tag dk-tag--blue" style={{ alignSelf: 'center', fontSize: 11.5 }}>
          <Icon name="check" size={13} /> C’est ton offre actuelle
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="dk-tap"
          style={{
            textAlign: 'left', border: '1px solid var(--glass-edge)', borderRadius: 22, padding: '16px 18px', cursor: 'pointer',
            background: 'var(--blue-glass)', color: '#000', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.85), var(--blue-glow)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <strong style={{ fontSize: 17, letterSpacing: '-.01em' }}>{plan.name} maintenant</strong>
            <span style={{ fontSize: 13, color: 'rgba(0,0,0,.7)' }}>
              Dès {eur(perMonth(plan))} par mois, à l’année
            </span>
          </span>
          <span className="dk-tag dk-tag--butter" style={{ fontSize: 11.5 }}>−{off} %</span>
          <Icon name="chevronRight" size={18} />
        </button>
      )}

      <p style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--muted)', textAlign: 'center' }}>
        Sans abonnement, l’offre Découverte reste gratuite : {FREE_LIMITS}.
      </p>

      {open ? <PeriodSheet plan={plan} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}

function PeriodSheet({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>('year');
  const [done, setDone] = useState(false);
  const off = saving(plan);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), 4200);
    return () => window.clearTimeout(t);
  }, [done]);

  const card = (p: Period) => {
    const on = period === p;
    const price = p === 'year' ? plan.yearly : plan.monthly;
    const each = p === 'year' ? perMonth(plan) : plan.monthly;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => setPeriod(p)}
        className="dk-tap"
        style={{
          position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
          borderRadius: 24, overflow: 'visible', padding: 0, background: 'var(--surface)',
          border: `2px solid ${on ? 'var(--blue-ink)' : 'var(--line)'}`,
          boxShadow: on ? '0 10px 26px rgba(75,125,165,.25)' : 'var(--shadow-1)',
          transform: on ? 'translateY(-2px)' : 'none',
          transition: 'transform 420ms var(--spring), border-color 220ms, box-shadow 220ms',
        }}
      >
        {p === 'year' ? (
          <span className="dk-tag dk-tag--butter" style={{ position: 'absolute', top: -12, fontSize: 11.5, padding: '4px 10px' }}>
            −{off} %
          </span>
        ) : null}
        <span style={{ padding: '22px 8px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{p === 'year' ? '1 an' : '1 mois'}</span>
          <strong style={{ fontSize: 24, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{eur(price)}</strong>
        </span>
        <span
          style={{
            alignSelf: 'stretch', padding: '9px 6px', borderRadius: '0 0 22px 22px', fontSize: 13, fontWeight: 600,
            background: on ? 'var(--blue)' : 'var(--tile)', color: on ? '#000' : 'var(--muted)', transition: 'background 220ms',
          }}
        >
          {eur(each)} / mois
        </span>
      </button>
    );
  };

  return (
    <>
      <div className="dk-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="dk-sheet" role="dialog" aria-modal="true" aria-label={`Offre ${plan.name}`}>
        <span className="dk-sheet__grip" aria-hidden="true" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span className="dk-bubble-ico" style={{ width: 46, height: 46 }}>
            <Icon name={plan.id === 'sapologue' ? 'crown' : 'hanger'} size={22} />
          </span>
          <h2 style={{ fontSize: 28 }}>{plan.name}</h2>
        </div>
        <p style={{ textAlign: 'center', fontSize: 14.5, color: 'var(--muted)' }}>
          Économise {off} % avec l’année
        </p>

        <div role="radiogroup" aria-label="Durée" style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
          {card('month')}
          {card('year')}
        </div>

        <button type="button" className={`${btn.primary} dk-btn--block`} onClick={() => setDone(true)}>
          Essayer 7 jours gratuits
        </button>
        <button type="button" className={`${btn.ghost} dk-btn--block`} onClick={onClose} style={{ minHeight: 40 }}>
          Plus tard
        </button>

        <p style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--muted)', textAlign: 'center' }}>
          Paiement récurrent, résiliable à tout moment depuis Profil. {eur(plan.monthly)} par mois, ou{' '}
          {eur(plan.yearly)} par an (soit {eur(perMonth(plan))} par mois). Rien n’est prélevé pendant l’essai.
        </p>

        {done ? (
          <div className="dk-toast" role="status">
            <Kodi mood="love" size={34} decorative tap={false} />
            <span>
              Le paiement en ligne ouvre très bientôt. Je te préviens dès que {plan.name} {period === 'year' ? 'annuel' : 'mensuel'} est disponible.
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}
