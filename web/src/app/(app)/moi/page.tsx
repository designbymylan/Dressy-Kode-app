import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/space';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions';
import { ThemeChoice } from '@/components/ThemeChoice';
import { PortalButton } from '@/components/PortalButton';
import { Screen, Title, Card, buttonPrimary, buttonQuiet } from '@/components/ui';
import { labelsFor, colourHex } from '@/lib/onboarding';
import { loadSubscription, subscriptionLine } from '@/lib/billing';
import { FREE_PLAN, PLANS, planName } from '@/lib/plans';

function Line({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <dt style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
        {label}
      </dt>
      <dd style={{ fontSize: 14, lineHeight: 1.4 }}>{values.join(' · ')}</dd>
    </div>
  );
}

export default async function Moi({
  searchParams,
}: {
  searchParams: Promise<{ abonnement?: string }>;
}) {
  const { abonnement } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');

  const supabase = await createClient();
  const [{ data: sp }, subscription, { count: customers }] = await Promise.all([
    supabase.from('style_profile').select('*').eq('space_id', viewer.spaceId).maybeSingle(),
    loadSubscription(supabase, viewer.spaceId),
    supabase.from('billing_customers').select('space_id', { count: 'exact', head: true }).eq('space_id', viewer.spaceId),
  ]);
  const features = subscription
    ? PLANS.find((p) => p.id === subscription.plan)!.features.filter((f) => !f.soon).map((f) => f.label)
    : FREE_PLAN.features;

  const colours: string[] = sp?.colours ?? [];

  return (
    <Screen>
      <Title sub={viewer.email ?? undefined}>
        {viewer.displayName ? `Salut, ${viewer.displayName}` : 'Mon compte'}
      </Title>

      {abonnement === 'merci' ? (
        <Card style={{ background: 'var(--accent-tint)', boxShadow: 'none' }}>
          <p role="status" style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--accent-ink)' }}>
            {subscription
              ? `Merci ! ${planName(subscription.plan)} est active.`
              : 'Merci ! Stripe confirme ton paiement : ton offre s’active dans quelques secondes. Recharge la page si elle ne s’affiche pas.'}
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 style={{ fontSize: 19 }}>Mon offre : {planName(subscription?.plan)}</h2>
        <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--muted)' }}>
          {features.join(' · ')}
          {subscription ? <><br />{subscriptionLine(subscription)}</> : null}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {subscription ? (
            <PortalButton />
          ) : (
            <Link href="/offres" style={{ ...buttonPrimary, alignSelf: 'flex-start' }}>
              Voir les offres
            </Link>
          )}
          {/* Une ancienne abonnée garde l'accès à ses factures. */}
          {!subscription && customers ? <PortalButton /> : null}
        </div>
      </Card>

      <Card>
        <h2 style={{ fontSize: 19 }}>Apparence</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Le choix est enregistré sur ton compte et vaut pour toute l&apos;application,
          sur tous tes appareils.
        </p>
        <ThemeChoice current={viewer.settings.theme} />
      </Card>

      <Card>
        <h2 style={{ fontSize: 19 }}>Ce que Dressy sait de toi</h2>
        <dl style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Line label="Ton style" values={labelsFor('styles', sp?.styles ?? [])} />
          {colours.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <dt style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                Tes couleurs
              </dt>
              <dd style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {colours.map((id) => (
                  <span
                    key={id}
                    title={labelsFor('colours', [id])[0]}
                    style={{
                      width: 22, height: 22, borderRadius: 999, background: colourHex(id),
                      border: '1.5px solid var(--line)',
                    }}
                  />
                ))}
              </dd>
            </div>
          ) : null}
          <Line label="Ce que tu portes" values={labelsFor('favourite_items', sp?.favourite_items ?? [])} />
          <Line label="Pour" values={labelsFor('occasions', sp?.occasions ?? [])} />
          <Line label="Tu évites" values={labelsFor('avoid', sp?.avoid ?? [])} />
          <Line
            label="Ton rythme"
            values={[
              ...labelsFor('morning_time', sp?.morning_time ?? null),
              ...labelsFor('time_intent', sp?.time_intent ?? null),
            ]}
          />
          <Line label="Ton objectif" values={labelsFor('goals', sp?.goals ?? [])} />
          <Line label="Je commence par" values={labelsFor('assistance', sp?.assistance ?? null)} />
        </dl>

        <Link href="/demarrage?ajuster=1" style={{ ...buttonQuiet, alignSelf: 'flex-start' }}>
          Ajuster mes réponses
        </Link>
      </Card>

      <Card>
        <h2 style={{ fontSize: 19 }}>Mon espace</h2>
        <dl style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <dt style={{ color: 'var(--muted)' }}>Nom</dt>
            <dd style={{ fontWeight: 500 }}>{viewer.spaceName}</dd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <dt style={{ color: 'var(--muted)' }}>Vue du dressing</dt>
            <dd style={{ fontWeight: 500 }}>{viewer.settings.dressing_view}</dd>
          </div>
        </dl>
      </Card>

      <form action={signOut}>
        <button type="submit" style={{ ...buttonQuiet, width: '100%' }}>
          Me déconnecter
        </button>
      </form>
    </Screen>
  );
}
