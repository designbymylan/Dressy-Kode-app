import { Screen, Title, Card } from '@/components/ui';

export default function Calendrier() {
  return (
    <Screen>
      <Title sub="Tenues planifiées, occasions, prêts, voyage.">Calendrier</Title>
      <Card>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--muted)' }}>
          Le portage de l&apos;écran reste à faire. Les tables{' '}
          <code style={{ fontSize: 13 }}>planned_days</code>,{' '}
          <code style={{ fontSize: 13 }}>events</code> et{' '}
          <code style={{ fontSize: 13 }}>trips</code> l&apos;attendent, et la logique
          corrigée est dans <code style={{ fontSize: 13 }}>design/_projet/Calendrier.dc.html</code>.
        </p>
      </Card>
    </Screen>
  );
}
