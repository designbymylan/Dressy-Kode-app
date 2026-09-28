'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { signIn, signUp, signInWithProvider, type FormResult } from '@/app/actions';
import { ErrorNote } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

/** Logo officiel de Google, exigé tel quel par ses règles de marque. */
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.95l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

/** Pomme d'Apple, dans la couleur du texte (noire en clair, blanche en sombre). */
function AppleLogo() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 1.43c0 1.14-.49 2.27-1.18 3.08-.74.9-1.99 1.57-2.99 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.57-2.27 1.21-2.98.8-.94 2.14-1.64 3.25-1.68.03.13.05.28.05.43Zm4.56 15.71c-.03.07-.46 1.58-1.52 3.12-.94 1.34-1.94 2.71-3.43 2.71-1.52 0-1.9-.88-3.63-.88-1.7 0-2.3.91-3.67.91-1.38 0-2.33-1.26-3.43-2.8-1.29-1.82-2.32-4.63-2.32-7.28 0-4.28 2.8-6.55 5.55-6.55 1.45 0 2.68.95 3.6.95.87 0 2.22-1.01 3.9-1.01.61 0 2.89.06 4.37 2.19-.13.09-2.38 1.37-2.38 4.19 0 3.26 2.85 4.42 2.96 4.45Z" />
    </svg>
  );
}

/** « Continuer avec Google / Apple » : un même formulaire, deux boutons. */
export function OAuthButtons() {
  const [state, action] = useActionState<FormResult, FormData>(signInWithProvider, undefined);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {state?.error ? <p role="status" className="note small pop">{state.error}</p> : null}
      <SubmitButton
        name="provider" value="google"
        className="btn btn-glass btn-block btn-oauth"
        label={<><GoogleLogo />Continuer avec Google</>}
        pending="Ouverture de Google"
      />
      <SubmitButton
        name="provider" value="apple"
        className="btn btn-glass btn-block btn-oauth"
        label={<><AppleLogo />Continuer avec Apple</>}
        pending="Ouverture d’Apple"
      />
    </form>
  );
}

const EYE = 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z';
const EYE_OFF = 'M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.8 0 3.3-.5 4.6-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2';

export function PasswordInput({ isNew, id = 'password' }: { isNew?: boolean; id?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="password">
      <input
        id={id}
        name="password"
        type={shown ? 'text' : 'password'}
        required
        autoComplete={isNew ? 'new-password' : 'current-password'}
        minLength={isNew ? 8 : undefined}
        placeholder={isNew ? '8 caractères au moins' : '••••••••'}
        className="input"
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={shown}
        aria-controls={id}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={shown ? EYE_OFF : EYE} />
        </svg>
      </button>
    </div>
  );
}

/**
 * Connexion ou création de compte par e-mail. Pas de prénom ici : il se
 * donne dans le questionnaire, juste après.
 */
export function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const isSignUp = mode === 'signup';
  const [state, action] = useActionState<FormResult, FormData>(isSignUp ? signUp : signIn, undefined);

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {state?.error ? <ErrorNote>{state.error}</ErrorNote> : null}

      <label className="field">
        <span>E-mail</span>
        <input name="email" type="email" required autoComplete="email" placeholder="toi@exemple.fr" className="input" />
      </label>

      <div className="field">
        <div className="field-head">
          <label htmlFor="password">Mot de passe</label>
          {isSignUp ? null : <Link href="/mot-de-passe" className="field-link">Oublié ?</Link>}
        </div>
        <PasswordInput isNew={isSignUp} />
      </div>

      <SubmitButton
        label={isSignUp ? 'Créer mon espace' : 'Me connecter'}
        pending={isSignUp ? 'Création de ton espace' : 'Connexion'}
        style={{ marginTop: 4 }}
      />
    </form>
  );
}
