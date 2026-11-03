import { notFound } from 'next/navigation';
import { agendaParams, type Agenda } from '@/lib/agenda';
import { semaine } from '@/lib/contexte';
import { parisDay } from '@/lib/dates';
import type { RdvEvent } from '@/lib/planning';
import { CalendarView } from '@/components/CalendarView';
import { TabBar } from '@/components/TabBar';
import { PIECES, contexteFictif, outfit } from '../fixtures';

/**
 * Planche du calendrier, sans compte ni base : le même CalendarView que
 * /calendrier, nourri de données inventées (le compte d'Alice). Elle suit
 * les mêmes paramètres que la vraie page (?jour=, ?vue=mois, ?mois=). Fermée
 * par défaut : elle ne s'ouvre qu'avec DRESSY_APERCU=1 dans l'environnement
 * du serveur.
 *
 *   ?etat=vide    rien de prévu, de quoi composer
 *   ?etat=debut   pas assez de pièces pour une tenue
 *   (sans)        le calendrier d'Alice
 */
export const dynamic = 'force-dynamic';

const event = (id: string, offset: number, time: string | null, title: string, more: Partial<RdvEvent> = {}): RdvEvent => ({
  id, date: parisDay(offset), time, title, kind: null, dressCode: null, stake: null, impressions: [], place: null, setting: null, constraints: [], note: null, ...more,
});

export default async function ApercuCalendrier({ searchParams }: { searchParams: Promise<{ etat?: string; jour?: string; vue?: string; mois?: string }> }) {
  if (process.env.DRESSY_APERCU !== '1') notFound();
  const { etat, ...raw } = await searchParams;
  const today = parisDay(0);
  const { day, vue, month } = agendaParams(raw, today);
  const contexte = contexteFictif();
  const vide = etat === 'vide';

  const events = vide ? [] : [
    event('e1', 0, '10:00', 'Réunion client', { kind: 'Rendez-vous client', dressCode: 'Business', place: 'Bureau', stake: 'Important' }),
    event('e2', 1, '20:00', 'Dîner chez Léa', { kind: 'Rendez-vous entre amis', dressCode: 'Casual chic', place: 'Chez Léa' }),
    event('e3', 3, '18:30', 'Yoga', { kind: 'Sport' }),
    event('e4', 4, '09:30', 'Présentation trimestrielle', { kind: 'Présentation', dressCode: 'Business', stake: 'Décisif' }),
    event('e5', 9, null, 'Mariage de Juliette et Tom', { kind: 'Mariage (invité)', dressCode: 'Chic', stake: 'Important' }),
  ];

  const a: Agenda = {
    today,
    day,
    vue,
    month,
    weather: semaine(contexte),
    contexte,
    planned: vide ? {} : {
      [parisDay(-2)]: { worn: true, outfit: outfit(['h1', 'b1', 'c1'], 'Décontractée, sans effort') },
      [parisDay(1)]: { worn: false, outfit: outfit(['m6', 'r3', 'c5'], 'Noir sur noir, mais doux') },
      [parisDay(4)]: { worn: false, outfit: outfit(['h1', 'b2', 'c1', 'a1'], 'Net, sans raideur') },
    },
    events,
    later: events.filter((e) => e.date > day).slice(0, 5),
    trips: vide ? [] : [{ id: 't1', destination: 'Lisbonne', starts_on: parisDay(16), ends_on: parisDay(20), purpose: 'Plaisir' }],
    ready: etat !== 'debut',
    pieces: etat === 'debut' ? 3 : PIECES.length,
  };

  return (
    <>
      <CalendarView a={a} base="/apercu/calendrier" />
      <TabBar active="/calendrier" />
    </>
  );
}
