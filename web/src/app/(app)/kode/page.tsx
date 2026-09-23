import { Screen, Title, Card } from '@/components/ui';

export default function Kode() {
  return (
    <Screen>
      <Title sub="Ton styliste, avec ce que tu possèdes déjà.">Kode</Title>
      <Card>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--muted)' }}>
          La conversation n&apos;est pas encore branchée. La maquette de référence est
          <code style={{ fontSize: 13 }}> design/_projet/Kode.dc.html</code>.
        </p>
      </Card>
    </Screen>
  );
}
