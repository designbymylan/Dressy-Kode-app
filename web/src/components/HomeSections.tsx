import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Tendance } from '@/lib/contexte';
import type { HomePiece } from '@/lib/outfits';
import { Icon } from '@/components/icons';
import { PieceImage } from '@/components/HomeToday';

/**
 * Les sections de l'accueil sous « Ta semaine » : la bulle de Kodi, les
 * pièces à redécouvrir, la tendance du moment. Chacune a sa forme (arches,
 * page de magazine, bulle) ; elles gardent toutes leur place, en une ligne,
 * quand il n'y a rien à montrer.
 */

/** Une section sans rien à montrer reste à sa place : on voit qu'elle est là et où. */
function Quiet({ title, text, i }: { title: string; text: string; i: number }) {
  return (
    <section className="glass card home-quiet rise" style={{ '--i': i } as CSSProperties}>
      <h2 className="home-tag">{title}</h2>
      <p className="small muted">{text}</p>
    </section>
  );
}

/**
 * Demande à Kodi : une bulle beurre, son coin bas presque droit. Le champ
 * emmène la question directement à Kodi, qui y répond dans la conversation ;
 * chaque suggestion est une question toute prête.
 */
export function HomeKodi({ asks, i }: { asks: string[]; i: number }) {
  return (
    <section className="home-kodi band rise" style={{ '--i': i } as CSSProperties} aria-labelledby="home-kodi-title">
      <h2 id="home-kodi-title">Demande à Kodi</h2>
      <form action="/kodi" method="get" className="home-kodi__form" role="search" aria-label="Poser une question à Kodi">
        <input name="q" type="text" maxLength={600} placeholder="Une tenue pour…" autoComplete="off" enterKeyHint="send" aria-label="Ta question pour Kodi" />
        <button type="submit" aria-label="Envoyer à Kodi"><Icon name="arrowUp" size={18} /></button>
      </form>
      <div className="home-kodi__asks">
        {asks.map((q) => (
          <Link key={q} href={`/kodi?q=${encodeURIComponent(q)}`} className="home-kodi__ask" aria-label={`Demander à Kodi : ${q}`}>
            {q}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** À redécouvrir : chaque pièce dans une arche, le nombre de jours en grand. */
export function Sleeping({ list, i }: { list: HomePiece[]; i: number }) {
  if (!list.length) return <Quiet title="À redécouvrir" text="Rien ne dort : tout ton dressing tourne." i={i} />;
  return (
    <section className="glass card home-sleeping rise" style={{ '--i': i } as CSSProperties} aria-labelledby="home-sleeping-title">
      <div className="home-sleeping__head">
        <h2 id="home-sleeping-title" className="home-tag">À redécouvrir</h2>
        <Link href="/dressing" className="home-link">Tout voir</Link>
      </div>
      <ul className="home-arches">
        {list.map((p) => {
          const days = p.lastWorn ?? p.addedDaysAgo;
          return (
            <li key={p.id}>
              <Link href="/dressing" className="arch" aria-label={`${p.name}, ${p.lastWorn === null ? `jamais portée, ajoutée il y a ${days} jours` : `portée il y a ${days} jours`}`}>
                <span className="arch__art"><PieceImage p={p} size={88} /></span>
                <span className="arch__days"><span className="stat">{days}</span> <span className="home-kicker">jours</span></span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Tendance : une page de magazine, le nom en grand, les pièces dans des ronds
 * qui se chevauchent. Seulement ce qui monte ET que le dressing a déjà :
 * pas besoin d'acheter.
 */
export function Trend({ trend, owned, credit, i }: { trend: Tendance | null; owned: HomePiece[]; credit: string | null; i: number }) {
  if (!trend || !owned.length) return <Quiet title="Tendance" text="Aucune tendance de la semaine dans ton dressing." i={i} />;
  const circles = owned.slice(0, 3);
  const n = owned.length;
  const line = trend.variation !== null ? `+${trend.variation} % cette semaine` : 'De saison';
  return (
    <section className="home-trend rise" style={{ '--i': i } as CSSProperties} aria-labelledby="home-trend-title">
      <p className="home-tag">Tendance</p>
      <h2 id="home-trend-title" className="home-trend__name">{trend.libelle}</h2>
      <p className="home-trend__line">{`${line} · ${n > 1 ? `${n} pièces chez toi` : 'une pièce chez toi'}`}</p>
      <div className="home-trend__circles" style={{ '--n': circles.length } as CSSProperties}>
        {circles.map((p, k) => (
          <Link key={p.id} href="/dressing" className="trend-circle" aria-label={p.name} style={{ '--k': k } as CSSProperties}>
            <PieceImage p={p} size={74} />
          </Link>
        ))}
        <Link href={`/tenues/nouvelle?avec=${owned[0].id}`} className="trend-compose" aria-label={`Composer une tenue : ${trend.libelle.toLowerCase()}`}>
          <Icon name="sparkle" size={22} />
        </Link>
      </div>
      {credit ? <p className="credit">{credit}</p> : null}
    </section>
  );
}
