import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getThemeShortcut, getViewer } from '@/lib/space';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions';
import { ShortcutSwitch, ThemeChoice } from '@/components/ThemeChoice';
import { PortalButton } from '@/components/PortalButton';
import { Pricing } from '@/components/Pricing';
import { Icon, type IconName } from '@/components/icons';
import { loadSubscription, subscriptionLine } from '@/lib/billing';
import { parisDay } from '@/lib/dates';
import { planName } from '@/lib/plans';
import { Screen } from '@/components/ui';
import { labelsFor, colourHex } from '@/lib/onboarding';

const DRESSING_VIEW: Record<string, string> = { portants: 'Par portants', grille: 'En grille' };
/** Les pastilles alternent les couleurs de la palette, comme sur la référence. */
const TINTS = ['', 'dk-bubble-ico--blue', 'dk-bubble-ico--choco'];

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
      <span className="eyebrow" style={{ fontSize: 11 }}>{label}</span>
    </div>
  );
}

function Row({ icon, tint, label, children, href }: { icon: IconName; tint: string; label: string; children?: ReactNode; href?: string }) {
  const inner = (
    <>
      <span className={`dk-bubble-ico ${tint}`}><Icon name={icon} size={19} /></span>
      <span className="dk-row__label">{label}</span>
      {children}
    </>
  );
  return href ? (
    <Link href={href} className="dk-row">
      {inner}
      <Icon name="chevronRight" size={18} style={{ color: 'var(--muted)' }} />
    </Link>
  ) : (
    <div className="dk-row" style={{ cursor: 'default' }}>{inner}</div>
  );
}

/**
 * Mon compte (21/10), sur la référence « exemple page Profile » : la photo
 * et sa pastille d'édition, le nom sur deux lignes, trois chiffres, la
 * pastille de l'offre en pleine largeur, puis des groupes de lignes à
 * pastille de couleur, compteur et chevron. Les tarifs et les paramètres
 * vivent ici.
 */
