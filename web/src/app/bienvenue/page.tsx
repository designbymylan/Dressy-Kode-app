import type { CSSProperties } from 'react';
import Link from 'next/link';
import { FlatLay } from '@/components/garments';
import { Wordmark } from '@/components/AuthShell';

/** Écran 1 du brief : collage à plat, une phrase, un seul bouton. */
export default function Bienvenue() {
  return (
    <main
      className="page"
      style={{
        maxWidth: 390, margin: '0 auto', minHeight: '100dvh',
        padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 20px calc(env(safe-area-inset-bottom, 0px) + 34px)',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}
    >
      <div className="rise" style={{ display: 'flex', justifyContent: 'center', paddingBlock: 6 }}>
        <Wordmark />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26 }}>
        <FlatLay />

        <h1 className="hero-title rise" style={{ '--i': 7, fontSize: 36, lineHeight: 1.05 } as CSSProperties}>
          Ton dressing,
          <br />
          <em className="accent">en vitrine.</em>
        </h1>

        <p className="lead rise" style={{ '--i': 8 } as CSSProperties}>
          Tu as déjà tout ce qu&apos;il faut dans ton armoire. Dresskode t&apos;aide à le voir,
          et à t&apos;habiller sans y penser une heure.
        </p>
      </div>

      <div className="rise" style={{ '--i': 9, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' } as CSSProperties}>
        <Link href="/inscription" className="btn btn-primary btn-block">
          Commencer
        </Link>
        <Link href="/connexion" className="btn btn-ghost">
          J&apos;ai déjà un compte
        </Link>
      </div>
    </main>
  );
}
