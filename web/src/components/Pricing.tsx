'use client';

import { useActionState, useEffect, useState } from 'react';
import { openPortal, startCheckout, type FormResult } from '@/app/actions';
import { Icon, type IconName } from '@/components/icons';
import { SubmitButton } from '@/components/SubmitButton';
import { ErrorNote } from '@/components/ui';
import { COMPARE, FREE_PLAN, PLANS, euros, saving, type Period, type Plan, type PlanId } from '@/lib/plans';

const GRID = { display: 'grid', gridTemplateColumns: '1fr 54px 80px', alignItems: 'center', gap: 0 } as const;

/**
 * Les deux offres (21/10), d'après la référence « App design price » : un
 * tableau de comparaison à deux colonnes, l'offre choisie en bleu, puis une
 * feuille qui monte (sur un geste, jamais toute seule) pour choisir le mois
 * ou l'année. Le paiement s'ouvre chez Stripe ; une abonnée gère son offre
 * par le portail.
 */
export function Pricing({ current, trial }: { current: PlanId | null; trial: boolean }) {
  const [pick, setPick] = useState<PlanId>(current === 'atelier' ? 'capsule' : 'atelier');
  const [open, setOpen] = useState(false);
  const plan = PLANS.find((p) => p.id === pick)!;
  const off = saving(plan);

  return (
    <section
      id="offres"
      aria-label="Offres"
      className="rise"
      style={{
        scrollMarginTop: 60, borderRadius: 'var(--r-card)', padding: '24px 14px 16px', display: 'flex', flexDirection: 'column', gap: 18,
        background: 'linear-gradient(180deg, var(--blue-soft) 0%, var(--glass-strong) 48%)',
        border: '1px solid var(--glass-edge)', boxShadow: 'var(--shadow-glass)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
        <span className="eyebrow" style={{ color: 'var(--ink)' }}>Offres Dresskode</span>
        <h2 style={{ fontSize: 30 }}>Passe à {plan.name}</h2>
        <p className="small muted">{plan.note}</p>
      </header>

      <div role="radiogroup" aria-label="Choisis ton offre" style={GRID}>
        <span className="small muted">Choisis ton offre</span>
        {PLANS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={pick === p.id}
            className="chip"
            onClick={() => setPick(p.id)}
            style={{ minHeight: 32, padding: '0 8px', justifyContent: 'center', fontSize: 12.5 }}
          >
            {p.name}
          </button>
        ))}
      </div>

      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {COMPARE.map((f) => (
          <li key={f.title} style={GRID}>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
              <Icon name={f.icon as IconName} size={20} />
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
                  {f.title}
                  {f.soon ? <span className="muted" style={{ fontWeight: 500 }}> · bientôt</span> : null}
                </span>
                <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.35 }}>{f.sub}</span>
              </span>
            </span>
            {PLANS.map((p) => {
              const has = f[p.id];
              const lit = p.id === pick;
              return (
                <span key={p.id} style={{ display: 'grid', placeItems: 'center' }}>
                  {has ? (
                    <Icon name="checkCircle" size={22} label={`Inclus dans ${p.name}`}
                      style={{ color: lit ? 'var(--blue-ink)' : 'var(--muted)', transition: 'color 240ms' }} />
                  ) : (
                    <Icon name="xCircle" size={22} label={`Pas dans ${p.name}`} style={{ color: 'var(--rule)' }} />
                  )}
                </span>
              );
            })}
          </li>
        ))}
      </ul>

      {current === pick ? (
        <p className="dk-tag dk-tag--blue" style={{ alignSelf: 'center', fontSize: 12 }}>
          <Icon name="check" size={13} /> C’est ton offre
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="dk-tap"
          style={{
            textAlign: 'left', border: '1px solid rgba(255,255,255,.7)', borderRadius: 24, padding: '16px 18px', cursor: 'pointer',
            background: 'var(--blue-glass)', color: '#000', boxShadow: 'var(--blue-shadow)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <strong style={{ fontSize: 18, fontWeight: 600 }}>{plan.name} maintenant</strong>
            <span style={{ fontSize: 13, color: 'rgba(0,0,0,.7)' }}>
              Dès {euros(Math.round(plan.cents.an / 12))} par mois, à l’année
            </span>
          </span>
          <span className="dk-tag dk-tag--butter" style={{ fontSize: 12 }}>−{off} %</span>
          <Icon name="chevronRight" size={18} />
        </button>
      )}

      {current === null ? (
        <p className="small muted center">
          Sans abonnement, tu restes sur {FREE_PLAN.name} : {FREE_PLAN.features.map((f) => f.charAt(0).toLowerCase() + f.slice(1)).join(', ')}.
        </p>
      ) : null}

      {open ? <PeriodSheet plan={plan} current={current} trial={trial} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}

function PeriodSheet({ plan, current, trial, onClose }: { plan: Plan; current: PlanId | null; trial: boolean; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>('an');
  const [checkout, checkoutAction] = useActionState<FormResult, FormData>(startCheckout, undefined);
  const [portal, portalAction] = useActionState<FormResult, FormData>(openPortal, undefined);
  const error = checkout?.error ?? portal?.error;
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

  const card = (p: Period) => {
    const on = period === p;
    const each = p === 'an' ? Math.round(plan.cents.an / 12) : plan.cents.mois;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => setPeriod(p)}
        style={{
          position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
          borderRadius: 24, padding: 0, background: 'var(--glass-strong)', color: 'var(--ink)',
          border: `2px solid ${on ? 'var(--blue-ink)' : 'var(--rule)'}`,
          boxShadow: on ? '0 10px 26px -8px rgba(75,125,165,.45)' : 'var(--shadow-glass)',
          transform: on ? 'translateY(-2px)' : 'none',
          transition: 'transform 420ms var(--ease-spring), border-color 220ms, box-shadow 220ms',
        }}
      >
        {p === 'an' ? (
          <span className="dk-tag dk-tag--butter" style={{ position: 'absolute', top: -12, fontSize: 12, padding: '4px 10px' }}>−{off} %</span>
        ) : null}
        <span style={{ padding: '22px 8px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span className="small muted">{p === 'an' ? '1 an' : '1 mois'}</span>
          <span className="stat" style={{ fontSize: 26 }}>{euros(plan.cents[p])}</span>
          {p === 'an' ? <s className="muted" style={{ fontSize: 12 }}>{euros(plan.cents.mois * 12)}</s> : <span style={{ fontSize: 12 }}>&nbsp;</span>}
        </span>
        <span
          style={{
            alignSelf: 'stretch', padding: '9px 6px', borderRadius: '0 0 22px 22px', fontSize: 13, fontWeight: 600,
            background: on ? 'var(--blue)' : 'var(--stage)', color: on ? '#000' : 'var(--muted)', transition: 'background-color 220ms',
          }}
        >
          {euros(each)} / mois
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
            <Icon name={plan.id === 'atelier' ? 'crown' : 'hanger'} size={22} />
          </span>
          <h2 style={{ fontSize: 28 }}>{plan.name}</h2>
        </div>
        <p className="center muted">Économise {off} % avec l’année</p>

        <div role="radiogroup" aria-label="Durée" style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
          {card('mois')}
          {card('an')}
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {current ? (
          // Déjà abonnée : le changement d'offre passe par le portail Stripe.
          <form action={portalAction}>
            <SubmitButton label={`Passer à ${plan.name}`} pending="Ouverture" />
          </form>
        ) : (
          <form action={checkoutAction}>
            <input type="hidden" name="plan" value={plan.id} />
            <input type="hidden" name="period" value={period} />
            <SubmitButton
              label={period === 'an' && trial ? 'Commencer mon mois offert' : `Continuer avec ${plan.name}, ${euros(plan.cents[period])}`}
              pending="Ouverture du paiement"
            />
          </form>
        )}
        <button type="button" className="btn btn-ghost btn-block" onClick={onClose} style={{ minHeight: 40 }}>
          Plus tard
        </button>

        <p className="center muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
          {period === 'an'
            ? trial ? 'Premier mois offert, puis facturé une fois par an. ' : 'Facturé une fois par an. '
            : 'Facturé chaque mois. '}
          Sans engagement, résiliable à tout moment depuis Mon compte. Prix TTC, paiement sécurisé.
        </p>
      </div>
    </>
  );
}
