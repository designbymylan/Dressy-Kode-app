import Link from 'next/link';
import type { Home } from '@/lib/accueil';
import { parisDateLabel } from '@/lib/dates';
import { tendancesChezToi } from '@/lib/contexte';
import { canCompose, missingForOutfit, sleeping } from '@/lib/outfits';
import { HomeToday } from '@/components/HomeToday';
import { HomeWeek } from '@/components/HomeWeek';
import { HomeKodi, Sleeping, Trend } from '@/components/HomeSections';
import { WeatherIcon } from '@/components/WeatherIcon';
import { Icon } from '@/components/icons';
import { Screen, Card } from '@/components/ui';

const WORD = { soleil: 'soleil', nuages: 'nuageux', pluie: 'pluie', averses: 'averses' } as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * L'accueil tel qu'il s'affiche, une fois les données lues (app/(app)/accueil
 * les lit, la planche /apercu/accueil les invente) : le salut, la tenue du
 * jour de la tête aux pieds, la semaine avec sa météo et ses tenues prévues,
 * la question à Kodi, les pièces à redécouvrir, la tendance. Une débutante
 * (aucune tenue possible) ne voit que son premier pas ; les sections
 * reviennent dès la première tenue.
 */
export function HomeView({ home, name }: { home: Home; name: string | null }) {
  const { pieces, outfits, worn, now, city, hasCity, eventsToday, week, trip, contexte } = home;
  const n = pieces.length;
  const ready = outfits.length > 0;
  const missing = missingForOutfit(pieces);

  const meteoTxt = now ? `${now.t}°, ${now.mot ?? WORD[now.kind]}` : null;
  const dateLine = [parisDateLabel(), city].filter(Boolean).join(' · ');

  // Les questions toutes prêtes, selon la journée.
  const tomorrow = week[1]?.event;
  const asks = [
    tomorrow ? `${cap(lcFirst(tomorrow))}, demain` : 'Une tenue pour demain',
    home.occasions.includes('travail') ? 'Tenue de bureau' : 'Une tenue pour ce soir',
    n >= 8 ? 'Ce que je ne porte jamais' : pieces.some((p) => p.kind === 'jean') ? 'Ce qui va avec mon jean' : 'Une tenue pour le week-end',
  ];

  const trend = tendancesChezToi(contexte, pieces)[0] ?? null;

  return (
    <Screen className="home">
      {/* Le salut : la date et la ville, une phrase fine, la météo et la journée en puces. */}
      <header className="home-hello rise" data-testid="home-hello">
        <p className="eyebrow">{dateLine}</p>
        <h1 className="home-hero">
          Bonjour{name ? ` ${name}` : ''},<br />
          {ready ? (
            <>ta tenue du jour<br />est <b>{worn ? 'portée' : 'prête'}</b>.</>
          ) : (
            <>ton dressing<br />t’attend.</>
          )}
        </h1>
        {meteoTxt || eventsToday > 0 || !hasCity ? (
          <div className="home-chips">
            {meteoTxt && now ? (
              <span className="home-chip">
                <WeatherIcon kind={now.kind} size={15} />
                {meteoTxt}
              </span>
            ) : null}
            {/* Sans ville, pas de météo : les tenues ne savent pas s'il faut une veste. Un geste pour la donner. */}
            {!meteoTxt && !hasCity ? (
              <Link href="/moi#ville" className="home-chip">
                <Icon name="cloud" size={15} />
                Ajoute ta ville pour la météo
              </Link>
            ) : null}
            {eventsToday > 0 ? (
              <Link href="/calendrier" className="home-chip" aria-label={`${eventsToday} rendez-vous aujourd’hui`}>
                <Icon name="calendar" size={15} />
                {`${eventsToday} rendez-vous`}
              </Link>
            ) : null}
          </div>
        ) : null}
      </header>

      {n === 0 ? (
        <Card center i={1}>
          <h2 style={{ fontSize: 22 }}>On commence par <em className="accent">tes vêtements</em></h2>
          <p className="lead small">
            Ton espace est prêt et il est vide : rien n&apos;y est ajouté sans toi.
            Dès que deux ou trois pièces y seront, Kodi pourra composer une tenue
            avec ce que tu as déjà.
          </p>
          <Link href="/dressing/ajouter" className="btn btn-primary btn-block">
            Ajouter ma première pièce
          </Link>
        </Card>
      ) : !canCompose(pieces) ? (
        <Card center i={1}>
          <h2 style={{ fontSize: 22 }}>Tes <em className="accent">premiers pas</em></h2>
          <p className="lead small">
            {n} pièce{n > 1 ? 's' : ''} dans ton dressing. Il manque {missing} pour ta première tenue.
          </p>
          <Link href="/dressing/ajouter" className="btn btn-primary btn-block">Ajouter la pièce qui manque</Link>
        </Card>
      ) : (
        <>
          <HomeToday pieces={pieces} outfits={outfits} worn={worn} />

          <HomeWeek
            week={week}
            trip={trip}
            todayReady={ready || worn}
            canFill
          />

          <HomeKodi asks={asks} i={3} />
          <Sleeping list={sleeping(pieces).slice(0, 3)} i={4} />
          <Trend
            trend={trend?.t ?? null}
            owned={trend?.pieces ?? []}
            i={5}
          />
        </>
      )}
    </Screen>
  );
}

