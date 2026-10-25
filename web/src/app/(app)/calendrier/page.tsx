import { Screen, Title, Card } from '@/components/ui';

export default function Calendrier() {
  return (
    <Screen>
      <Title sub="Tenues planifiées, occasions, prêts, voyages.">
        <em className="accent">Calendrier</em>
      </Title>
      <Card center i={1}>
        <p className="small muted">
          Bientôt, tu pourras prévoir une tenue pour chaque jour, noter tes occasions,
          tes prêts et tes voyages.
        </p>
      </Card>
    </Screen>
  );
}
