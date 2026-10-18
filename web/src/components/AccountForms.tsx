'use client';

import { useActionState } from 'react';
import { requestPasswordReset, resendConfirmation, updatePassword, type FormResult } from '@/app/actions';
import { ErrorNote } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { PasswordInput } from '@/components/AuthForm';

type Sent = FormResult | { sent: true };
const isSent = (s: Sent): s is { sent: true } => Boolean(s && 'sent' in s);

/** « Renvoyer l'e-mail » sur l'écran d'attente de confirmation. */
export function ResendForm({ email }: { email: string }) {
  const [state, action] = useActionState<Sent, FormData>(resendConfirmation, undefined);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="hidden" name="email" value={email} />
      {state && !isSent(state) ? <ErrorNote>{state.error}</ErrorNote> : null}
      {isSent(state) ? <p role="status" className="note small pop">C’est reparti : regarde aussi dans tes indésirables.</p> : null}
      <SubmitButton label="Renvoyer l’e-mail" pending="Envoi" className="btn btn-glass btn-block" />
    </form>
  );
}

/** « Mot de passe oublié » : l'adresse, puis un lien par e-mail. */
export function ResetRequestForm() {
  const [state, action] = useActionState<Sent, FormData>(requestPasswordReset, undefined);
  if (isSent(state)) {
    return (
      <p role="status" className="note pop">
        Si un compte existe avec cette adresse, un lien t’attend dans tes e-mails. Il t’amène directement au choix
        de ton nouveau mot de passe.
      </p>
    );
  }
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {state ? <ErrorNote>{state.error}</ErrorNote> : null}
      <label className="field">
        <span>E-mail</span>
        <input name="email" type="email" required autoComplete="email" placeholder="toi@exemple.fr" className="input" />
      </label>
      <SubmitButton label="M’envoyer un lien" pending="Envoi" />
    </form>
  );
}

/** Nouveau mot de passe, une fois revenu par le lien de l'e-mail. */
export function NewPasswordForm() {
  const [state, action] = useActionState<FormResult, FormData>(updatePassword, undefined);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {state?.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <div className="field">
        <div className="field-head"><label htmlFor="password">Nouveau mot de passe</label></div>
        <PasswordInput isNew />
      </div>
      <SubmitButton label="Enregistrer et entrer" pending="Enregistrement" />
    </form>
  );
}
