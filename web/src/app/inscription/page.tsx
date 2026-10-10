import Link from 'next/link';
import { SignupForms } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';

export default function Inscription() {
  return (
    <AuthShell
      title={<>Crée ton <em className="accent">espace</em></>}
      lead="Un compte, et Kode commence à t’habiller avec ce que tu as déjà."
      footer={<>Déjà un compte ? <Link href="/connexion">Me connecter</Link></>}
    >
      <SignupForms />
      <p className="small muted center">Ton espace est privé : personne d’autre ne voit ta garde-robe.</p>
    </AuthShell>
  );
}
