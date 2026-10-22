import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { DAYS_LETTER, MONTHS, dayDate, longDate, relativeDay, type Piece } from '../data/wardrobe';
import { dayName, isoOf, offsetOf, timeLabel, type RdvEvent } from '../state/planning';
import { canCompose } from '../state/outfits';
import { eventsOn, useMeteo, useStore, useTodayOutfits } from '../state/store';
import { ferieDu, periode, pontDu, vacancesDu } from '../state/contexte';
import { Credit } from '../ui/Credit';
import { useTheme } from '../theme/ThemeProvider';
import { space, TAB_CLEARANCE } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button, IconButton } from '../ui/Button';
import { F } from '../theme/fonts';
import { ScrollEdge, TabHeader, useTabScroll, useTabTop } from '../ui/layout';
import { Badge, Card, DotChip, Tag, WeatherIcon } from '../ui/bits';
import { OutfitBoard } from '../ui/outfit';
import { Icon } from '../ui/Icon';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import type { Nav, Route } from '../navigation/types';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function Agenda() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route<'Agenda'>>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { width } = useScreen();
  const edge = useSharedValue(0);
  const onScroll = useTabScroll(edge);
  const [day, setDay] = useState(0);
  const [week, setWeek] = useState(0);
  const top = useTabTop();

  useEffect(() => {
    if (route.params?.day !== undefined) {
      setDay(route.params.day);
      setWeek(Math.floor(route.params.day / 7));
    }
  }, [route.params]);

  const byId = new Map(s.pieces.map((p) => [p.id, p]));
  const meteo = useMeteo();
  const w = meteo.jours[day];
  const ctx = meteo.reelle ? s.contexte : null;
  const ferie = ferieDu(ctx, day);
  const vacances = vacancesDu(ctx, day);
  const pont = pontDu(ctx, day);
  const fete = day === 0 ? ctx?.fete.valeur : null;
  const soleil = day === 0 ? ctx?.soleil.valeur : null;
  const air = day === 0 ? ctx?.air.valeur : null;
  const hhmm = (x: string) => `${Number(x.slice(0, 2))}\u00a0h\u00a0${x.slice(3, 5)}`;
  const airNote = air && (air.pollens.length || (air.indice ?? 0) > 40)
    ? [air.qualite && `Qualité de l’air ${air.qualite}`, air.pollens.length ? `pollens : ${air.pollens.map((x) => x.nom).join(', ')}` : null].filter(Boolean).join(' · ')
    : null;
  const prevision = w ? `${w.low}° le soir` : meteo.reelle && s.contexte?.meteo.valeur ? 'Pas encore de prévision pour ce jour.' : null;
  // Ce que l'on sait de ce jour, en lignes courtes sous la météo.
  const notes = [
    ferie && `Jour férié : ${ferie.nom}`,
    pont && `Long week-end ${periode(pont.debut, pont.fin)}${pont.aPoser ? `, ${pont.aPoser} jour à poser` : ''}`,
    vacances && `${vacances.nom} ${periode(vacances.debut, vacances.fin)}`,
    fete && `Bonne fête aux ${fete.prenoms}`,
    soleil && `Soleil de ${hhmm(soleil.lever)} à ${hhmm(soleil.coucher)}`,
    airNote,
  ].filter((x): x is string => !!x);
  const iso = isoOf(day);
  const events = eventsOn(s.events, iso);
  // Le mariage du compte de démonstration ouvre sa fiche Occasion (Pack Occasion) ; les autres, le formulaire.
  const occasion = (e: RdvEvent) => s.account === 'demo' && e.id === 'e5';
  const openEvent = (e: RdvEvent) => (occasion(e) ? nav.navigate('Event', { id: e.id }) : nav.navigate('EventEdit', { id: e.id }));
  const outfits = useTodayOutfits();
  const ready = canCompose(s.pieces);
  const todayOutfit = day === 0 && s.wornToday ? { title: 'Portée aujourd’hui', pieces: s.wornToday } : null;
  const proposed = day === 0 && outfits.length ? { title: 'Tenue du jour, proposée par Kodi', pieces: outfits[s.outfitIndex % outfits.length].pieces } : null;
  const planned = todayOutfit ?? s.planned[iso] ?? proposed;
  const pieces = planned ? (planned.pieces.map((id) => byId.get(id)).filter(Boolean) as Piece[]) : [];
  const later = s.events.filter((e) => e.date > iso).slice(0, 4);
  const first = dayDate(0);
  const last = dayDate(13);
  const range = first.getMonth() === last.getMonth() ? MONTHS[first.getMonth()] : `${MONTHS[first.getMonth()]} – ${MONTHS[last.getMonth()]}`;

  const W = width - space.gutter * 2;
  const col = Math.floor((W - 28 - 6 * 4) / 7);
  const from = week * 7;
  const monthOf = (() => {
    const x = dayDate(from);
    const z = dayDate(from + 6);
    return x.getMonth() === z.getMonth() ? MONTHS[x.getMonth()] : `${MONTHS[x.getMonth()]} · ${MONTHS[z.getMonth()]}`;
  })();
  const pick = (i: number) => {
    setDay(i);
    setWeek(Math.floor(i / 7));
  };

  return (
    <View style={{ flex: 1 }} className="bg-paper">
      <Ambient />
      <ScrollEdge y={edge} />
      <Animated.ScrollView testID="screen-agenda" onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: TAB_CLEARANCE + insets.bottom, gap: 12 }}>
        {/* Le calendrier, au centre de la page (06/10) : la semaine, sa météo et ses rendez-vous d'un coup d'œil. */}
        <Card style={{ padding: 14, gap: 14 }} testID="agenda-calendar">
          <View className="flex-row items-center justify-between">
            <T v="section" accessibilityRole="header">
              {monthOf}
            </T>
            <View className="flex-row" style={{ gap: 6 }}>
              <View style={{ opacity: week === 0 ? 0.35 : 1 }}>
                <IconButton testID="agenda-prev-week" icon="back" label="Semaine précédente" variant="quiet" size={40} onPress={() => setWeek(0)} />
              </View>
              <View style={{ opacity: week === 1 ? 0.35 : 1 }}>
                <IconButton testID="agenda-next-week" icon="chevron" label="Semaine suivante" variant="quiet" size={40} onPress={() => setWeek(1)} />
              </View>
            </View>
          </View>

          <Animated.View key={`w-${week}`} entering={FadeIn.duration(200)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {Array.from({ length: 7 }, (_, k) => {
              const i = from + k;
              const d = dayDate(i);
              const on = i === day;
              const today = i === 0;
              const wi = meteo.jours[i];
              const ferieI = ferieDu(ctx, i);
              const busy = eventsOn(s.events, isoOf(i)).length > 0 || !!ferieI || !!s.planned[isoOf(i)];
              const fg = on ? c['primary-fg'] : c.ink;
              return (
                <Tap
                  key={i}
                  testID={`agenda-day-${i}`}
                  onPress={() => setDay(i)}
                  feedback="select"
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${cap(longDate(i))}${wi ? `, ${wi.t} degrés, ${wi.label}` : ''}${ferieI ? `, férié, ${ferieI.nom}` : busy ? ', un rendez-vous' : ''}`}
                  style={{ width: col, height: 142, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: on ? c['primary-bg'] : c.pill, borderWidth: today && !on ? 1.5 : 0, borderColor: c.ink }}
                >
                  <T v="kicker" style={{ color: fg }}>
                    {DAYS_LETTER[d.getDay()]}
                  </T>
                  <T v="stat" style={{ fontSize: 24, lineHeight: 26, color: fg }}>
                    {String(d.getDate())}
                  </T>
                  {wi ? <WeatherIcon w={wi} size={19} color={fg} /> : <View style={{ height: 19 }} />}
                  <T v="caption" style={{ ...F.s600, color: fg }}>
                    {wi ? `${wi.t}°` : ' '}
                  </T>
                  <T v="kicker" tone={on ? 'primary-fg' : 'ink2'}>
                    {wi ? `${wi.low}°` : ' '}
                  </T>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: busy ? fg : 'transparent' }} />
                </Tap>
              );
            })}
          </Animated.View>

          {/* Le jour choisi, en une ligne et quelques puces. */}
          <Animated.View key={`d-${day}`} entering={FadeIn.duration(200)} style={{ borderTopWidth: 1, borderColor: c.rule, paddingTop: 12, gap: 8 }}>
            <View className="flex-row items-center" style={{ gap: 10 }}>
              {w ? <WeatherIcon w={w} size={22} color={c.ink} /> : <Icon name="calendar" size={22} color={c.ink} />}
              <T v="bodyStrong" style={{ flex: 1 }}>
                {cap(longDate(day))}
                {w ? ` · ${w.t}°, ${w.label}` : ''}
              </T>
            </View>
            {(prevision || notes.length > 0) && (
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {[prevision, ...notes].filter((x): x is string => !!x).map((n) => (
                  <DotChip key={n} label={n} />
                ))}
              </View>
            )}
            {meteo.reelle && <Credit blocs={[s.contexte?.meteo, ferie || pont ? s.contexte?.feries : null, vacances ? s.contexte?.vacances : null, fete ? s.contexte?.fete : null, soleil ? s.contexte?.soleil : null, airNote ? s.contexte?.air : null]} />}
          </Animated.View>
        </Card>

        {/* Ce jour-là : ses rendez-vous, qu'on ajoute ou corrige ici. */}
        <Card style={{ padding: 14, gap: 4 }} testID="agenda-events">
          <Tag label={events.length ? `${cap(relativeDay(day))} · ${events.length} rendez-vous` : `${cap(relativeDay(day))} · rien de prévu`} />
          {events.map((e) => (
            <Tap key={e.id} testID={`event-${e.id}`} onPress={() => openEvent(e)} scaleTo={0.99} accessibilityLabel={`${timeLabel(e.time) ?? 'Dans la journée'}, ${e.title}${e.place ? `, ${e.place}` : ''}`} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 14, borderBottomWidth: 1, borderColor: c.rule }}>
              <T v="bodyStrong" style={{ width: 62 }}>
                {timeLabel(e.time) ?? 'Journée'}
              </T>
              <View style={{ flex: 1, gap: 4, paddingVertical: 8 }}>
                <T v="bodyStrong">{e.title}</T>
                {(e.place || e.kind || e.dressCode) && (
                  <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                    {[e.kind, e.dressCode, e.place].filter((x): x is string => !!x).slice(0, 3).map((x) => (
                      <DotChip key={x} label={x} />
                    ))}
                  </View>
                )}
                {occasion(e) && <Badge label={`Occasion · ${e.dressCode ?? 'chic'}`} tone="neutral" icon="gift" />}
              </View>
              <Icon name="chevron" size={18} color={c.ink2} />
            </Tap>
          ))}
          <Button testID="agenda-add-event" label="Ajouter un rendez-vous" variant="plain" size="m" icon="plus" onPress={() => nav.navigate('EventEdit', { date: iso })} />
        </Card>

        {/* La tenue du jour choisi. */}
        {planned && pieces.length ? (
          <Card style={{ gap: 12, padding: 14 }} testID="agenda-planned">
            <View className="flex-row items-center justify-between">
              <Tag label={todayOutfit ? 'Portée' : s.planned[iso] ? 'Prévue' : 'Proposée'} />
              {s.planned[iso] && !todayOutfit && (
                <T testID="agenda-unplan" v="caption" tone="ink2" onPress={() => a.unplan(iso)} accessibilityRole="button" style={{ paddingVertical: 10, paddingLeft: 10 }}>
                  Retirer
                </T>
              )}
            </View>
            <View style={{ backgroundColor: c.stage, borderRadius: 22, padding: 12 }}>
              <OutfitBoard pieces={pieces} width={W - 28 - 24} numbered={false} onPiece={(p) => nav.navigate('Piece', { id: p.id })} />
            </View>
            <T v="cardTitle" style={{ paddingHorizontal: 4 }}>{planned.title}</T>
            {!todayOutfit && <Button testID="agenda-change" label="Changer la tenue" variant="quiet" size="m" icon="layers" onPress={() => nav.navigate('Compose', { date: iso, pieces: planned.pieces })} />}
          </Card>
        ) : (
          <Card style={{ gap: 12, padding: 14 }} testID="agenda-empty">
            {!ready ? (
              <>
                <Tag label="Pas encore de tenue" />
                <T v="body" tone="ink2">
                  Dès trois pièces, Kodi prépare chaque jour.
                </T>
                <Button testID="agenda-add" label="Ajouter des pièces" size="m" icon="plus" onPress={() => nav.navigate('AddPiece')} />
              </>
            ) : (
              <>
                <Tag label="Pas encore de tenue" />
                <T v="body" tone="ink2">
                  {events.length ? `Tu pourrais préparer « ${events[0].title} ».` : 'Tu pourrais préparer ta tenue la veille.'}
                </T>
                <View style={{ gap: 8 }}>
                  <Button testID="agenda-compose" label="Composer" icon="layers" onPress={() => nav.navigate('Compose', { date: iso })} />
                  <Button testID="agenda-ask" label="Demander à Kodi" variant="quiet" icon="kode" onPress={() => nav.navigate('Tabs', { screen: 'Kode', params: { ask: events[0] ? `Une tenue pour « ${events[0].title} »` : `Une tenue pour ${relativeDay(day).toLowerCase()}`, nonce: Date.now() } })} />
                </View>
              </>
            )}
          </Card>
        )}

        {later.length > 0 && (
          <Card style={{ gap: 4, padding: 14 }}>
            <Tag label="À venir" />
            {later.map((e, k) => (
              <Tap key={e.id} testID={`later-${e.id}`} onPress={() => (occasion(e) ? nav.navigate('Event', { id: e.id }) : offsetOf(e.date) < 14 ? pick(offsetOf(e.date)) : nav.navigate('Planning', { date: e.date }))} scaleTo={0.99} accessibilityLabel={`${dayName(e.date)}, ${e.title}`} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 14, borderBottomWidth: k === later.length - 1 ? 0 : 1, borderColor: c.rule }}>
                <T v="kicker" tone="ink2" style={{ width: 86 }}>
                  {dayName(e.date)}
                </T>
                <T v="body" style={{ flex: 1 }} numberOfLines={1}>
                  {e.title}
                </T>
                {occasion(e) && <Icon name="gift" size={18} color={c.ink} />}
                <Icon name="chevron" size={16} color={c.ink2} />
              </Tap>
            ))}
          </Card>
        )}
      </Animated.ScrollView>
      <TabHeader
        title="Agenda"
        meta={cap(relativeDay(day))}
        y={edge}
        actions={[
          ...(day !== 0 ? [{ icon: 'clock' as const, label: 'Revenir à aujourd’hui', onPress: () => pick(0), testID: 'agenda-today' }] : []),
          { icon: 'calendar' as const, label: 'Le mois et les voyages', onPress: () => nav.navigate('Planning', { date: iso }), testID: 'agenda-month' },
        ]}
      />
    </View>
  );
}
