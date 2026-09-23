import { AuthForm } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';

export default function Inscription() {
  return (
    <AuthShell
      active="inscription"
      title="Ton dressing, en vitrine."
      lead="Photographie ce que tu possèdes déjà. Dressy compose tes tenues selon ton style, la météo et ton agenda. Porte mieux, achète moins."
    >
      <AuthForm mode="signup" />
      <p style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--muted)' }}>
        Ton espace est privé. Personne d&apos;autre ne voit ta garde-robe.
      </p>
    </AuthShell>
  );
}
