import Link from 'next/link';
import { AuthForm, OAuthButtons } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';
import { enabledProviders } from '@/lib/auth';

const NOTES: Record<string, string> = {
  expire: 'Ce lien a expiré ou a déjà servi. Connecte-toi, ou demande un nouveau lien.',
};

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<{ lien?: string; suite?: string; compte?: string }>;
}) {
  const { lien, suite, compte } = await searchParams;

  return (
    <AuthShell
      title={<>Content de te <em className="accent">revoir</em></>}
      lead="Connecte-toi à ton espace Dresskode."
      footer={<>Nouveau ici ? <Link href="/inscription">Créer un compte</Link></>}
    >
      {lien && NOTES[lien] ? <p className="note pop" role="status">{NOTES[lien]}</p> : null}
      {compte === 'supprime' ? <p className="note pop" role="status">Ton compte et tes données sont effacés.</p> : null}
      <OAuthButtons providers={await enabledProviders()} />
      <AuthForm mode="signin" suite={suite} />
    </AuthShell>
  );
}
