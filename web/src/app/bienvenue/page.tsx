import Link from 'next/link';
import { FlatLay } from '@/components/garments';
import { Wordmark } from '@/components/AuthShell';
import { buttonPrimary } from '@/components/ui';

/** Écran 1 du brief : collage à plat, une phrase, un seul bouton. */
export default function Bienvenue() {
  return (
    <main
      style={{
        maxWidth: 390, margin: '0 auto', minHeight: '100dvh',
        padding: '20px 20px 34px', display: 'flex', flexDirection: 'column', gap: 20,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', paddingBlock: 6 }}>
        <Wordmark />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26 }}>
        <FlatLay />

        <h1 style={{ fontSize: 40, lineHeight: 1.05 }}>
          Ton dressing,
          <br />
          en vitrine.
        </h1>

        <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--muted)' }}>
          Tu as déjà tout ce qu&apos;il faut dans ton armoire. Dressy t&apos;aide à le voir,
          et à t&apos;habiller sans y penser une heure.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <Link href="/inscription" style={{ ...buttonPrimary, width: '100%' }}>
          Commencer
        </Link>
        <Link href="/connexion" style={{ fontSize: 13.5, color: 'var(--muted)', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
          J&apos;ai déjà un compte
        </Link>
      </div>
    </main>
  );
}
