import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { ResendForm } from '@/components/AccountForms';

/**
 * Juste après l'inscription, quand le projet demande de confirmer l'adresse.
 * Pas de retour à la connexion : le lien de l'e-mail ouvre directement le
 * questionnaire (voir /auth/callback).
 */
export default async function Verifier({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = '' } = await searchParams;

  return (
    <AuthShell
      title={<>Regarde tes <em className="accent">e-mails</em></>}
      lead={email ? `On vient d’envoyer un lien à ${email}.` : 'On vient de t’envoyer un lien.'}
      footer={<>Déjà confirmé ? <Link href="/connexion">Me connecter</Link></>}
    >
      <div className="glass card" style={{ gap: 10 }}>
        <p style={{ fontSize: 15, lineHeight: 1.5 }}>
          Touche-le depuis ce téléphone : il t’amène directement à tes premières questions, sans repasser par ici.
        </p>
        <p className="small muted">Rien reçu d’ici une minute ? Regarde dans tes indésirables.</p>
      </div>
      {email ? <ResendForm email={email} /> : null}
    </AuthShell>
  );
}
