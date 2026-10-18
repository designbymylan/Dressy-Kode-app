import type { CSSProperties } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/space';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions';
import { ThemeChoice } from '@/components/ThemeChoice';
import { Screen, Title, Card } from '@/components/ui';
import { labelsFor, colourHex } from '@/lib/onboarding';

const DRESSING_VIEW: Record<string, string> = { portants: 'Par portants', grille: 'En grille' };

function Line({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <dt className="eyebrow" style={{ textAlign: 'left' }}>{label}</dt>
      <dd style={{ fontSize: 14, lineHeight: 1.4 }}>{values.join(' · ')}</dd>
    </div>
  );
}

export default async function Moi() {
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');

  const supabase = await createClient();
  const { data: sp } = await supabase
    .from('style_profile')
    .select('*')
    .eq('space_id', viewer.spaceId)
    .maybeSingle();

  const colours: string[] = sp?.colours ?? [];

  return (
    <Screen>
      <Title sub={viewer.email ?? undefined}>
        Mon <em className="accent">compte</em>
      </Title>

      <Card i={1}>
        <h2 className="section-title">Apparence</h2>
        <p className="small muted">
          Le choix est enregistré sur ton compte et vaut pour toute l&apos;application,
          sur tous tes appareils.
        </p>
        <ThemeChoice current={viewer.settings.theme} />
      </Card>

      <Card i={2}>
        <h2 className="section-title">Ce que Dressy sait de toi</h2>
        <dl style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Line label="Ton style" values={labelsFor('styles', sp?.styles ?? [])} />
          {colours.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <dt className="eyebrow" style={{ textAlign: 'left' }}>Tes couleurs</dt>
              <dd style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {colours.map((id, i) => (
                  <span
                    key={id}
                    title={labelsFor('colours', [id])[0]}
                    className="pop"
                    style={{
                      '--i': i, width: 24, height: 24, borderRadius: 999, background: colourHex(id),
                      border: '2px solid var(--glass-edge)', boxShadow: 'var(--shadow-glass)',
                    } as CSSProperties}
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

        <Link href="/demarrage?ajuster=1" className="btn btn-glass btn-block">
          Ajuster mes réponses
        </Link>
      </Card>

      <Card i={3}>
        <h2 className="section-title">Mon espace</h2>
        <dl style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <dt className="muted">Nom</dt>
            <dd style={{ fontWeight: 500 }}>{viewer.spaceName}</dd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <dt className="muted">Vue du dressing</dt>
            <dd style={{ fontWeight: 500 }}>{DRESSING_VIEW[viewer.settings.dressing_view] ?? viewer.settings.dressing_view}</dd>
          </div>
        </dl>
      </Card>

      <form action={signOut} className="rise" style={{ '--i': 4 } as CSSProperties}>
        <button type="submit" className="btn btn-glass btn-block">
          Me déconnecter
        </button>
      </form>
    </Screen>
  );
}
