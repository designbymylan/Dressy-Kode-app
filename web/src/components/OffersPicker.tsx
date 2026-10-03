'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { openPortal, startCheckout, type FormResult } from '@/app/actions';
import { PLANS, FREE_PLAN, euros, perMonth, type Period, type PlanId } from '@/lib/plans';
import { ErrorNote, buttonPrimary } from '@/components/ui';

const CHECK = 'm4 12 5 5 11-11';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ ...buttonPrimary, width: '100%', opacity: pending ? 0.6 : 1 }}>
      {pending ? <><span className="spinner" aria-hidden="true" />Ouverture du paiement</> : label}
    </button>
  );
}

const segment = (on: boolean) => ({
  flex: 1, minHeight: 36, border: 'none', borderRadius: 999, cursor: 'pointer',
  fontSize: 13.5, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--ground)' : 'var(--muted)',
});

/**
 * L'écran Offres de design/_projet/Offres.dc.html, onglet Abonnements. La
 * boutique (packs, places en plus) attendra que les packs existent.
 */
export function OffersPicker({
  current,
  trial,
}: {
  current: PlanId | null; // null : Découverte
  trial: boolean; // l'annuel commence-t-il par un mois offert pour cet espace ?
}) {
  const [period, setPeriod] = useState<Period>('an');
  const [plan, setPlan] = useState<PlanId>(current ?? 'atelier');
  const [checkout, checkoutAction] = useActionState<FormResult, FormData>(startCheckout, undefined);
  const [portal, portalAction] = useActionState<FormResult, FormData>(openPortal, undefined);

  const selected = PLANS.find((p) => p.id === plan)!;
  const yearly = period === 'an';
  const error = checkout?.error ?? portal?.error;

  return (
    <main
      style={{
        maxWidth: 390, margin: '0 auto', minHeight: '100dvh',
        padding: '28px 20px 250px', display: 'flex', flexDirection: 'column', gap: 18,
      }}
    >
      <h1 style={{ fontSize: 28, lineHeight: 1.05 }}>Porte mieux, achète moins.</h1>

      <div
        role="radiogroup"
        aria-label="Facturation"
        style={{
          minHeight: 44, borderRadius: 999, background: 'var(--ground)', boxShadow: 'var(--shadow-soft)',
          display: 'flex', alignItems: 'center', padding: 4, gap: 4,
        }}
      >
        <button type="button" role="radio" aria-checked={yearly} onClick={() => setPeriod('an')} style={segment(yearly)}>
          Annuel
          {trial ? (
            <span
              style={{
                fontSize: 12, padding: '2px 8px', borderRadius: 999,
                background: yearly ? 'rgba(255,255,255,.16)' : 'var(--tile)',
              }}
            >
              1er mois offert
            </span>
          ) : null}
        </button>
        <button type="button" role="radio" aria-checked={!yearly} onClick={() => setPeriod('mois')} style={segment(!yearly)}>
          Mensuel
        </button>
      </div>

      {current === null ? (
        <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--muted)', padding: '0 4px' }}>
          Tu es sur {FREE_PLAN.name} : {FREE_PLAN.features.map((f) => f.charAt(0).toLowerCase() + f.slice(1)).join(', ')}.
        </p>
      ) : null}

      <div role="radiogroup" aria-label="Offre" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PLANS.map((p) => {
          const on = p.id === plan;
          const fg = on ? 'var(--ground)' : 'var(--ink)';
          const muted = on ? 'color-mix(in srgb, var(--ground) 70%, transparent)' : 'var(--muted)';
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPlan(p.id)}
              style={{
                textAlign: 'left', border: 'none', borderRadius: 28, padding: 20, cursor: 'pointer',
                background: on ? 'var(--ink)' : 'var(--ground)', color: fg, boxShadow: 'var(--shadow-card)',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 22, fontWeight: 500 }}>{p.name}</span>
                    {p.id === current ? (
                      <Tag>Ton offre</Tag>
                    ) : p.flagged ? (
                      <Tag>Le plus choisi</Tag>
                    ) : null}
                  </span>
                  <span style={{ fontSize: 12, color: muted }}>{p.note}</span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: 'none' }}>
                  <span className="stat" style={{ fontSize: 26 }}>
                    {euros(p.cents[period])}
                  </span>
                  <span style={{ fontSize: 12, color: muted }}>{yearly ? perMonth(p) : 'par mois'}</span>
                </span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {p.features.map((f) => (
                  <span key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: muted }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={CHECK} />
                    </svg>
                    {f.label}
                    {f.soon ? <em style={{ fontStyle: 'normal', opacity: 0.75 }}>· bientôt</em> : null}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--muted)', padding: '0 4px' }}>
        Sans engagement, résiliable à tout moment depuis Mon compte. Prix en euros, TVA comprise.
        Paiement sécurisé par Stripe.
      </p>

      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 78px)', padding: '14px 16px 16px', zIndex: 5,
          background: 'linear-gradient(to top, var(--bg) 62%, transparent)',
        }}
      >
        <div style={{ maxWidth: 350, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          {current ? (
            <form action={portalAction}>
              <Submit label={plan === current ? 'Gérer mon abonnement' : 'Changer d’offre'} />
            </form>
          ) : (
            <form action={checkoutAction}>
              <input type="hidden" name="plan" value={plan} />
              <input type="hidden" name="period" value={period} />
              <Submit label={`Continuer avec ${selected.name}, ${euros(selected.cents[period])}`} />
            </form>
          )}
          <p style={{ fontSize: 11.5, textAlign: 'center', color: 'var(--muted)' }}>
            {current
              ? 'Le changement d’offre et la résiliation se font sur la page sécurisée de Stripe.'
              : yearly
                ? trial ? 'Premier mois offert, puis facturé une fois par an.' : 'Facturé une fois par an, sans engagement.'
                : 'Facturé chaque mois, sans engagement.'}
          </p>
        </div>
      </div>
    </main>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span
      style={{
        height: 22, padding: '0 9px', borderRadius: 999, background: 'var(--accent-tint)', color: 'var(--accent-ink)',
        fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center',
      }}
    >
      {children}
    </span>
  );
}
