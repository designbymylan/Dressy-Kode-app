import { notFound } from 'next/navigation';
import type { Home, WeekDay } from '@/lib/accueil';
import { semaine } from '@/lib/contexte';
import { suggestOutfits } from '@/lib/outfits';
import { HomeView } from '@/components/HomeView';
import { TabBar } from '@/components/TabBar';
import { parisDay } from '@/lib/dates';
import { AVIS } from '@/lib/politique';
import { MOTS, PIECES, contexteFictif, outfit } from '../fixtures';

/**
 * Planche de l'accueil, sans compte ni base : le même HomeView que
 * /accueil, nourri de données inventées (le compte de démonstration
 * d'Alice, comme dans l'app mobile). Sert à voir l'écran en clair et en
 * sombre, et à le contrôler (/dressy-qa). Fermée par défaut : elle ne
 * s'ouvre qu'avec DRESSY_APERCU=1 dans l'environnement du serveur.
 *
 *   ?etat=vide    espace sans aucune pièce
 *   ?etat=debut   quelques pièces, pas encore de tenue possible
 *   (sans)        le dressing d'Alice, accueil complet
 *   &avis=1       avec l'avis de changement le plus récent en tête
 */
export const dynamic = 'force-dynamic';

export default async function ApercuAccueil({ searchParams }: { searchParams: Promise<{ etat?: string; avis?: string }> }) {
  if (process.env.DRESSY_APERCU !== '1') notFound();
  const { etat, avis } = await searchParams;

  const pieces = etat === 'vide' ? [] : etat === 'debut' ? PIECES.filter((p) => ['h1', 'h2', 'c1'].includes(p.id)) : PIECES;
  const contexte = contexteFictif();
  const meteo = semaine(contexte);
  const weather = meteo[0]!;

  const week: WeekDay[] = MOTS.slice(0, 7).map((_, offset) => ({
    day: parisDay(offset),
    offset,
    weather: meteo[offset],
    outfit: offset === 1 ? outfit(['m6', 'r3', 'c5'], 'Noir sur noir, mais doux') : offset === 4 ? outfit(['h1', 'b2', 'c1', 'a1'], 'Net, sans raideur') : null,
    event: offset === 1 ? 'Dîner chez Léa' : offset === 3 ? 'Yoga' : offset === 4 ? 'Présentation trimestrielle' : null,
    note: offset === 1 ? 'Dîner chez Léa' : offset === 3 ? 'Yoga' : offset === 4 ? 'Présentation trimestrielle' : null,
  }));

  const home: Home = {
    pieces,
    outfits: suggestOutfits(pieces, weather),
    worn: false,
    streak: 2,
    weather,
    now: { t: 14, kind: 'averses' },
    city: 'Paris',
    hasCity: true,
    eventsToday: 1,
    week,
    trip: null,
    contexte,
  };

  return (
    <>
      <HomeView home={home} name="Alice" avis={avis === '1' ? (AVIS[0] ?? null) : null} />
      <TabBar active="/accueil" />
    </>
  );
}
