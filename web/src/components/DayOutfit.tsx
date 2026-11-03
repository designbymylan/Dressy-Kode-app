'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { listSavedOutfits, planDay, planWithKodi, unplanDay } from '@/app/actions';
import type { PlannedDay } from '@/lib/agenda';
import type { OutfitView } from '@/lib/kode';
import { cap, relativeDay, type Iso } from '@/lib/planning';
import { Garment, SHAPE_BY_CATEGORY } from '@/components/garments';
import { Icon } from '@/components/icons';
import { KodeThinking } from '@/components/KodeThinking';
import { OutfitCard } from '@/components/OutfitCard';
import { Sheet } from '@/components/Sheet';

/**
 * La tenue du jour ouvert. Prévue ou portée : on la voit, on la change (une
 * tenue enregistrée, une nouvelle, ou Kodi) ou on la retire. Pas encore de
 * tenue : trois façons d'en avoir une. C'est ce qui permet de prévoir ses
 * tenues, jour après jour.
 */
export function DayOutfit({
  day,
  today,
  planned,
  ready,
  eventTitle,
}: {
  day: Iso;
  today: Iso;
  planned: PlannedDay | null;
  /** Un haut et un bas, ou une robe : de quoi composer. */
  ready: boolean;
  /** Le premier rendez-vous du jour, pour dire à quoi la tenue pourrait servir. */
  eventTitle: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const future = day >= today;

  function ask() {
    start(async () => {
      setError(null);
      const res = await planWithKodi({ days: [day] });
      if ('error' in res) return setError(res.error);
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      setError(null);
      const res = await unplanDay(day);
      if ('error' in res) return setError(res.error);
      router.refresh();
    });
  }

  if (planned) {
    const changeable = future && !planned.worn;
    return (
      <section className="day-outfit rise" style={{ '--i': 3 } as CSSProperties} aria-label="La tenue du jour">
        <div className="day-outfit__head">
          <h2 className="home-tag">{planned.worn ? 'Portée' : 'Prévue'}</h2>
          {changeable ? (
            <button type="button" className="home-label-btn" style={{ paddingRight: 0 }} onClick={remove} disabled={pending}>Retirer</button>
          ) : null}
        </div>
        <OutfitCard outfit={{ id: planned.outfit.id, title: planned.outfit.title, why: '', pieces: planned.outfit.pieces }}>
          {changeable ? (
            <button type="button" className="btn btn-glass btn-block" onClick={() => setPick(true)} disabled={pending} aria-haspopup="dialog">
              <Icon name="layers" size={18} /> Changer la tenue
            </button>
          ) : null}
        </OutfitCard>
        {error ? <p role="alert" style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</p> : null}
        {pick ? <PickOutfit day={day} today={today} onClose={() => setPick(false)} /> : null}
      </section>
    );
  }

  if (!future) return null;

  return (
    <section className="glass card day-outfit-empty rise" style={{ '--i': 3 } as CSSProperties} aria-label="La tenue du jour">
      <h2 className="home-tag">Pas encore de tenue</h2>
      {!ready ? (
        <>
          <p className="small muted" style={{ fontSize: 14 }}>Dès trois pièces, Kodi prépare chaque jour.</p>
          <Link href="/dressing/ajouter" className="btn btn-primary btn-block"><Icon name="plus" size={18} /> Ajouter des pièces</Link>
        </>
      ) : (
        <>
          <p className="small muted" style={{ fontSize: 14 }}>
            {eventTitle ? `Tu pourrais préparer « ${eventTitle} ».` : `Tu pourrais préparer ta tenue pour ${relativeDay(day, today)}.`}
          </p>
          {pending ? (
            <KodeThinking phrases={['Kodi lit tes rendez-vous', 'Kodi regarde la météo', 'Kodi compose ta tenue']} />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <Link href={`/tenues/nouvelle?jour=${day}`} className="btn btn-primary btn-block"><Icon name="layers" size={18} /> Composer</Link>
              <button type="button" className="btn btn-glass btn-block" onClick={ask}><Icon name="sparkle" size={18} /> Demander à Kodi</button>
              <button type="button" className="btn btn-ghost" onClick={() => setPick(true)} aria-haspopup="dialog">Une tenue enregistrée</button>
            </div>
          )}
        </>
      )}
      {error ? <p role="alert" style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</p> : null}
      {pick ? <PickOutfit day={day} today={today} onClose={() => setPick(false)} /> : null}
    </section>
  );
}

/** Une pièce en miniature : sa vignette, ou la silhouette de sa catégorie. */
function Mini({ p }: { p: OutfitView['pieces'][number] }) {
  return (
    <span className="pick-mini">
      {p.url ? <img src={p.url} alt="" loading="lazy" decoding="async" /> : <Garment shape={SHAPE_BY_CATEGORY[p.category] ?? 'tshirt'} size={34} fill={p.colour ?? 'var(--tile-2)'} stroke="var(--stage-line)" />}
    </span>
  );
}

/** « Changer la tenue » : les tenues déjà enregistrées, ou une nouvelle à composer pour ce jour. */
function PickOutfit({ day, today, onClose }: { day: Iso; today: Iso; onClose: () => void }) {
  const router = useRouter();
  const [outfits, setOutfits] = useState<OutfitView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    listSavedOutfits()
      .then((res) => {
        if (!alive) return;
        if ('error' in res) setError(res.error);
        else setOutfits(res.outfits);
      })
      .catch(() => alive && setError('Tes tenues n’ont pas pu être lues. Réessaie dans un instant.'));
    return () => {
      alive = false;
    };
  }, []);

  function choose(id: string) {
    start(async () => {
      setError(null);
      const res = await planDay({ day, outfitId: id });
      if ('error' in res) return setError(res.error);
      onClose();
      router.refresh();
    });
  }

  return (
    <Sheet kicker={cap(relativeDay(day, today))} title="Quelle tenue ?" onClose={onClose}>
      {outfits === null && !error ? (
        <KodeThinking phrases={['Kodi sort tes tenues']} />
      ) : outfits && outfits.length === 0 ? (
        <p className="small muted" style={{ fontSize: 14 }}>Tu n’as pas encore enregistré de tenue. Compose la première pour ce jour.</p>
      ) : (
        <ul className="pick-list">
          {(outfits ?? []).map((o) => (
            <li key={o.id}>
              <button type="button" className="pick-outfit" onClick={() => choose(o.id)} disabled={pending}>
                <span className="pick-outfit__minis">{o.pieces.slice(0, 4).map((p) => <Mini key={p.id} p={p} />)}</span>
                <span className="pick-outfit__text">
                  <strong>{o.title}</strong>
                  <span>{o.pieces.map((p) => p.name).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p role="alert" className="note note-error">{error}</p> : null}
      <Link href={`/tenues/nouvelle?jour=${day}`} className="btn btn-primary btn-block"><Icon name="layers" size={18} /> Composer une nouvelle tenue</Link>
    </Sheet>
  );
}
