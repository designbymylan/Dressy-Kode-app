import type { CSSProperties } from 'react';
import Link from 'next/link';
import { FlatLay } from '@/components/garments';
import { Wordmark } from '@/components/Logo';
import { Kodi } from '@/components/Kodi';

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
        <Wordmark mark />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26 }}>
        {/* Kodi devant sa vitrine (21/10) : il fait coucou et suit le doigt du regard. */}
        <div style={{ position: 'relative' }}>
          <FlatLay />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: -34, display: 'flex', justifyContent: 'center' }}>
            <Kodi mood="wave" size={132} track enter shadow />
          </div>
        </div>

        <p className="kodi-say__bubble" style={{ alignSelf: 'center', marginTop: 30, borderRadius: 20, textAlign: 'center' }}>
          Salut ! Moi c’est <strong>Kodi</strong>, ton styliste de poche.
        </p>

        <h1 className="hero-title rise" style={{ '--i': 7, fontSize: 34, lineHeight: 1.1 } as CSSProperties}>
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
