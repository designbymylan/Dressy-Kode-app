import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from '@/app/actions';
import { Icon, type IconName } from '@/components/icons';
import { Pricing } from '@/components/Pricing';
import { ShortcutSwitch, ThemeChoice } from '@/components/ThemeChoice';
import { Screen } from '@/components/ui';
import { PLAN_LABEL, type PlanId } from '@/lib/plans';
import type { Theme } from '@/lib/space';

export type ProfileRow = { key: string; icon: IconName; label: string; values: string[]; swatches?: string[] };

export type ProfileData = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  since: string | null;
  total: number;
  pct: number;
  plan: PlanId;
  renews: string | null;
  style: ProfileRow[];
  theme: Theme;
  shortcut: boolean;
  spaceName: string;
  dressingView: string;
};

const TINTS = ['', 'dk-bubble-ico--blue', 'dk-bubble-ico--choco'];

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 14.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</span>
    </div>
  );
}

function Row({ icon, tint, label, children, href }: { icon: IconName; tint: string; label: string; children?: ReactNode; href?: string }) {
  const inner = (
    <>
      <span className={`dk-bubble-ico ${tint}`}>
        <Icon name={icon} size={19} />
      </span>
      <span className="dk-row__label">{label}</span>
      {children}
    </>
  );
  return href ? (
    <Link href={href} className="dk-row dk-tap">
      {inner}
      <Icon name="chevronRight" size={18} style={{ color: 'var(--subtle)' }} />
    </Link>
  ) : (
    <div className="dk-row" style={{ cursor: 'default' }}>{inner}</div>
  );
}

/**
 * Le profil d'après la référence : photo et pastille d'édition, nom sur
 * deux lignes, trois chiffres, la pastille d'offre pleine largeur, puis
 * des groupes de lignes à pastilles de couleur, compteur et chevron.
 */
export function ProfileScreen({ data }: { data: ProfileData }) {
  const [first, ...rest] = (data.name ?? 'Mon profil').trim().split(/\s+/);
  const letter = (data.name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const since = data.since
    ? new Intl.DateTimeFormat('fr-FR', { month: '2-digit', year: 'numeric' }).format(new Date(data.since))
    : '—';

  return (
    <Screen>
      <header style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ position: 'relative', flex: 'none' }}>
          {data.avatarUrl ? (
            <img src={data.avatarUrl} alt="" style={{ width: 104, height: 116, borderRadius: 22, objectFit: 'cover', display: 'block' }} />
          ) : (
            <span
              aria-hidden="true"
              style={{
                width: 104, height: 116, borderRadius: 22, display: 'grid', placeItems: 'center',
                background: 'var(--blue)', color: '#000', fontSize: 40, fontWeight: 700,
              }}
            >
              {letter}
            </span>
          )}
          <Link
            href="/demarrage?ajuster=1"
            aria-label="Modifier mon profil"
            className="dk-tap"
            style={{ position: 'absolute', top: -12, right: -14, width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'var(--butter)' }}
          >
            <Icon name="burst" size={40} style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.18))' }} />
            <Icon name="pencil" size={16} style={{ position: 'relative', color: '#432F2E' }} />
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, paddingTop: 2 }}>
          <h1 style={{ fontSize: 34, lineHeight: 1, overflowWrap: 'anywhere' }}>
            {first}
            {rest.length ? <><br />{rest.join(' ')}</> : null}
          </h1>
          <div style={{ display: 'flex', gap: 16 }}>
            <Stat value={data.total} label="Pièces" />
            <Stat value={`${Math.round(data.pct)} %`} label="Portées" />
            <Stat value={since} label="Membre" />
          </div>
        </div>
      </header>

      <Link
        href="#offres"
        className="dk-tap"
        style={{
          display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 18px', borderRadius: 999,
          background: 'var(--blue-glass)', color: '#000', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.85), 0 4px 14px rgba(75,125,165,.2)',
        }}
      >
        <strong style={{ fontSize: 13.5, letterSpacing: '.06em', textTransform: 'uppercase' }}>{PLAN_LABEL[data.plan]}</strong>
        <Icon name="info" size={16} style={{ opacity: 0.55 }} />
        <span style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 500 }}>
          {data.plan === 'decouverte' ? 'Voir les offres' : data.renews ? `jusqu’au ${data.renews}` : 'active'}
        </span>
      </Link>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="dk-h2">Mon style</h2>
        <div className="dk-group">
          {data.style.map((r, i) => (
            <details key={r.key}>
              <summary className="dk-row dk-tap">
                <span className={`dk-bubble-ico ${TINTS[i % TINTS.length]}`}>
                  <Icon name={r.icon} size={19} />
                </span>
                <span className="dk-row__label">{r.label}</span>
                {r.values.length ? <span className="dk-count">{r.values.length}</span> : <span className="dk-row__value">—</span>}
                <Icon name="chevronRight" size={18} style={{ color: 'var(--subtle)' }} />
              </summary>
              <div className="dk-row-body">
                {r.swatches?.length ? (
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {r.swatches.map((hex, k) => (
                      <span key={k} style={{ width: 22, height: 22, borderRadius: 999, background: hex, border: '1.5px solid var(--line)' }} />
                    ))}
                  </span>
                ) : null}
                {r.values.length ? r.values.join(' · ') : 'Pas encore renseigné.'}
              </div>
            </details>
          ))}
          <Row icon="pencil" tint="dk-bubble-ico--tile" label="Ajuster mes réponses" href="/demarrage?ajuster=1" />
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="dk-h2">Abonnement</h2>
        <Pricing current={data.plan} />
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="dk-h2">Paramètres</h2>
        <div className="dk-group">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 12px 14px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="dk-bubble-ico dk-bubble-ico--blue"><Icon name="contrast" size={19} /></span>
              <span className="dk-row__label">Apparence</span>
            </span>
            <ThemeChoice current={data.theme} />
          </div>
          <Row icon="moon" tint="" label="Raccourci clair / sombre">
            <ShortcutSwitch on={data.shortcut} />
          </Row>
          <Row icon="home" tint="dk-bubble-ico--choco" label="Mon espace">
            <span className="dk-row__value">{data.spaceName}</span>
          </Row>
          <Row icon="grid" tint="dk-bubble-ico--blue" label="Vue du dressing">
            <span className="dk-row__value">{data.dressingView === 'grille' ? 'Grille' : 'Portants'}</span>
          </Row>
          {data.email ? (
            <Row icon="chat" tint="" label="Compte">
              <span className="dk-row__value" style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.email}</span>
            </Row>
          ) : null}
          <form action={signOut}>
            <button type="submit" className="dk-row dk-tap" style={{ color: 'var(--danger)' }}>
              <span className="dk-bubble-ico dk-bubble-ico--tile" style={{ color: 'var(--danger)' }}>
                <Icon name="logout" size={19} />
              </span>
              <span className="dk-row__label">Me déconnecter</span>
            </button>
          </form>
        </div>
      </section>

      <p style={{ fontSize: 12, color: 'var(--subtle)', textAlign: 'center' }}>
        Dressy · ton dressing, en vitrine
      </p>
    </Screen>
  );
}
