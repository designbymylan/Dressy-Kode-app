'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { openPortal, type FormResult } from '@/app/actions';
import { ErrorNote } from '@/components/ui';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-glass btn-block">
      {pending ? <><span className="spinner" aria-hidden="true" />Ouverture</> : 'Gérer mon abonnement'}
    </button>
  );
}

/** Ouvre le portail Stripe : offre, carte, factures, résiliation. */
export function PortalButton() {
  const [state, action] = useActionState<FormResult, FormData>(openPortal, undefined);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {state?.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <Submit />
    </form>
  );
}
