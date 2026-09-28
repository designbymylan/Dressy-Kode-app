'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn, signUp, type FormResult } from '@/app/actions';
import { Field, ErrorNote } from '@/components/ui';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-block">
      {pending ? 'Un instant…' : label}
    </button>
  );
}

export function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const isSignUp = mode === 'signup';
  const [state, action] = useActionState<FormResult, FormData>(
    isSignUp ? signUp : signIn,
    undefined,
  );

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {state?.error ? <ErrorNote>{state.error}</ErrorNote> : null}

      {isSignUp ? (
        <Field label="Ton prénom">
          <input
            name="display_name" type="text" autoComplete="given-name"
            placeholder="Sarah" className="input"
          />
        </Field>
      ) : null}

      <Field label="Adresse e-mail">
        <input
          name="email" type="email" required autoComplete="email"
          placeholder="sarah@exemple.fr" className="input"
        />
      </Field>

      <Field label="Mot de passe">
        <input
          name="password" type="password" required
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          minLength={isSignUp ? 8 : undefined}
          placeholder={isSignUp ? 'Au moins 8 caractères' : ''}
          className="input"
        />
      </Field>

      <Submit label={isSignUp ? 'Créer mon espace' : 'Me connecter'} />
    </form>
  );
}
