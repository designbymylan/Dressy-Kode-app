import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { NewPasswordForm } from '@/components/AccountForms';
import { createClient } from '@/lib/supabase/server';

/** Atteinte par le lien de l'e-mail « mot de passe oublié », session ouverte par /auth/callback. */
export default async function NouveauMotDePasse() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AuthShell
      title={<>Ton nouveau <em className="accent">mot de passe</em></>}
      lead={user ? 'Choisis-en un que tu retiendras.' : 'Ce lien a expiré ou a déjà servi.'}
      footer={user ? undefined : <>Demande <Link href="/mot-de-passe">un nouveau lien</Link></>}
    >
      {user ? <NewPasswordForm /> : null}
    </AuthShell>
  );
}
