import { AuthForm } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';

export default function Inscription() {
  return (
    <AuthShell
      active="inscription"
      title={<>Ton dressing, <em className="accent">en vitrine.</em></>}
      lead="Photographie ce que tu possèdes déjà, bijoux et accessoires compris. Kode compose tes tenues selon ton style, la météo et ton agenda."
    >
      <AuthForm mode="signup" />
      <p className="small muted center">
        Ton espace est privé. Personne d&apos;autre ne voit ta garde-robe.
      </p>
    </AuthShell>
  );
}
