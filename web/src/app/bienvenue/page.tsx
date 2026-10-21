import Link from 'next/link';
import { FlatLay } from '@/components/garments';
import { Wordmark } from '@/components/AuthShell';
import { Icon } from '@/components/icons';
import { Kodi } from '@/components/Kodi';
import { btn } from '@/components/ui';

/**
 * Le premier écran d'une personne qui découvre Dressy : Kodi devant sa
 * vitrine de vêtements, qui fait coucou et suit le doigt du regard.
 * Une phrase, un seul bouton.
 */
export default function Bienvenue() {
  return (
    <main className="dk-screen" style={{ ['--screen-pb' as string]: '34px', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingBlock: 2 }}>
        <Wordmark />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }}>
        <div style={{ position: 'relative' }}>
          <FlatLay />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: -38, display: 'flex', justifyContent: 'center' }}>
            <Kodi mood="wave" size={150} track enter shadow />
          </div>
        </div>

        <p className="kodi-say__bubble" style={{ alignSelf: 'center', marginTop: 36, borderRadius: 20, textAlign: 'center' }}>
          Salut ! Moi c’est <strong>Kodi</strong>, ton styliste de poche.
        </p>

        <h1 style={{ fontSize: 42, lineHeight: 1.02 }}>
          Ton dressing,
          <br />
          en vitrine.
        </h1>

        <p className="dk-lead" style={{ fontSize: 15, lineHeight: 1.55 }}>
          Tu as déjà tout ce qu&apos;il faut dans ton armoire. Kodi t&apos;aide à le voir,
          à le porter, et à t&apos;habiller sans y penser une heure.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        <Link href="/inscription" className={`${btn.primary} dk-btn--block`}>
          Commencer <Icon name="chevronRight" size={18} />
        </Link>
        <Link href="/connexion" className={btn.ghost} style={{ minHeight: 44 }}>
          J&apos;ai déjà un compte
        </Link>
      </div>
    </main>
  );
}
