'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { openPortal, startCheckout, type FormResult } from '@/app/actions';
import { Icon, type IconName } from '@/components/icons';
import { SubmitButton } from '@/components/SubmitButton';
import { ErrorNote } from '@/components/ui';
import { COMPARE, FREE_PLAN, PLANS, euros, type Period, type Plan, type PlanId } from '@/lib/plans';

/**
 * Les deux offres (27/10), d'après la référence d'abonnement envoyée : un
 * titre, la liste de ce qui est inclus dans une carte, deux cartes de durée
 * (l'année, le mois) dont la choisie monte sur un fond gris, la phrase du prix
 * et un grand bouton. Pas de remise en avant : les prix sont ceux de plans.ts.
 * Le fond qui glisse d'une durée ou d'une offre à l'autre est le seul
 * mouvement ; « Réduire les animations » le coupe (.pr-* dans globals.css).
 * Le paiement s'ouvre chez Stripe ; une abonnée gère son offre par le portail.
 */

type Row = { icon: IconName; title: string; sub: string; soon?: boolean };

/** Quatre lignes par offre : ce qu'elle apporte, sans refaire tout le tableau. */
function rowsFor(id: PlanId): Row[] {
  const pick = (icon: string) => COMPARE.find((f) => f.icon === icon)!;
  const take = (...icons: string[]): Row[] => icons.map((i) => ({ icon: i as IconName, title: pick(i).title, sub: pick(i).sub, soon: pick(i).soon }));
  if (id === 'capsule') return take('hanger', 'sparkle', 'cloud', 'chart');
  return [
    { icon: 'check', title: 'Tout Fashion', sub: 'Dressing, tenue du jour, suivi' },
    ...take('infinity', 'party', 'layers'),
  ];
}

export function Pricing({ current, trial }: { current: PlanId | null; trial: boolean }) {
  const [pick, setPick] = useState<PlanId>(current === 'atelier' ? 'capsule' : 'atelier');
  const [period, setPeriod] = useState<Period>('an');
  const [checkout, checkoutAction] = useActionState<FormResult, FormData>(startCheckout, undefined);
  const [portal, portalAction] = useActionState<FormResult, FormData>(openPortal, undefined);
  const plan = PLANS.find((p) => p.id === pick)!;
  const error = checkout?.error ?? portal?.error;
  const perMonth = period === 'an' ? Math.round(plan.cents.an / 12) : plan.cents.mois;

  return (
    <section id="offres" aria-label="Offres" className="rise pr" style={{ scrollMarginTop: 60 }}>
      <h2 className="pr__title">
        Passe à <span key={plan.id} className="pr__swap">{plan.name}</span>
      </h2>

      <div role="radiogroup" aria-label="Offre" className="pr-seg" data-on={PLANS.findIndex((p) => p.id === pick)}>
        <span className="pr-seg__thumb" aria-hidden="true" />
        {PLANS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={pick === p.id} onClick={() => setPick(p.id)} className="pr-seg__opt">
            {p.name}
          </button>
        ))}
      </div>

      <ul key={plan.id} className="pr-list pr__swap">
        {rowsFor(plan.id).map((r) => (
          <li key={r.title} className="pr-list__row">
            <Icon name={r.icon} size={22} />
            <span className="pr-list__text">
              <strong>{r.title}{r.soon ? <span className="muted" style={{ fontWeight: 500 }}> · bientôt</span> : null}</strong>
              <span className="muted">{r.sub}</span>
            </span>
            <Icon name="checkCircle" size={24} label="Inclus" />
          </li>
        ))}
      </ul>

      <div role="radiogroup" aria-label="Durée" className="pr-tray" data-on={period === 'an' ? 0 : 1}>
        <span className="pr-tray__thumb" aria-hidden="true" />
        {(['an', 'mois'] as const).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)} className="pr-tray__opt">
            <span className="pr-tray__label">{p === 'an' ? 'Annuel' : 'Mensuel'}</span>
            <strong key={`${plan.id}${p}`} className="pr-tray__price pr__swap">{euros(plan.cents[p])}</strong>
            <span className="pr-tray__sub">{p === 'an' ? `soit ${euros(Math.round(plan.cents.an / 12))} par mois` : 'sans engagement'}</span>
          </button>
        ))}
      </div>

      <p className="pr__line" aria-live="polite">
        <strong key={`${plan.id}${period}`} className="pr__swap">{euros(perMonth)} par mois</strong>
        {period === 'an' ? ', facturé une fois par an.' : ', facturé chaque mois.'}
      </p>
      <p className="pr__fine">
        {period === 'an' && trial && !current ? 'Premier mois offert. ' : ''}
        Sans engagement, résiliable à tout moment depuis Mon compte. Prix TTC, paiement sécurisé par Stripe.
      </p>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {current === pick ? (
        <p className="dk-tag dk-tag--blue" style={{ alignSelf: 'center', fontSize: 12 }}>
          <Icon name="check" size={13} /> C’est ton offre
        </p>
      ) : current ? (
        // Déjà abonnée : le changement d'offre passe par le portail Stripe.
        <form action={portalAction}>
          <SubmitButton label={`Passer à ${plan.name}`} pending="Ouverture" className="btn pr__cta btn-block" />
        </form>
      ) : (
        <form action={checkoutAction}>
          <input type="hidden" name="plan" value={plan.id} />
          <input type="hidden" name="period" value={period} />
          <SubmitButton
            label={period === 'an' && trial ? 'Commencer mon mois offert' : `Choisir ${plan.name} ${period === 'an' ? 'Annuel' : 'Mensuel'}`}
            pending="Ouverture du paiement"
            className="btn pr__cta btn-block"
          />
        </form>
      )}

      <nav className="pr__links" aria-label="Informations">
        <Link href="/confidentialite">Confidentialité</Link>
      </nav>

      {current === null ? (
        <p className="small muted center">
          Sans abonnement, tu restes sur {FREE_PLAN.name} : {FREE_PLAN.features.map((f) => f.charAt(0).toLowerCase() + f.slice(1)).join(', ')}.
        </p>
      ) : null}
    </section>
  );
}
