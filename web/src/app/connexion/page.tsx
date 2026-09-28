import Link from 'next/link';
import { AuthForm, OAuthButtons } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';

const NOTES: Record<string, string> = {
  expire: 'Ce lien a expiré ou a déjà servi. Connecte-toi, ou demande un nouveau lien.',
};

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<{ lien?: string }>;
}) {
  const { lien } = await searchParams;

  return (
    <AuthShell
      title={<>Content de te <em className="accent">revoir</em></>}
      lead="Connecte-toi à ton espace Dresskode."
      footer={<>Nouveau ici ? <Link href="/inscription">Créer un compte</Link></>}
    >
      {lien && NOTES[lien] ? <p className="note pop" role="status">{NOTES[lien]}</p> : null}
      <OAuthButtons />
      <div className="auth-or" aria-hidden="true">ou</div>
      <AuthForm mode="signin" />
    </AuthShell>
  );
}
