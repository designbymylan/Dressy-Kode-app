import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { DAYS_LETTER, MONTHS, dayDate, longDate, relativeDay, shortDate, type Piece } from '../data/wardrobe';
import { canCompose } from '../state/outfits';
import { Toggle } from '../ui/controls';
import { eventsOf, useMeteo, useStore, useTodayOutfits } from '../state/store';
import { ferieDu, periode, pontDu, vacancesDu } from '../state/contexte';
import { Credit } from '../ui/Credit';
import { useTheme } from '../theme/ThemeProvider';
import { space, TAB_CLEARANCE } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { ScrollEdge, TabHeader, useTabScroll, useTabTop } from '../ui/layout';
import { Badge, Card, Tag, WeatherIcon } from '../ui/bits';
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
  const top = useTabTop();

  useEffect(() => {
    if (route.params?.day !== undefined) setDay(route.params.day);
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
  const all = eventsOf(s.profile);
  const events = all.filter((e) => e.day === day);
  const outfits = useTodayOutfits();
  const ready = canCompose(s.pieces);
  const todayOutfit = day === 0 && s.wornToday ? { title: 'Portée aujourd’hui', pieces: s.wornToday } : null;
  const proposed = day === 0 && outfits.length ? { title: 'Tenue du jour, proposée par Kode', pieces: outfits[s.outfitIndex % outfits.length].pieces } : null;
  const planned = todayOutfit ?? s.planned[day] ?? proposed;
  const pieces = planned ? (planned.pieces.map((id) => byId.get(id)).filter(Boolean) as Piece[]) : [];
  const later = all.filter((e) => e.day > day).slice(0, 4);
  const first = dayDate(0);
  const last = dayDate(13);
  const range = first.getMonth() === last.getMonth() ? MONTHS[first.getMonth()] : `${MONTHS[first.getMonth()]} – ${MONTHS[last.getMonth()]}`;

  return (
    <View style={{ flex: 1 }} className="bg-paper">
      <Ambient />
    <ScrollEdge y={edge} />
    <TabHeader title="Agenda" meta={cap(range)} />
    <Animated.ScrollView testID="screen-agenda" onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingBottom: TAB_CLEARANCE + insets.bottom, gap: 16 }}>
      <View style={{ paddingHorizontal: space.gutter }}>
        <T v="title" accessibilityRole="header">
          {relativeDay(day)}
        </T>
      </View>

      <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 6 }}>
        {Array.from({ length: 14 }, (_, i) => {
          const d = dayDate(i);
          const on = i === day;
          const ferieI = ferieDu(ctx, i);
          const busy = all.some((e) => e.day === i) || !!ferieI;
          return (
            <Tap key={i} testID={`agenda-day-${i}`} onPress={() => setDay(i)} feedback="select" accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${cap(longDate(i))}${ferieI ? `, férié, ${ferieI.nom}` : busy ? ', un événement' : ''}`} style={{ backgroundColor: on ? c['primary-bg'] : c.pill, width: 50, height: 92, justifyContent: 'center', borderRadius: 22, alignItems: 'center', gap: 4 }}>
              <T v="kicker" tone={on ? 'primary-fg' : 'ink'}>
                {DAYS_LETTER[d.getDay()]}
              </T>
              <T v="bodyStrong" tone={on ? 'primary-fg' : 'ink'} style={{ fontSize: 17 }}>
                {d.getDate()}
              </T>
              {meteo.jours[i] ? <WeatherIcon w={meteo.jours[i]!} size={16} color={on ? c['primary-fg'] : c.ink} /> : <View style={{ height: 16 }} />}
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: busy ? (on ? c['primary-fg'] : c.ink) : 'transparent' }} />
            </Tap>
          );
        })}
      </Animated.ScrollView>

      <Animated.View key={day} entering={FadeIn.duration(220)} style={{ paddingHorizontal: space.gutter, gap: 18 }}>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          {w ? <WeatherIcon w={w} size={24} color={c.ink} /> : <Icon name="calendar" size={24} color={c.ink} />}
          <T v="bodyL">
            {cap(longDate(day))}
            {w ? ` · ${w.t}°, ${w.label}` : ''}
          </T>
        </View>
        <View style={{ marginTop: -12, marginLeft: 34, gap: 2 }}>
          {prevision && (
            <T v="caption" tone="ink2">
              {prevision}
            </T>
          )}
          {notes.map((n) => (
            <T key={n} v="caption" tone="ink2">
              {n}
            </T>
          ))}
          {meteo.reelle && <Credit blocs={[s.contexte?.meteo, ferie || pont ? s.contexte?.feries : null, vacances ? s.contexte?.vacances : null, fete ? s.contexte?.fete : null, soleil ? s.contexte?.soleil : null, airNote ? s.contexte?.air : null]} style={{ marginTop: 4 }} />}
        </View>

        <View style={{ gap: 0 }}>
          {!s.profile.agenda ? (
            <Card className="flex-row items-center" style={{ gap: 14 }} testID="agenda-link">
              <Icon name="calendar" size={24} color={c.ink} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="bodyStrong">Relier ton agenda</T>
                <T v="caption" tone="ink2">
                  Kode prépare les jours chargés.
                </T>
              </View>
              <Toggle testID="agenda-link-toggle" value={false} onChange={() => { a.setProfile({ agenda: true }); a.toast('Agenda relié'); }} label="Relier mon agenda" />
            </Card>
          ) : events.length === 0 ? (
            <T v="body" tone="ink2">
              Aucun événement ce jour-là.
            </T>
          ) : (
            events.map((e) => (
              <Tap key={e.id} testID={`event-${e.id}`} disabled={!e.occasion} onPress={() => nav.navigate('Event', { id: e.id })} scaleTo={e.occasion ? 0.99 : 1} feedback={e.occasion ? 'light' : 'none'} accessibilityRole={e.occasion ? 'button' : 'text'} accessibilityLabel={`${e.time}, ${e.title}${e.place ? `, ${e.place}` : ''}`} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 14, borderBottomWidth: 1, borderColor: c.rule }}>
                <T v="numeral" tone="brass" style={{ width: 62, fontSize: 18 }}>
                  {e.time}
                </T>
                <View style={{ flex: 1, gap: 2, paddingVertical: 8 }}>
                  <T v="bodyStrong">{e.title}</T>
                  {e.place && (
                    <T v="caption" tone="ink2">
                      {e.place}
                    </T>
                  )}
                  {e.occasion && <Badge label={`Occasion · ${e.occasion.dressCode}`} tone="neutral" icon="gift" />}
                </View>
                {e.occasion && <Icon name="chevron" size={18} color={c.ink2} />}
              </Tap>
            ))
          )}
        </View>

        {planned && pieces.length ? (
          <Card style={{ gap: 12, padding: 14 }} testID="agenda-planned">
            <View className="flex-row items-center justify-between">
              <Tag label={todayOutfit ? 'Portée' : s.planned[day] ? 'Prévue' : 'Proposée'} />
              {s.planned[day] && !todayOutfit && (
                <T testID="agenda-unplan" v="caption" tone="ink2" onPress={() => a.unplan(day)} accessibilityRole="button" style={{ paddingVertical: 10, paddingLeft: 10 }}>
                  Retirer
                </T>
              )}
            </View>
            <View style={{ backgroundColor: c.stage, borderRadius: 22, padding: 12 }}>
              <OutfitBoard pieces={pieces} width={width - space.gutter * 2 - 28 - 24} numbered={false} onPiece={(p) => nav.navigate('Piece', { id: p.id })} />
            </View>
            <T v="cardTitle" style={{ paddingHorizontal: 4 }}>{planned.title}</T>
            {!todayOutfit && <Button testID="agenda-change" label="Changer la tenue" variant="quiet" size="m" icon="layers" onPress={() => nav.navigate('Compose', { day, pieces: planned.pieces })} />}
          </Card>
        ) : (
          <Card style={{ gap: 12, padding: 14 }} testID="agenda-empty">
            {!ready ? (
              <>
                <Tag label="Pas encore de tenue" />
                <T v="body" tone="ink2">
                  Dès trois pièces, Kode prépare chaque jour.
                </T>
                <Button testID="agenda-add" label="Ajouter des pièces" size="m" icon="plus" onPress={() => nav.navigate('AddPiece')} />
              </>
            ) : (
            <>
            <Tag label="Rien de prévu" />
            <T v="body" tone="ink2">
              {events.length ? `Tu pourrais préparer « ${events[0].title} ».` : 'Tu pourrais préparer ta tenue la veille.'}
            </T>
            <View className="flex-row" style={{ gap: 8 }}>
              <Button testID="agenda-compose" label="Composer" size="m" grow onPress={() => nav.navigate('Compose', { day })} />
              <Button testID="agenda-ask" label="Demander à Kode" size="m" variant="secondary" grow onPress={() => nav.navigate('Tabs', { screen: 'Kode', params: { ask: events[0] ? `Une tenue pour « ${events[0].title} »` : `Une tenue pour ${relativeDay(day).toLowerCase()}`, nonce: Date.now() } })} />
            </View>
            </>
            )}
          </Card>
        )}

        {later.length > 0 && (
          <Card style={{ gap: 4, padding: 14 }}>
            <Tag label="À venir" />
            {later.map((e) => (
              <Tap key={e.id} testID={`later-${e.id}`} onPress={() => (e.occasion ? nav.navigate('Event', { id: e.id }) : setDay(e.day))} scaleTo={0.99} accessibilityLabel={`${shortDate(e.day)}, ${e.title}`} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 14, borderBottomWidth: 1, borderColor: c.rule }}>
                <T v="caption" tone="ink2" style={{ width: 86 }}>
                  {cap(shortDate(e.day))}
                </T>
                <T v="body" style={{ flex: 1 }} numberOfLines={1}>
                  {e.title}
                </T>
                {e.occasion && <Icon name="gift" size={18} color={c.brass} />}
                <Icon name="chevron" size={16} color={c.ink2} />
              </Tap>
            ))}
          </Card>
        )}
      </Animated.View>
    </Animated.ScrollView>
    </View>
  );
}
