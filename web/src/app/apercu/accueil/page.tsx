import { notFound } from 'next/navigation';
import type { Home, WeekDay } from '@/lib/accueil';
import type { Bloc, Contexte } from '@/lib/contexte';
import type { OutfitPiece } from '@/lib/kode';
import { suggestOutfits, type HomePiece } from '@/lib/outfits';
import { HomeView } from '@/components/HomeView';
import { TabBar } from '@/components/TabBar';
import { parisDay } from '@/lib/dates';

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
 */
export const dynamic = 'force-dynamic';

const piece = (
  id: string, name: string, category_id: string, kind: string, colour: string | null,
  wears: number, lastWorn: number | null, addedDaysAgo: number, img?: string,
): HomePiece => ({ id, name, category_id, kind, colour, url: img ? `/pieces/${img}.webp` : null, wears, lastWorn, addedDaysAgo });

const PIECES: HomePiece[] = [
  piece('m1', 'Trench camel', 'vestes', 'trench', '#C49A6C', 14, 12, 420),
  piece('m6', 'Veste de survêtement', 'vestes', 'veste', '#3A3C41', 11, 20, 500, 'veste-survetement'),
  piece('h1', 'Sweat à capuche', 'hauts', 'sweat', '#A7A29A', 18, 8, 460, 'sweat-capuche'),
  piece('h2', 'Pull côtelé crème', 'hauts', 'pull', '#EDE3D1', 9, 35, 400),
  piece('h3', 'Chemise ciel', 'hauts', 'chemise', '#C9DAEA', 5, 120, 260),
  piece('b1', 'Jean gris', 'bas', 'jean', '#8C8C90', 40, 2, 900, 'jean-gris'),
  piece('b2', 'Pantalon noir', 'bas', 'pantalon', '#2B2B2E', 19, 4, 650, 'pantalon-noir'),
  piece('b3', 'Jogging gris', 'bas', 'pantalon', '#A7A29A', 7, 22, 300, 'jogging-gris'),
  piece('r3', 'Robe vert sapin', 'robes', 'robe', '#2F4A3C', 0, null, 90),
  piece('c1', 'Sabots', 'chaussures', 'mocassins', '#7E4F2C', 20, 12, 600, 'sabots'),
  piece('c5', 'Escarpins noirs', 'chaussures', 'escarpins', '#26231F', 5, 210, 650),
  piece('a1', 'Cabas cognac', 'sacs', 'cabas', '#A8703E', 30, 3, 750, 'sac'),
  piece('a5', 'Ceinture cognac', 'accessoires', 'ceinture', '#7E4F2C', 21, 9, 700, 'ceinture'),
];

const bloc = <T,>(valeur: T, mention: string): Bloc<T> => ({
  valeur, source: null, mention, maj: new Date().toISOString(), etat: 'frais', message: null,
});

const MOTS = [
  { max: 14, min: 9, ciel: 'averses', libelle: 'averses vers midi' },
  { max: 16, min: 10, ciel: 'nuages', libelle: 'nuageux' },
  { max: 18, min: 11, ciel: 'soleil', libelle: 'ensoleillé' },
  { max: 15, min: 10, ciel: 'pluie', libelle: 'pluie l’après-midi' },
  { max: 13, min: 8, ciel: 'nuages', libelle: 'couvert' },
  { max: 17, min: 10, ciel: 'soleil', libelle: 'ensoleillé' },
  { max: 19, min: 12, ciel: 'soleil', libelle: 'grand beau' },
] as const;

function contexte(): Contexte {
  return {
    jour: parisDay(0),
    ville: bloc({ nom: 'Paris' }, ''),
    meteo: bloc({
      maintenant: { t: 14, ressenti: 12, ciel: 'averses', vent: 12 },
      jours: MOTS.map((m, i) => ({ date: parisDay(i), max: m.max, min: m.min, ciel: m.ciel, libelle: m.libelle, pluie: null, uv: null })),
    }, 'Météo : Open-Meteo'),
    feries: bloc([], 'Jours fériés : data.gouv.fr'),
    tendances: bloc([{ kind: 'trench', libelle: 'Le camel', variation: 24 }], 'Tendances : Google Trends'),
  };
}

const asOutfitPiece = (p: HomePiece): OutfitPiece => ({ id: p.id, name: p.name, slot: '', category: p.category_id, colour: p.colour, url: p.url });

export default async function ApercuAccueil({ searchParams }: { searchParams: Promise<{ etat?: string }> }) {
  if (process.env.DRESSY_APERCU !== '1') notFound();
  const { etat } = await searchParams;

  const pieces = etat === 'vide' ? [] : etat === 'debut' ? PIECES.filter((p) => ['h1', 'h2', 'c1'].includes(p.id)) : PIECES;
  const ctx = contexte();
  const weather = { t: 14, low: 9, kind: 'averses' as const, label: 'averses vers midi' };
  const byId = new Map(PIECES.map((p) => [p.id, p]));
  const plan = (ids: string[], title: string) => ({ id: `o-${title}`, title, pieces: ids.map((id) => asOutfitPiece(byId.get(id)!)) });

  const week: WeekDay[] = MOTS.map((m, offset) => ({
    day: parisDay(offset),
    offset,
    weather: { t: m.max, low: m.min, kind: m.ciel === 'nuages' ? 'nuages' : m.ciel === 'soleil' ? 'soleil' : m.ciel === 'pluie' ? 'pluie' : 'averses', label: m.libelle },
    outfit: offset === 1 ? plan(['m6', 'r3', 'c5'], 'Noir sur noir, mais doux') : offset === 4 ? plan(['h1', 'b2', 'c1', 'a1'], 'Net, sans raideur') : null,
    event: offset === 1 ? 'Dîner chez Léa' : offset === 3 ? 'Yoga' : offset === 4 ? 'Présentation trimestrielle' : null,
    note: offset === 1 ? 'Dîner chez Léa' : offset === 3 ? 'Yoga' : offset === 4 ? 'Présentation trimestrielle' : null,
  }));

  const home: Home = {
    pieces,
    outfits: suggestOutfits(pieces, weather),
    worn: false,
    weather,
    now: { t: 14, kind: 'averses' },
    city: 'Paris',
    eventsToday: 1,
    occasions: ['travail'],
    week,
    trip: null,
    contexte: ctx,
  };

  return (
    <>
      <HomeView home={home} name="Alice" />
      <TabBar active="/accueil" />
    </>
  );
}
