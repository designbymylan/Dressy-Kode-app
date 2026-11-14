import { notFound } from 'next/navigation';
import type { KodeMessage, OutfitView } from '@/lib/kode';
import { KodeChat } from '@/components/KodeChat';
import { TabBar } from '@/components/TabBar';
import { outfit } from '../fixtures';

/**
 * Planche de la conversation avec Kodi, sans compte ni base : le même
 * KodeChat que /kodi, nourri de bulles inventées, pour voir les champs de
 * Kodi v2 (maquette validée le 14/11) en clair et en sombre. Fermée par
 * défaut : elle ne s'ouvre qu'avec DRESSY_APERCU=1. Les boutons appellent
 * les vraies actions : sans compte, ils répondent « Session expirée ».
 *
 *   ?cas=question   une tenue, la question de Kodi, la variante prête (défaut)
 *   ?cas=chaude     une variante dans une direction qui n'a pas sa puce
 *   ?cas=manque     rien qui convienne : ce qui te manque
 *   &quota=0        plus de question ce mois-ci (la réponse reste gratuite)
 */
export const dynamic = 'force-dynamic';

const vue = (ids: string[], title: string, why: string): OutfitView => ({ ...outfit(ids, title), why });

const CAS: Record<string, KodeMessage[]> = {
  question: [
    { id: 'u1', author: 'user', body: 'Je mets quoi samedi soir ?', outfit: null },
    {
      id: 'k1', author: 'kode', body: 'Ton pantalon noir avec le sweat à capuche et les sabots marche presque partout.',
      outfit: vue(['h1', 'b2', 'c1'], 'Simple et juste', 'Le gris et le noir s’accordent, les sabots tiennent la soirée.'),
      question: 'Plutôt dîner au calme ou soirée qui dure ?',
      variante: { direction: 'plus_habillee', titre: 'Un cran au-dessus', servie: false },
    },
  ],
  chaude: [
    { id: 'u1', author: 'user', body: 'Une tenue pour demain, il fera frais le matin', outfit: null },
    {
      id: 'k1', author: 'kode', body: 'La chemise ciel sous le pull crème, avec le jean gris : léger l’après-midi, couvert le matin.',
      outfit: vue(['h3', 'h2', 'b1', 'c1'], 'Doux et net', 'Deux couches qui s’enlèvent quand il fait meilleur.'),
      variante: { direction: 'plus_chaude', titre: 'Pour un vrai matin froid', servie: false },
    },
  ],
  manque: [
    { id: 'u1', author: 'user', body: 'Une tenue pour le mariage de ma cousine en juin', outfit: null },
    {
      id: 'k1', author: 'kode',
      body: 'Avec ce que tu as, je ne trouve rien à la hauteur d’un mariage : tout reste trop décontracté. Je préfère te le dire plutôt que de te proposer une tenue qui ne tient pas.',
      outfit: null,
      manque: 'une robe ou un pantalon fluide d’une couleur unie',
    },
  ],
};

export default async function ApercuKodi({ searchParams }: { searchParams: Promise<{ cas?: string; quota?: string }> }) {
  if (process.env.DRESSY_APERCU !== '1') notFound();
  const { cas, quota } = await searchParams;
  const messages = CAS[cas ?? 'question'] ?? CAS.question;
  return (
    <>
      <KodeChat
        name="Alice"
        initial={messages}
        usage={quota === '0' ? { used: 30, quota: 30 } : { used: 12, quota: 30 }}
        plannedTomorrow={null}
        pieces={13}
      />
      <TabBar active="/kodi" />
    </>
  );
}
