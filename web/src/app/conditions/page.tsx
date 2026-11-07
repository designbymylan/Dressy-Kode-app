import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { CONDITIONS, CONDITIONS_VERSION, EDITEUR, HEBERGEURS } from '@/lib/politique';

export const metadata: Metadata = { title: 'Conditions générales · Dresskode' };

/**
 * Les conditions générales d'utilisation et de vente, et les mentions légales
 * (07/11), publiques, sans compte. Même source que la politique :
 * mobile/src/data/legal.ts, copiée par `node tools/politique.mjs`. Même
 * lecture que /confidentialite : l'essentiel en quatre cartes, puis une carte
 * par section.
 */
export default function Conditions() {
  const [bref, ...rest] = CONDITIONS;
  const editeur = [EDITEUR.nom, EDITEUR.forme, EDITEUR.adresse, EDITEUR.siren && `SIREN ${EDITEUR.siren}`].filter(Boolean).join(' · ');

  return (
    <main className="screen page" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 48px)', gap: 14 }}>
      <Link href="/" className="small muted" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', minHeight: 44, minWidth: 44, paddingInlineEnd: 8 }}>
        Retour
      </Link>

      <header className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}>
        <p className="eyebrow">Conditions générales</p>
        <h1 className="hero-title" style={{ fontSize: 30, lineHeight: 1.1 }}>
          Ce qui nous lie,
          <br />
          <em className="accent">simplement</em>.
        </h1>
        <p className="small muted">{CONDITIONS_VERSION}</p>
      </header>

      <div className="rise" style={{ '--i': 1, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 } as CSSProperties}>
        {(bref.liste ?? []).map((x) => (
          <div key={x.titre} className="glass" style={{ padding: 14, borderRadius: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontWeight: 600 }}>{x.titre}</p>
            <p className="small muted">{x.texte}</p>
          </div>
        ))}
      </div>

      {rest.map((s, i) => (
        <Card key={s.titre} i={Math.min(i + 2, 8)} style={{ gap: 10 }}>
          <h2 className="eyebrow" style={{ color: 'var(--ink)' }}>{s.titre}</h2>
          {(s.texte ?? []).map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Card>
      ))}

      <Card i={9} style={{ gap: 6 }}>
        <h2 className="eyebrow" style={{ color: 'var(--ink)' }}>Mentions légales</h2>
        <p>{editeur}</p>
        {EDITEUR.directeur ? <p className="small">Directeur de la publication : {EDITEUR.directeur}</p> : null}
        {HEBERGEURS.map((h) => (
          <p key={h} className="small muted">{h}</p>
        ))}
        <p className={EDITEUR.mediateur ? 'small' : 'small muted'}>
          {EDITEUR.mediateur ? `Médiateur de la consommation : ${EDITEUR.mediateur}` : 'Le médiateur de la consommation sera indiqué ici avant la sortie de l’app.'}
        </p>
        <p className={EDITEUR.contact ? undefined : 'muted'}>{EDITEUR.contact ?? 'L’adresse de contact sera indiquée ici avant la sortie de l’app.'}</p>
        <p className="small">
          <Link href="/confidentialite" style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>Politique de confidentialité</Link>
        </p>
      </Card>
    </main>
  );
}
