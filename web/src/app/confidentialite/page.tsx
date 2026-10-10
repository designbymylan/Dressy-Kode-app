import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { EDITEUR, POLITIQUE, POLITIQUE_VERSION } from '@/lib/politique';

export const metadata: Metadata = { title: 'Politique de confidentialité · Dresskode' };

/**
 * La politique de confidentialité (09/10), publique, sans compte. Même texte
 * que l'app : il vit dans mobile/src/data/legal.ts et arrive ici par
 * `node tools/politique.mjs` (lib/politique.ts). Même lecture que l'écran
 * Vie privée du mobile : l'essentiel en quatre cartes, puis une carte par
 * section.
 */
export default function Confidentialite() {
  const [bref, ...rest] = POLITIQUE;
  const editeur = [EDITEUR.nom, EDITEUR.forme, EDITEUR.adresse, EDITEUR.siren && `SIREN ${EDITEUR.siren}`].filter(Boolean).join(' · ');

  return (
    <main className="screen page" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 48px)', gap: 14 }}>
      <Link href="/" className="small muted" style={{ alignSelf: 'flex-start', paddingBlock: 12 }}>
        Retour
      </Link>

      <header className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}>
        <p className="eyebrow">Politique de confidentialité</p>
        <h1 className="hero-title" style={{ fontSize: 30, lineHeight: 1.1 }}>
          Tes données,
          <br />
          <em className="accent">en clair</em>.
        </h1>
        <p className="small muted">{POLITIQUE_VERSION}</p>
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
          {(s.liste ?? []).map((x, j) => (
            <div key={x.titre} style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: j ? 10 : 0, borderTop: j ? '1px solid var(--rule)' : 'none' }}>
              <p style={{ fontWeight: 600 }}>{x.titre}</p>
              <p className="small muted">{x.texte}</p>
            </div>
          ))}
        </Card>
      ))}

      <Card i={8} style={{ gap: 6 }}>
        <h2 className="eyebrow" style={{ color: 'var(--ink)' }}>Éditeur et contact</h2>
        <p>{editeur}</p>
        <p className={EDITEUR.contact ? undefined : 'muted'}>{EDITEUR.contact ?? 'L’adresse de contact sera indiquée ici avant la sortie de l’app.'}</p>
      </Card>
    </main>
  );
}
