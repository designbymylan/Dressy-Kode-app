import { Screen, Title, Card } from '@/components/ui';

export default function Kode() {
  return (
    <Screen>
      <Title sub="Ton styliste, avec ce que tu possèdes déjà.">
        <em className="accent">Kode</em>
      </Title>
      <Card center i={1}>
        <p className="small muted">
          La conversation avec Kode arrive bientôt. En attendant, compose tes tenues depuis
          l&apos;accueil ou le dressing : Kode apprend de ce que tu assembles.
        </p>
      </Card>
    </Screen>
  );
}