export default async function Moi({
  searchParams,
}: {
  searchParams: Promise<{ abonnement?: string }>;
}) {
  const { abonnement } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion');

  const supabase = await createClient();
  const [{ data: sp }, subscription, { count: customers }, { count: everSubscribed }, { count: pieces }, { data: stats }, { data: profile }, shortcut] = await Promise.all([
    supabase.from('style_profile').select('*').eq('space_id', viewer.spaceId).maybeSingle(),
    loadSubscription(supabase, viewer.spaceId),
    supabase.from('billing_customers').select('space_id', { count: 'exact', head: true }).eq('space_id', viewer.spaceId),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('space_id', viewer.spaceId),
    supabase.from('garments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('garment_stats').select('last_worn_on').eq('space_id', viewer.spaceId),
    supabase.from('profiles').select('created_at').eq('id', viewer.userId).maybeSingle(),
    getThemeShortcut(),
  ]);

  const total = pieces ?? 0;
  const since = parisDay(-90);
  const worn = ((stats ?? []) as { last_worn_on: string | null }[]).filter((s) => s.last_worn_on && s.last_worn_on >= since).length;
  const pct = total ? Math.round((Math.min(worn, total) / total) * 100) : 0;
  const member = profile?.created_at
    ? new Intl.DateTimeFormat('fr-FR', { month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(profile.created_at))
    : null;

  const name = (viewer.displayName ?? '').trim();
  const [first, ...rest] = name ? name.split(/\s+/) : ['Mon', 'compte'];
  const letter = (name || '?').charAt(0).toUpperCase();
  const colours: string[] = sp?.colours ?? [];

  const style: { key: string; icon: IconName; label: string; values: string[]; swatches?: string[] }[] = [
    { key: 'styles', icon: 'star', label: 'Mon style', values: labelsFor('styles', sp?.styles ?? []) },
    { key: 'colours', icon: 'palette', label: 'Mes couleurs', values: labelsFor('colours', colours), swatches: colours.map(colourHex) },
    { key: 'items', icon: 'shirt', label: 'Ce que je porte', values: labelsFor('favourite_items', sp?.favourite_items ?? []) },
    {
      key: 'bijoux', icon: 'gem', label: 'Bijoux et accessoires',
      values: [...labelsFor('jewelry', sp?.jewelry ?? []), ...labelsFor('accessories', sp?.accessories ?? [])],
    },
    { key: 'occasions', icon: 'party', label: 'Mes occasions', values: labelsFor('occasions', sp?.occasions ?? []) },
    { key: 'avoid', icon: 'eyeOff', label: 'Ce que j’évite', values: labelsFor('avoid', sp?.avoid ?? []) },
    {
      key: 'rythme', icon: 'clock', label: 'Mon rythme',
      values: [...labelsFor('morning_time', sp?.morning_time ?? null), ...labelsFor('time_intent', sp?.time_intent ?? null)],
    },
    { key: 'goals', icon: 'target', label: 'Mes objectifs', values: labelsFor('goals', sp?.goals ?? []) },
  ];

  return (
    <Screen>
      <header className="rise" style={{ display: 'flex', gap: 18, alignItems: 'flex-start', paddingTop: 6 }}>
        <div style={{ position: 'relative', flex: 'none' }}>
          <span
            aria-hidden="true"
            style={{
              width: 100, height: 112, borderRadius: 22, display: 'grid', placeItems: 'center',
              background: 'var(--blue)', color: '#000', fontSize: 40, fontWeight: 300, fontFamily: 'var(--font-display)',
            }}
          >
            {letter}
          </span>
          <Link
            href="/demarrage?ajuster=1"
            aria-label="Modifier mon profil"
            style={{ position: 'absolute', top: -12, right: -14, width: 42, height: 42, display: 'grid', placeItems: 'center', color: 'var(--butter)' }}
          >
            <span style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.18))' }}>
              <Icon name="burst" size={42} />
            </span>
            <span style={{ position: 'relative', color: '#432f2e' }}><Icon name="pencil" size={16} /></span>
          </Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, paddingTop: 2 }}>
          <h1 style={{ fontSize: 32, lineHeight: 1.02, overflowWrap: 'anywhere' }}>
            {first}
            {rest.length ? <><br />{rest.join(' ')}</> : null}
          </h1>
          <div style={{ display: 'flex', gap: 16 }}>
            <Stat value={total} label="Pièces" />
            <Stat value={`${pct} %`} label="Portées" />
            {member ? <Stat value={member} label="Membre" /> : null}
          </div>
        </div>
      </header>

      <Link
        href="#offres"
        className="rise"
        style={{
          '--i': 1, display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 18px', borderRadius: 999,
          background: 'var(--blue-glass)', color: '#000', boxShadow: 'var(--blue-shadow)',
        } as CSSProperties}
      >
        <strong style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>{planName(subscription?.plan)}</strong>
        <span style={{ opacity: 0.55 }}><Icon name="info" size={16} /></span>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500, textAlign: 'right' }}>
          {subscription ? subscriptionLine(subscription).replace(/\.$/, '') : 'Voir les offres'}
        </span>
      </Link>

      {abonnement === 'merci' ? (
        <p role="status" className="note pop center">
          {subscription
            ? `Merci ! ${planName(subscription.plan)} est active.`
            : 'Merci ! Stripe confirme ton paiement : ton offre s’active dans quelques secondes. Recharge la page si elle ne s’affiche pas.'}
        </p>
      ) : null}

      <section className="rise" style={{ '--i': 2, display: 'flex', flexDirection: 'column', gap: 12 } as CSSProperties}>
        <h2 className="section-title">Ce que Kodi sait de toi</h2>
        <div className="dk-group">
          {style.map((r, i) => (
            <details key={r.key}>
              <summary className="dk-row">
                <span className={`dk-bubble-ico ${TINTS[i % TINTS.length]}`}><Icon name={r.icon} size={19} /></span>
                <span className="dk-row__label">{r.label}</span>
                {r.values.length ? <span className="dk-count">{r.values.length}</span> : <span className="dk-row__value">·</span>}
                <span style={{ color: 'var(--muted)', display: 'inline-flex' }}><Icon name="chevronRight" size={18} /></span>
              </summary>
              <div className="dk-row-body">
                {r.swatches?.length ? (
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {r.swatches.map((hex, k) => (
                      <span key={k} style={{ width: 22, height: 22, borderRadius: 999, background: hex, border: '2px solid var(--glass-edge)', boxShadow: 'var(--shadow-glass)' }} />
                    ))}
                  </span>
                ) : null}
                {r.values.length ? r.values.join(' · ') : 'Pas encore renseigné.'}
              </div>
            </details>
          ))}
          <Row icon="pencil" tint="dk-bubble-ico--plain" label="Ajuster mes réponses" href="/demarrage?ajuster=1" />
        </div>
      </section>

      <section className="rise" style={{ '--i': 3, display: 'flex', flexDirection: 'column', gap: 12 } as CSSProperties}>
        <h2 className="section-title">Tarifs</h2>
        <Pricing current={subscription?.plan ?? null} trial={!everSubscribed} />
        {/* Une abonnée, ou une ancienne abonnée, garde l'accès à ses factures. */}
        {subscription || customers ? <PortalButton /> : null}
      </section>

      <section className="rise" style={{ '--i': 4, display: 'flex', flexDirection: 'column', gap: 12 } as CSSProperties}>
        <h2 className="section-title">Paramètres</h2>
        <div className="dk-group">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 12px 14px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="dk-bubble-ico dk-bubble-ico--blue"><Icon name="contrast" size={19} /></span>
              <span className="dk-row__label">Apparence</span>
            </span>
            <ThemeChoice current={viewer.settings.theme} />
          </div>
          <Row icon="moon" tint="" label="Raccourci clair / sombre">
            <ShortcutSwitch on={shortcut} />
          </Row>
          <Row icon="home" tint="dk-bubble-ico--choco" label="Mon espace">
            <span className="dk-row__value">{viewer.spaceName}</span>
          </Row>
          <Row icon="grid" tint="dk-bubble-ico--blue" label="Vue du dressing">
            <span className="dk-row__value">{DRESSING_VIEW[viewer.settings.dressing_view] ?? viewer.settings.dressing_view}</span>
          </Row>
          {viewer.email ? (
            <Row icon="user" tint="" label="Compte">
              <span className="dk-row__value" style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{viewer.email}</span>
            </Row>
          ) : null}
          <Row icon="lock" tint="dk-bubble-ico--plain" label="Vie privée" href="/confidentialite" />
          <form action={signOut}>
            <button type="submit" className="dk-row" style={{ color: 'var(--danger)' }}>
              <span className="dk-bubble-ico dk-bubble-ico--plain" style={{ color: 'var(--danger)' }}><Icon name="logout" size={19} /></span>
              <span className="dk-row__label">Me déconnecter</span>
            </button>
          </form>
        </div>
      </section>
    </Screen>
  );
}
