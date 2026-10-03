import type { CSSProperties } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/space';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions';
import { ThemeChoice } from '@/components/ThemeChoice';
import { PortalButton } from '@/components/PortalButton';
import { loadSubscription, subscriptionLine } from '@/lib/billing';
import { FREE_PLAN, PLANS, planName } from '@/lib/plans';
import { Screen, Title, Card } from '@/components/ui';
import { labelsFor, colourHex } from '@/lib/onboarding';

function Line({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <dt className="eyebrow" style={{ fontSize: 12, textAlign: 'left' }}>{label}</dt>
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
        {viewer.displayName ? <>Salut, <em className="accent">{viewer.displayName}</em></> : <>Mon <em className="accent">compte</em></>}
      </Title>

      {abonnement === 'merci' ? (
        <p role="status" className="note pop center">
          {subscription
            ? `Merci ! ${planName(subscription.plan)} est active.`
            : 'Merci ! Stripe confirme ton paiement : ton offre s’active dans quelques secondes. Recharge la page si elle ne s’affiche pas.'}
        </p>
      ) : null}

      <Card i={1}>
        <h2 className="section-title">Mon offre : {planName(subscription?.plan)}</h2>
        <p className="small muted">
          {features.join(' · ')}
          {subscription ? <><br />{subscriptionLine(subscription)}</> : null}
        </p>
        {subscription ? (
          <PortalButton />
        ) : (
          <Link href="/offres" className="btn btn-primary btn-block">Voir les offres</Link>
        )}
        {/* Une ancienne abonnée garde l'accès à ses factures. */}
        {!subscription && customers ? <PortalButton /> : null}
      </Card>

      <Card i={2}>
        <h2 className="section-title">Apparence</h2>
        <p className="small muted">
          Le choix est enregistré sur ton compte et vaut pour toute l&apos;application,
          sur tous tes appareils.
        </p>
        <ThemeChoice current={viewer.settings.theme} />
      </Card>

      <Card i={3}>
        <h2 className="section-title">Ce que Kode sait de toi</h2>
        <dl style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Line label="Ton style" values={labelsFor('styles', sp?.styles ?? [])} />
          {colours.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <dt className="eyebrow" style={{ fontSize: 12, textAlign: 'left' }}>Tes couleurs</dt>
              <dd style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {colours.map((id, i) => (
                  <span
                    key={id}
                    title={labelsFor('colours', [id])[0]}
                    className="pop"
                    style={{
                      '--i': i, width: 24, height: 24, borderRadius: 0, background: colourHex(id),
                      border: '2px solid var(--glass-edge)',
                    } as CSSProperties}
                  />
                ))}
              </dd>
            </div>
          ) : null}
          <Line label="Ce que tu portes" values={labelsFor('favourite_items', sp?.favourite_items ?? [])} />
          <Line label="Tes bijoux" values={labelsFor('jewelry', sp?.jewelry ?? [])} />
          <Line label="Tes accessoires" values={labelsFor('accessories', sp?.accessories ?? [])} />
          <Line label="Tu aimerais porter" values={[...labelsFor('jewelry', sp?.jewelry_wish ?? []), ...labelsFor('accessories', sp?.accessories_wish ?? [])]} />
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

        <Link href="/demarrage?ajuster=1" className="btn btn-glass btn-block">
          Ajuster mes réponses
        </Link>
      </Card>

      <Card i={4}>
        <h2 className="section-title">Mon espace</h2>
        <dl style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <dt className="muted">Nom</dt>
            <dd style={{ fontWeight: 500 }}>{viewer.spaceName}</dd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <dt className="muted">Vue du dressing</dt>
            <dd style={{ fontWeight: 500 }}>{viewer.settings.dressing_view}</dd>
          </div>
        </dl>
      </Card>

      <form action={signOut} className="rise" style={{ '--i': 5 } as CSSProperties}>
        <button type="submit" className="btn btn-glass btn-block">
          Me déconnecter
        </button>
      </form>
    </Screen>
  );
}
