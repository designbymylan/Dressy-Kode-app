import Link from 'next/link';
import { Icon } from '@/components/icons';
import { Kodi, KodiSay } from '@/components/Kodi';
import { JobList, type JobView } from '@/components/JobList';
import { PieceCard, type PieceView } from '@/components/PieceCard';
import { Card, Cut, IconLink, ProgressBar, Screen, SearchBar, Title, btn } from '@/components/ui';
import { usageMood } from '@/lib/wardrobe';

export type DressingData = {
  spaceName: string;
  q: string;
  cat: string | null;
  categories: { id: string; label: string; count: number }[];
  pieces: PieceView[];
  totalPieces: number;
  usage: {
    total: number;
    worn: number;
    pct: number;
    windowDays: number;
    categories: { id: string; label: string; total: number; worn: number; pct: number }[];
  };
  jobs: JobView[];
  sent: number;
};

function chipHref(cat: string | null, q: string) {
  const p = new URLSearchParams();
  if (cat) p.set('cat', cat);
  if (q) p.set('q', q);
  const s = p.toString();
  return `/dressing${s ? `?${s}` : ''}#filtres`;
}

export function DressingScreen({ data }: { data: DressingData }) {
  const { usage } = data;
  const pct = Math.round(usage.pct);
  const kodi = usageMood(usage.total, usage.worn, pct);
  const working = data.jobs.some((j) => j.status !== 'failed');

  return (
    <Screen>
      <Title
        sub={`${data.totalPieces} pièce${data.totalPieces > 1 ? 's' : ''} · ${data.spaceName}`}
        action={<IconLink href="/dressing/ajouter" icon="plus" label="Ajouter une pièce" />}
      >
        Dressing
      </Title>

      <SearchBar q={data.q} />

      {data.sent && working ? (
        <KodiSay mood="thinking" size={48}>
          {data.sent > 1 ? `${data.sent} photos reçues.` : 'Photo reçue.'} Je les redessine et je vérifie
          qu’elles te ressemblent. Tu peux fermer l’écran : elles arriveront ici.
        </KodiSay>
      ) : null}

      {usage.total ? (
        <Cut close label="Garde-robe exploitée">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="dk-label">Garde-robe exploitée</span>
              <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                {usage.worn} sur {usage.total} pièces
              </p>
              <span className="dk-muted" style={{ fontSize: 13 }}>portées ces {usage.windowDays} derniers jours</span>
            </div>
            <Kodi mood={kodi.mood} size={64} track />
          </div>

          <ProgressBar value={pct} label={`Part de ta garde-robe portée ces ${usage.windowDays} derniers jours`} />

          <p style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--on-panel-muted)' }}>{kodi.line}</p>

          {usage.categories.length > 1 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 14px', marginTop: 4 }}>
              {usage.categories.map((c) => (
                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12.5, fontWeight: 600 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                    <span style={{ color: 'var(--on-panel-muted)', fontWeight: 500 }}>{c.worn}/{c.total}</span>
                  </span>
                  <ProgressBar value={c.pct} size="sm" label={`${c.label} : part portée`} />
                </div>
              ))}
            </div>
          ) : null}
        </Cut>
      ) : null}

      {data.jobs.length ? (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Kodi mood={working ? 'thinking' : 'sad'} size={40} decorative tap={false} />
            <h2 className="dk-h2" style={{ fontSize: 17 }}>{working ? 'Kodi prépare tes pièces' : 'Pièces à reprendre'}</h2>
          </div>
          {/* La clé change quand une pièce part, arrive ou est relancée : la liste repart de l'état serveur. */}
          <JobList key={data.jobs.map((j) => `${j.id}:${j.status}`).join('|')} initial={data.jobs} />
        </Card>
      ) : null}

      {data.totalPieces === 0 ? (
        <section className="dk-card" style={{ alignItems: 'center', textAlign: 'center', paddingBlock: 28 }}>
          <Kodi mood="wave" size={112} track shadow />
          <h2 className="dk-h2" style={{ fontSize: 21 }}>Ta garde-robe est vide</h2>
          <p className="dk-lead" style={{ maxWidth: 300 }}>
            Rien n’est ajouté sans toi. Commence par une pièce que tu portes souvent : il m’en faut deux ou
            trois pour composer ta première tenue.
          </p>
          <Link href="/dressing/ajouter" className={btn.primary}>
            <Icon name="camera" size={18} /> Ajouter une pièce
          </Link>
        </section>
      ) : (
        <section id="filtres" style={{ display: 'flex', flexDirection: 'column', gap: 14, scrollMarginTop: 60 }}>
          <nav aria-label="Catégories" className="dk-rail">
            <Link href={chipHref(null, data.q)} className="dk-chip" aria-current={!data.cat ? 'page' : undefined}>
              Tout <span className="dk-chip__n">{data.totalPieces}</span>
            </Link>
            {data.categories.map((c) => (
              <Link key={c.id} href={chipHref(c.id, data.q)} className="dk-chip" aria-current={data.cat === c.id ? 'page' : undefined}>
                {c.label} <span className="dk-chip__n">{c.count}</span>
              </Link>
            ))}
          </nav>

          {data.q ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              {data.pieces.length} résultat{data.pieces.length > 1 ? 's' : ''} pour « {data.q} » ·{' '}
              <Link href={chipHref(data.cat, '')} style={{ textDecoration: 'underline' }}>effacer</Link>
            </p>
          ) : null}

          {data.pieces.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 12px' }}>
              {data.pieces.map((p, i) => (
                <div key={p.id} className="dk-enter" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <PieceCard piece={p} />
                </div>
              ))}
            </div>
          ) : (
            <KodiSay mood="thinking" size={48}>Rien ici pour l’instant. Essaie une autre catégorie ou un autre mot.</KodiSay>
          )}

          <p style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--subtle)', textAlign: 'center' }}>
            Touche le cintre d’une pièce le jour où tu la portes : ta progression se met à jour.
          </p>
        </section>
      )}
    </Screen>
  );
}
