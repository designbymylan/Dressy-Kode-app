import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { ResetRequestForm } from '@/components/AccountForms';

export default function MotDePasse() {
  return (
    <AuthShell
      title={<>Mot de passe <em className="accent">oublié</em></>}
      lead="Donne ton adresse : on t’envoie un lien pour en choisir un nouveau."
      footer={<>Il te revient ? <Link href="/connexion">Me connecter</Link></>}
    >
      <ResetRequestForm />
    </AuthShell>
  );
}
