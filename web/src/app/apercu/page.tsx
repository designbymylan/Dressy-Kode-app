import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TabBar } from '@/components/TabBar';
import type { PieceView } from '@/components/PieceCard';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { DressingScreen } from '@/components/screens/DressingScreen';
import { KodiScreen } from '@/components/screens/KodiScreen';
import { CalendarScreen } from '@/components/screens/CalendarScreen';
import { ProfileScreen } from '@/components/screens/ProfileScreen';
import { getTheme, getThemeShortcut } from '@/lib/space';

/**
 * Aperçu des écrans avec des données d'exemple, sans compte ni base :
 * pour relire le design en clair et en sombre. Fermé par défaut ; il ne
 * s'ouvre qu'avec DRESSY_APERCU=1 dans l'environnement du serveur.
 */
export const dynamic = 'force-dynamic';

const PIECES: PieceView[] = [
  { id: 'p1', name: 'Blazer noir', category: 'Vestes et manteaux', url: null, wearCount: 6, worn: 'il y a 3 j', wornToday: false },
  { id: 'p2', name: 'Jean brut', category: 'Bas', url: null, wearCount: 11, worn: 'aujourd’hui', wornToday: true },
  { id: 'p3', name: 'Chemise blanche', category: 'Hauts', url: null, wearCount: 4, worn: 'il y a 9 j', wornToday: false },
  { id: 'p4', name: 'Robe nuit', category: 'Robes', url: null, wearCount: 0, worn: null, wornToday: false },
  { id: 'p5', name: 'Trench beige', category: 'Vestes et manteaux', url: null, wearCount: 0, worn: null, wornToday: false },
  { id: 'p6', name: 'Escarpins noirs', category: 'Chaussures', url: null, wearCount: 2, worn: 'il y a 2 mois', wornToday: false },
];

const SCREENS = ['accueil', 'dressing', 'kodi', 'calendrier', 'profil'] as const;
const ROUTE: Record<(typeof SCREENS)[number], string> = {
  accueil: '/accueil', dressing: '/dressing', kodi: '/kodi', calendrier: '/calendrier', profil: '/moi',
};

export default async function Apercu({ searchParams }: { searchParams: Promise<{ ecran?: string; vide?: string }> }) {
  if (process.env.DRESSY_APERCU !== '1') notFound();
  const { ecran, vide } = await searchParams;
  const screen = (SCREENS as readonly string[]).includes(ecran ?? '') ? (ecran as (typeof SCREENS)[number]) : 'accueil';
  const empty = vide === '1';
  const pieces = empty ? [] : PIECES;
  const [theme, shortcut] = await Promise.all([getTheme(), getThemeShortcut()]);

  const usage = {
    total: pieces.length ? 29 : 0,
    worn: pieces.length ? 18 : 0,
    pct: pieces.length ? 62 : 0,
    windowDays: 90,
    categories: pieces.length
      ? [
          { id: 'hauts', label: 'Hauts', total: 9, worn: 7, pct: 78 },
          { id: 'bas', label: 'Bas', total: 6, worn: 5, pct: 83 },
          { id: 'robes', label: 'Robes', total: 4, worn: 1, pct: 25 },
          { id: 'vestes', label: 'Vestes et manteaux', total: 5, worn: 3, pct: 60 },
          { id: 'chaussures', label: 'Chaussures', total: 5, worn: 2, pct: 40 },
        ]
      : [],
  };

  return (
    <>
      {screen === 'accueil' ? (
        <HomeScreen
          data={{
            name: 'Camille', avatarUrl: null, hour: 9, total: usage.total, worn: usage.worn, pct: usage.pct,
            asleep: pieces.length ? 11 : 0, recent: pieces, plan: 'decouverte',
          }}
        />
      ) : null}

      {screen === 'dressing' ? (
        <DressingScreen
          data={{
            spaceName: 'Mon dressing', q: '', cat: null,
            categories: pieces.length
              ? [
                  { id: 'hauts', label: 'Hauts', count: 9 }, { id: 'bas', label: 'Bas', count: 6 },
                  { id: 'robes', label: 'Robes', count: 4 }, { id: 'vestes', label: 'Vestes et manteaux', count: 5 },
                  { id: 'chaussures', label: 'Chaussures', count: 5 },
                ]
              : [],
            pieces, totalPieces: usage.total, usage, jobs: [], sent: 0,
          }}
        />
      ) : null}

      {screen === 'kodi' ? (
        <KodiScreen data={{ name: 'Camille', total: usage.total, pct: usage.pct, styles: ['Minimal', 'Chic'] }} />
      ) : null}

      {screen === 'calendrier' ? (
        <CalendarScreen
          data={{
            selected: '2026-10-21', today: '2026-10-21',
            week: ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((letter, i) => ({
              date: `2026-10-${String(19 + i).padStart(2, '0')}`, letter, day: 19 + i, busy: i === 2 || i === 4,
              full: `${19 + i} octobre`,
            })),
            month: 'Octobre', prevMonth: 'Septembre', nextMonth: 'Novembre',
            prevWeek: '2026-10-14', nextWeek: '2026-10-28', dayLabel: 'Mercredi 21 octobre',
            items: empty
              ? []
              : [
                  { id: 'o', kind: 'outfit', title: 'Blazer noir, jean brut, escarpins', time: null, note: 'Proposée par Kodi ce matin', worn: false },
                  { id: 'e1', kind: 'event', title: 'Réunion d’équipe', time: '9 h 30', note: 'Tenue : smart casual' },
                  { id: 'e2', kind: 'event', title: 'Dîner chez Léa', time: '20 h', note: null },
                ],
          }}
        />
      ) : null}

      {screen === 'profil' ? (
        <ProfileScreen
          data={{
            name: 'Camille Martin', email: 'camille@exemple.fr', avatarUrl: null, since: '2026-09-19T10:00:00Z',
            total: usage.total, pct: usage.pct, plan: 'decouverte', renews: null,
            style: [
              { key: 'styles', icon: 'star', label: 'Mon style', values: ['Minimal', 'Chic'] },
              { key: 'colours', icon: 'palette', label: 'Mes couleurs', values: ['Noir', 'Crème', 'Bleu marine'], swatches: ['#0D0D0E', '#F0E9DC', '#26334D'] },
              { key: 'items', icon: 'shirt', label: 'Ce que je porte', values: ['Chemises', 'Jeans', 'Vestes'] },
              { key: 'occasions', icon: 'party', label: 'Mes occasions', values: ['Le travail', 'Les sorties'] },
              { key: 'avoid', icon: 'eyeOff', label: 'Ce que j’évite', values: ['Les imprimés'] },
              { key: 'rythme', icon: 'clock', label: 'Mon rythme', values: ['5 à 15 minutes'] },
              { key: 'goals', icon: 'target', label: 'Mes objectifs', values: [] },
            ],
            theme, shortcut, spaceName: 'Mon dressing', dressingView: 'portants',
          }}
        />
      ) : null}

      <nav
        aria-label="Aperçu"
        style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 6px)', left: 12, zIndex: 44, display: 'flex', gap: 6 }}
      >
        <Link href={`/apercu?ecran=${screen}${empty ? '' : '&vide=1'}`} className="dk-chip" style={{ minHeight: 28, fontSize: 11.5, padding: '0 10px' }}>
          {empty ? 'Rempli' : 'Vide'}
        </Link>
      </nav>

      <TabBar active={ROUTE[screen]} preview />
    </>
  );
}
