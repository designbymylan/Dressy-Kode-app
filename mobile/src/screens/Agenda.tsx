import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { DAYS_LETTER, EVENTS, MONTHS, TODAY_OUTFITS, WEATHER, dayDate, longDate, relativeDay, shortDate, type Piece } from '../data/wardrobe';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space, TAB_CLEARANCE } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Masthead, Rule, ScrollEdge, useTabScroll } from '../ui/layout';
import { Badge, Card, WeatherIcon } from '../ui/bits';
import { OutfitBoard, Legend } from '../ui/outfit';
import { Icon } from '../ui/Icon';
import { useScreen } from '../ui/screen';
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

  useEffect(() => {
    if (route.params?.day !== undefined) setDay(route.params.day);
  }, [route.params]);

  const byId = new Map(s.pieces.map((p) => [p.id, p]));
  const w = WEATHER[day];
  const events = EVENTS.filter((e) => e.day === day);
  const todayOutfit = day === 0 && s.wornToday ? { title: 'Portée aujourd’hui', pieces: s.wornToday } : null;
  const planned = todayOutfit ?? s.planned[day] ?? (day === 0 ? { title: 'Tenue du jour, proposée par Kode', pieces: TODAY_OUTFITS[s.outfitIndex].pieces } : null);
  const pieces = planned ? (planned.pieces.map((id) => byId.get(id)).filter(Boolean) as Piece[]) : [];
  const later = EVENTS.filter((e) => e.day > day).slice(0, 4);
  const first = dayDate(0);
  const last = dayDate(13);
  const range = first.getMonth() === last.getMonth() ? MONTHS[first.getMonth()] : `${MONTHS[first.getMonth()]} – ${MONTHS[last.getMonth()]}`;

  return (
    <View style={{ flex: 1 }} className="bg-paper">
    <ScrollEdge y={edge} />
    <Animated.ScrollView testID="screen-agenda" onScroll={onScroll} scrollEventThrottle={16} className="bg-paper" contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: TAB_CLEARANCE + insets.bottom, gap: 18 }}>
      <View style={{ paddingHorizontal: space.gutter, gap: 12 }}>
        <Masthead kicker="L’AGENDA" meta={cap(range)} />
        <T v="title" accessibilityRole="header">
          {relativeDay(day)}
        </T>
      </View>

      <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 6 }}>
        {Array.from({ length: 14 }, (_, i) => {
          const d = dayDate(i);
          const on = i === day;
          const busy = EVENTS.some((e) => e.day === i);
          return (
            <Tap key={i} testID={`agenda-day-${i}`} onPress={() => setDay(i)} feedback="select" accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${cap(longDate(i))}${busy ? ', un événement' : ''}`} style={{ width: 50, paddingVertical: 10, borderRadius: 25, alignItems: 'center', gap: 4 }} className={on ? 'bg-primary-bg' : ''}>
              <T v="small" tone={on ? 'primary-fg' : 'ink2'}>
                {DAYS_LETTER[d.getDay()]}
              </T>
              <T v="bodyStrong" tone={on ? 'primary-fg' : 'ink'} style={{ fontSize: 17 }}>
                {d.getDate()}
              </T>
              <WeatherIcon w={WEATHER[i]} size={16} color={on ? c['primary-fg'] : c.ink2} />
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: busy ? (on ? c['primary-fg'] : c.brass) : 'transparent' }} />
            </Tap>
          );
        })}
      </Animated.ScrollView>

      <Animated.View key={day} entering={FadeIn.duration(220)} style={{ paddingHorizontal: space.gutter, gap: 18 }}>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <WeatherIcon w={w} size={24} color={c.ink} />
          <T v="bodyL">
            {cap(longDate(day))} · {w.t}°, {w.label}
          </T>
        </View>
        <T v="caption" tone="ink2" style={{ marginTop: -12, marginLeft: 34 }}>
          {w.low}° le soir
        </T>

        <View style={{ gap: 0 }}>
          {events.length === 0 ? (
            <T v="body" tone="ink2">
              Aucun événement ce jour-là.
            </T>
          ) : (
            events.map((e) => (
              <Tap key={e.id} testID={`event-${e.id}`} disabled={!e.occasion} onPress={() => nav.navigate('Event', { id: e.id })} scaleTo={e.occasion ? 0.99 : 1} feedback={e.occasion ? 'light' : 'none'} accessibilityRole={e.occasion ? 'button' : 'text'} accessibilityLabel={`${e.time}, ${e.title}${e.place ? `, ${e.place}` : ''}`} className="flex-row items-center" style={{ minHeight: 56, gap: 14, borderBottomWidth: 1, borderColor: c.rule }}>
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
          <Card style={{ gap: 12 }} testID="agenda-planned">
            <View className="flex-row items-center justify-between">
              <T v="kicker" tone={todayOutfit ? 'positive' : 'ink2'} upper>
                {todayOutfit ? 'Portée' : s.planned[day] ? 'Prévue' : 'Proposée'}
              </T>
              {s.planned[day] && !todayOutfit && (
                <T testID="agenda-unplan" v="caption" tone="ink2" onPress={() => a.unplan(day)} accessibilityRole="button" style={{ paddingVertical: 10, paddingLeft: 10 }}>
                  Retirer
                </T>
              )}
            </View>
            <OutfitBoard pieces={pieces} width={width - space.gutter * 2 - 32} onPiece={(p) => nav.navigate('Piece', { id: p.id })} />
            <Legend pieces={pieces} />
            <Rule />
            <T v="cardTitle">{planned.title}</T>
            {!todayOutfit && <Button testID="agenda-change" label="Changer la tenue" variant="secondary" size="m" icon="layers" onPress={() => nav.navigate('Compose', { day, pieces: planned.pieces })} />}
          </Card>
        ) : (
          <Card style={{ gap: 12 }} testID="agenda-empty">
            <T v="cardTitle">Rien de prévu pour l’instant.</T>
            <T v="body" tone="ink2">
              {events.length ? `Tu pourrais préparer une tenue pour « ${events[0].title} ».` : 'Tu pourrais préparer ta tenue la veille : le matin, tu gagnes dix minutes.'}
            </T>
            <View className="flex-row" style={{ gap: 8 }}>
              <Button testID="agenda-compose" label="Composer" size="m" grow onPress={() => nav.navigate('Compose', { day })} />
              <Button testID="agenda-ask" label="Demander à Kode" size="m" variant="secondary" grow onPress={() => nav.navigate('Tabs', { screen: 'Kode', params: { ask: events[0] ? `Une tenue pour « ${events[0].title} »` : `Une tenue pour ${relativeDay(day).toLowerCase()}`, nonce: Date.now() } })} />
            </View>
          </Card>
        )}

        {later.length > 0 && (
          <View style={{ gap: 4 }}>
            <T v="kicker" tone="ink2" upper style={{ marginBottom: 4 }}>
              À venir
            </T>
            {later.map((e) => (
              <Tap key={e.id} testID={`later-${e.id}`} onPress={() => (e.occasion ? nav.navigate('Event', { id: e.id }) : setDay(e.day))} scaleTo={0.99} accessibilityLabel={`${shortDate(e.day)}, ${e.title}`} className="flex-row items-center" style={{ minHeight: 52, gap: 14, borderBottomWidth: 1, borderColor: c.rule }}>
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
          </View>
        )}
      </Animated.View>
    </Animated.ScrollView>
    </View>
  );
}
