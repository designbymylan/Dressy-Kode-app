'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { startCheckout, type FormResult } from '@/app/actions';
import { SubmitButton } from '@/components/SubmitButton';
import { Card, ErrorNote } from '@/components/ui';
import { PLANS, euros, type PlanId } from '@/lib/plans';

/**
 * L'écran de fin des générations offertes (brief v6, 31/10). Un seul écran,
 * ouvert par un geste (« Image propre », « Voir les offres »), jamais en
 * pop-up. Sapologue en avant, Fashion en plus petit, « Continuer sans
 * générer » en lien. Ni pack, ni prix annuel ici : l'abonnement d'abord.
 */
export function QuotaEnd() {
  const [state, action] = useActionState<FormResult, FormData>(startCheckout, undefined);
  const big = PLANS.find((p) => p.flagged)!;
  const small = PLANS.find((p) => p.id !== big.id)!;

  const buy = (id: PlanId, label: string, primary: boolean) => (
    <form action={action}>
      <input type="hidden" name="plan" value={id} />
      <input type="hidden" name="period" value="mois" />
      <SubmitButton label={label} pending="Ouverture du paiement" className={`btn ${primary ? '' : 'btn-glass'} btn-block`} />
    </form>
  );

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {state?.error ? <ErrorNote>{state.error}</ErrorNote> : null}

      <Card i={0}>
        <p className="eyebrow" style={{ textAlign: 'left' }}>{big.name}</p>
        <h2 style={{ fontSize: 26 }}>{euros(big.cents.mois)} par mois</h2>
        <p className="small muted">
          {big.features[1]?.label}, Kodi sans limite. Sans engagement.
        </p>
        {buy(big.id, `Choisir ${big.name}`, true)}
      </Card>

      <Card i={1}>
        <p className="eyebrow" style={{ textAlign: 'left' }}>{small.name}</p>
        <p className="small">
          <strong>{euros(small.cents.mois)} par mois</strong> · {small.features[1]?.label}
        </p>
        {buy(small.id, `Choisir ${small.name}`, false)}
      </Card>

      <Link href="/dressing" className="small muted center" style={{ padding: 12 }}>
        Continuer sans générer
      </Link>
    </div>
  );
}
