import { AuthForm } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<{ verifier?: string }>;
}) {
  const { verifier } = await searchParams;

  return (
    <AuthShell
      active="connexion"
      title="Content de te revoir."
      lead="Retrouve ton dressing, tes tenues et ce que Dressy a appris de toi."
    >
      {verifier ? (
        <p
          style={{
            fontSize: 13, lineHeight: 1.5, color: 'var(--accent-ink)',
            background: 'var(--accent-tint)', borderRadius: 16, padding: '12px 16px',
          }}
        >
          Ton compte est créé. Ouvre l&apos;e-mail de confirmation qu&apos;on vient de
          t&apos;envoyer, puis reviens te connecter ici.
        </p>
      ) : null}

      <AuthForm mode="signin" />
    </AuthShell>
  );
}
