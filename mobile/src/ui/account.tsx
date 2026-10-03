/**
 * Le compte : les champs e-mail et mot de passe, et la feuille « Se
 * connecter / Créer mon compte » ouverte depuis l'accueil ou depuis Moi.
 */
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useStore } from '../state/store';
import { online } from '../state/remote';
import { useTheme } from '../theme/ThemeProvider';
import { T } from './T';
import { Button } from './Button';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Tap } from './Tap';
import { F } from '../theme/fonts';

export const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const PASSWORD_MIN = 8;

type FieldProps = { value: string; onChange: (v: string) => void; onSubmit?: () => void; testID?: string };

export function EmailField({ value, onChange, onSubmit, testID }: FieldProps) {
  const { c } = useTheme();
  return (
    <View className="flex-row items-center bg-sunk" style={{ height: 54, borderRadius: 0, paddingHorizontal: 18, gap: 10 }}>
      <Icon name="mail" size={18} color={c.ink2} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder="ton@e-mail.fr"
        placeholderTextColor={c.ink2}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={onSubmit}
        accessibilityLabel="Ton adresse e-mail"
        style={{ flex: 1, height: 54, color: c.ink, ...F.s500, fontSize: 17 }}
      />
      {validEmail(value) && <Icon name="check" size={18} color={c.positive} strokeWidth={2.2} />}
    </View>
  );
}

export function PasswordField({ value, onChange, onSubmit, testID, isNew }: FieldProps & { isNew?: boolean }) {
  const { c } = useTheme();
  const [shown, setShown] = useState(false);
  return (
    <View className="flex-row items-center bg-sunk" style={{ height: 54, borderRadius: 0, paddingLeft: 18, paddingRight: 6, gap: 10 }}>
      <Icon name="lock" size={18} color={c.ink2} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={isNew ? `${PASSWORD_MIN} caractères au moins` : 'Ton mot de passe'}
        placeholderTextColor={c.ink2}
        secureTextEntry={!shown}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={isNew ? 'new-password' : 'current-password'}
        textContentType={isNew ? 'newPassword' : 'password'}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        accessibilityLabel={isNew ? 'Choisis un mot de passe' : 'Ton mot de passe'}
        style={{ flex: 1, height: 54, color: c.ink, ...F.s500, fontSize: 17 }}
      />
      <Tap
        onPress={() => setShown((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="eye" size={19} color={shown ? c.ink : c.ink2} />
      </Tap>
    </View>
  );
}

/** Un message d'erreur sous un formulaire, annoncé aux lecteurs d'écran. */
export function FormError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <T v="caption" tone="caution" accessibilityLiveRegion="polite" accessibilityRole="alert">
      {text}
    </T>
  );
}

type Mode = 'login' | 'signup';
export type AccountDone = 'app' | 'onboarding' | 'confirm';

/**
 * Se connecter ou créer son compte. `onDemo` n'est donné que depuis
 * l'accueil : l'aperçu garde l'accès au compte de démonstration.
 */
export function AccountSheet({
  visible,
  onClose,
  onDone,
  onDemo,
  initial = 'login',
}: {
  visible: boolean;
  onClose: () => void;
  onDone: (next: AccountDone) => void;
  onDemo?: () => void;
  initial?: Mode;
}) {
  const { s, a } = useStore();
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState(s.pendingEmail ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const ready = validEmail(email) && password.length >= (mode === 'signup' ? PASSWORD_MIN : 1);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    if (mode === 'login') {
      const r = await a.signIn(email, password);
      setBusy(false);
      if (!r.ok) return setError(r.message);
      setPassword('');
      onDone(r.next);
    } else {
      const r = await a.signUp(email, password, s.profile.name);
      setBusy(false);
      if (!r.ok) return setError(r.message);
      setPassword('');
      if (r.confirm) {
        setSent(email.trim().toLowerCase());
        return;
      }
      onDone('app');
    }
  };

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  if (!online) {
    return (
      <Sheet visible={visible} onClose={onClose} kicker="Connexion" title="Content de te revoir" testID="login-sheet"
        footer={onDemo ? <Button testID="login-demo" label="Ouvrir le compte de démonstration" onPress={() => { onClose(); onDemo(); }} /> : undefined}>
        <T v="body" tone="ink2">
          Cet aperçu tourne sans serveur : la connexion n’y est pas branchée. Dans l’app, ton compte se retrouve avec ton e-mail et ton mot de passe.
        </T>
      </Sheet>
    );
  }

  if (sent) {
    return (
      <Sheet visible={visible} onClose={() => { setSent(null); onClose(); onDone('confirm'); }} kicker="Presque fini" title="Regarde tes e-mails" testID="signup-sent"
        footer={<Button testID="signup-sent-ok" label="C’est noté" onPress={() => { setSent(null); onClose(); onDone('confirm'); }} />}>
        <T v="body" tone="ink2">
          On vient d’envoyer un lien à {sent}. Touche-le pour confirmer ton adresse, puis reviens te connecter ici : ton espace sera enregistré sur ton compte.
        </T>
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      kicker={mode === 'login' ? 'Connexion' : 'Ton compte'}
      title={mode === 'login' ? 'Content de te revoir' : 'Garde ton espace'}
      testID="login-sheet"
      footer={
        <View style={{ gap: 4 }}>
          <Button testID="login-send" label={mode === 'login' ? 'Me connecter' : 'Créer mon compte'} disabled={!ready} loading={busy} onPress={submit} />
          <Button
            testID="login-switch"
            variant="plain"
            label={mode === 'login' ? 'Pas encore de compte ? En créer un' : 'J’ai déjà un compte'}
            onPress={() => switchTo(mode === 'login' ? 'signup' : 'login')}
          />
          {onDemo && <Button testID="login-demo" variant="plain" label="Voir le compte de démonstration" onPress={() => { onClose(); onDemo(); }} />}
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        <T v="body" tone="ink2">
          {mode === 'login'
            ? 'Ton dressing, tes tenues et tes échanges avec Kode t’attendent.'
            : 'Ton profil et tes pièces sont enregistrés sur ton compte : tu les retrouves sur tous tes appareils.'}
        </T>
        <EmailField testID="login-email" value={email} onChange={setEmail} />
        <PasswordField testID="login-password" value={password} onChange={setPassword} onSubmit={submit} isNew={mode === 'signup'} />
        <FormError text={error} />
      </View>
    </Sheet>
  );
}
