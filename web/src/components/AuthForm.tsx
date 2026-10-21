'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn, signUp, type FormResult } from '@/app/actions';
import { Icon } from '@/components/icons';
import { Kodi, type KodiLook, type KodiMood } from '@/components/Kodi';
import { Field, btn } from '@/components/ui';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${btn.primary} dk-btn--block`}>
      {pending ? 'Un instant…' : label}
      {pending ? null : <Icon name="chevronRight" size={18} />}
    </button>
  );
}

/** Kodi réfléchit pendant l'envoi : il lit l'état du formulaire parent. */
function Watcher({ mood, look, line }: { mood: KodiMood; look?: KodiLook; line: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="kodi-say">
      <Kodi mood={pending ? 'thinking' : mood} look={look} track={!look} size={64} />
      <p className="kodi-say__bubble" key={pending ? 'wait' : line}>{pending ? 'Je vérifie…' : line}</p>
    </div>
  );
}

/**
 * Connexion et inscription. Kodi écoute pendant qu'on écrit l'adresse,
 * se cache les yeux sur le mot de passe, et fait la moue si ça échoue.
 */
export function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const isSignUp = mode === 'signup';
  const [state, action] = useActionState<FormResult, FormData>(isSignUp ? signUp : signIn, undefined);
  const [focus, setFocus] = useState<'name' | 'email' | 'password' | null>(null);

  const mood: KodiMood = focus === 'password' ? 'shy' : state?.error ? 'sad' : focus ? 'listening' : isSignUp ? 'wave' : 'happy';
  const look: KodiLook | undefined = focus === 'name' || focus === 'email' ? 'down' : undefined;
  const line = state?.error
    ? 'Oups. On réessaie ?'
    : focus === 'password'
      ? 'Je ne regarde pas, promis.'
      : isSignUp
        ? 'Je crée ton espace en deux secondes.'
        : 'Content de te revoir !';

  const on = (f: typeof focus) => ({ onFocus: () => setFocus(f), onBlur: () => setFocus(null) });

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Watcher mood={mood} look={look} line={line} />

      {state?.error ? (
        <p role="alert" style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--danger)', background: 'var(--tile)', borderRadius: 14, padding: '10px 14px' }}>
          {state.error}
        </p>
      ) : null}

      {isSignUp ? (
        <Field label="Ton prénom">
          <input name="display_name" type="text" autoComplete="given-name" placeholder="Sarah" className="dk-input" {...on('name')} />
        </Field>
      ) : null}

      <Field label="Adresse e-mail">
        <input name="email" type="email" required autoComplete="email" placeholder="sarah@exemple.fr" className="dk-input" {...on('email')} />
      </Field>

      <Field label="Mot de passe">
        <input
          name="password"
          type="password"
          required
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          minLength={isSignUp ? 8 : undefined}
          placeholder={isSignUp ? 'Au moins 8 caractères' : ''}
          className="dk-input"
          {...on('password')}
        />
      </Field>

      <Submit label={isSignUp ? 'Créer mon espace' : 'Me connecter'} />
    </form>
  );
}
