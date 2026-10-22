/**
 * Le planning (07/10) : un grand calendrier du mois, avec les tenues prévues,
 * les rendez-vous et les voyages, sur le mois passé et l'année qui vient.
 * On choisit des jours et Kodi les prépare ; on ouvre un jour pour voir sa
 * tenue, ses rendez-vous, et la changer.
 */
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { Piece } from '../data/wardrobe';
import { eventsOn, useMeteo, useStore } from '../state/store';
import { canCompose } from '../state/outfits';
import { dayName, isoOf, longLabel, offsetOf, spanLabel, timeLabel, type Iso } from '../state/planning';
import { usePlanifier } from '../state/usePlanifier';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { Card, DotChip, Tag, WeatherIcon } from '../ui/bits';
import { Garment } from '../ui/Garment';
import { OutfitBoard, headToToe } from '../ui/outfit';
import { Icon } from '../ui/Icon';
import { MonthGrid, MonthNav, monthAt } from '../ui/planning';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import { KodeThinking } from '../ui/KodeThinking';
import { F } from '../theme/fonts';
import { useChoisirNotifs } from '../ui/rappels';
import type { Nav, Route } from '../navigation/types';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function Planning() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route<'Planning'>>();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { width } = useScreen();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const meteo = useMeteo();
  const planifier = usePlanifier();
  const choisirNotifs = useChoisirNotifs();

  const [at, setAt] = useState(params?.date ? monthAt(params.date) : 0);
  const [day, setDay] = useState<Iso>(params?.date ?? isoOf(0));
  const [choisir, setChoisir] = useState(!!params?.choisir);
  const [chosen, setChosen] = useState<Iso[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params?.date) {
      setDay(params.date);
      setAt(monthAt(params.date));
    }
    if (params?.choisir) setChoisir(true);
  }, [params]);

  const W = width - space.gutter * 2;
  const today = isoOf(0);
  const byId = new Map(s.pieces.map((p) => [p.id, p]));
  const piecesOf = (ids: string[]) => ids.map((id) => byId.get(id)).filter(Boolean) as Piece[];
  const tripOn = (iso: Iso) => s.trips.find((t) => t.start <= iso && iso <= t.end);
  const ready = canCompose(s.pieces);

  const pick = (iso: Iso) => {
    if (!choisir) return setDay(iso);
    if (iso < today) return;
    setChosen((prev) => (prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort()));
  };

  const lancer = async (dates: Iso[]) => {
    if (!dates.length) return;
    setBusy(true);
    try {
      const out = await planifier(dates);
      const n = Object.keys(out).length;
      for (const [d, o] of Object.entries(out)) a.plan(d, { ...o, tripId: s.planned[d]?.tripId ?? tripOn(d)?.id ?? null }, 'kode');
      a.toast(n ? (n > 1 ? `${n} tenues prévues par Kodi` : 'Une tenue prévue par Kodi') : 'Kodi n’a pas trouvé de tenue : ajoute des pièces');
      setChosen([]);
      setChoisir(false);
      if (dates.length === 1) setDay(dates[0]);
    } finally {
      setBusy(false);
    }
  };

  // Le jour ouvert.
  const off = offsetOf(day);
  const w = off >= 0 ? meteo.jours[off] : null;
  const events = eventsOn(s.events, day);
  const planned = s.planned[day];
  const trip = tripOn(day);
  const pieces = planned ? headToToe(piecesOf(planned.pieces)) : [];
  const later = s.events.filter((e) => e.date > today).slice(0, 5);
  const trips = s.trips.filter((t) => t.end >= today);

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-planning">
      <Ambient />
      <StackHeader
        title="Planning"
        y={y}
        right={[
          { icon: 'plane', label: 'Préparer un voyage', onPress: () => nav.navigate('Trip', {}), testID: 'planning-trip' },
          { icon: 'plus', label: 'Ajouter un rendez-vous', onPress: () => nav.navigate('EventEdit', { date: day < today ? today : day }), testID: 'planning-add-event', solid: true },
        ]}
      />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40, gap: 16 }}>
        {/* Le mois, en grand : chaque jour montre sa tenue, ses rendez-vous, son voyage. */}
        <Card style={{ padding: 14, gap: 14 }} testID="planning-calendar">
          <MonthNav at={at} onChange={setAt} min={-1} max={12} testID="planning-month" />
          <Animated.View key={`m-${at}`} entering={FadeIn.duration(200)}>
            <MonthGrid
              at={at}
              width={W - 28}
              cellHeight={70}
              testID="planning-day"
              onPick={pick}
              state={(iso) => ({ selected: choisir ? chosen.includes(iso) : iso === day, inRange: !!tripOn(iso), disabled: choisir && iso < today })}
              label={(iso) => {
                const o = s.planned[iso];
                const ev = eventsOn(s.events, iso);
                const t = tripOn(iso);
                return [cap(longLabel(iso)), o ? `tenue prévue : ${o.title}` : null, ev.length ? `${ev.length} rendez-vous` : null, t ? `voyage à ${t.destination}` : null].filter(Boolean).join(', ');
              }}
              cell={(iso, on) => {
                const o = s.planned[iso];
                const main = o ? headToToe(piecesOf(o.pieces)).find((p) => p.category !== 'accessoires' && p.category !== 'chaussures') : null;
                const ev = eventsOn(s.events, iso);
                const fg = on ? c['primary-fg'] : c.ink;
                return (
                  <>
                    {main ? (
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: on ? c['primary-fg'] : c.stage, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <Garment kind={main.kind} tint={main.tint} image={main.image} size={24} dark={scheme === 'dark' && !on} label={main.name} />
                      </View>
                    ) : tripOn(iso)?.start === iso ? (
                      <Icon name="plane" size={16} color={fg} />
                    ) : (
                      <View style={{ height: 16 }} />
                    )}
                    <View className="flex-row" style={{ gap: 3, height: 5 }}>
                      {ev.slice(0, 3).map((e) => (
                        <View key={e.id} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: fg }} />
                      ))}
                    </View>
                  </>
                );
              }}
            />
          </Animated.View>
          {!choisir ? (
            <Button testID="planning-choose" label="Choisir des jours pour Kodi" variant="quiet" size="m" icon="kode" disabled={!ready} onPress={() => { setChoisir(true); setChosen([]); }} />
          ) : (
            <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 4 }}>
              <T v="caption" tone="ink2">
                {chosen.length ? `${chosen.length} jour${chosen.length > 1 ? 's' : ''} choisi${chosen.length > 1 ? 's' : ''}` : 'Touche les jours à préparer'}
              </T>
              <T testID="planning-choose-cancel" v="caption" onPress={() => { setChoisir(false); setChosen([]); }} accessibilityRole="button" suppressHighlighting style={{ paddingVertical: 12, paddingLeft: 12, ...F.s600 }}>
                Annuler
              </T>
            </View>
          )}
        </Card>

        {choisir ? (
          // Les jours choisis partent chez Kodi : une tenue par jour.
          <Animated.View entering={FadeInDown.duration(260)}>
            <Card className="bg-butter" style={{ padding: 18, gap: 14, borderBottomLeftRadius: 8 }} testID="planning-kode">
              {busy ? (
                <KodeThinking phrases={['Kodi lit tes rendez-vous', 'Kodi regarde la météo', 'Kodi compose chaque jour']} />
              ) : (
                <View className="flex-row items-center" style={{ gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c['butter-ink'], alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="kode" size={18} color={c.butter} />
                  </View>
                  <T v="cardTitle" style={{ color: c['butter-ink'], flex: 1 }}>
                    {chosen.length ? `Kodi prépare ${chosen.length} jour${chosen.length > 1 ? 's' : ''}` : 'Choisis tes jours'}
                  </T>
                </View>
              )}
              {chosen.length > 0 && (
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {chosen.map((d) => (
                    <View key={d} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: c['butter-field'], justifyContent: 'center' }}>
                      <T v="kicker" style={{ color: c['butter-ink'] }}>
                        {dayName(d)}
                      </T>
                    </View>
                  ))}
                </View>
              )}
              <Button testID="planning-kode-go" label="Préparer ces jours" icon="kode" disabled={!chosen.length} loading={busy} onPress={() => lancer(chosen)} />
            </Card>
          </Animated.View>
        ) : (
          // Le jour ouvert.
          <Animated.View key={`d-${day}`} entering={FadeIn.duration(220)}>
            <Card style={{ padding: 14, gap: 12 }} testID="planning-detail">
              <View className="flex-row items-center" style={{ gap: 10 }}>
                {w ? <WeatherIcon w={w} size={22} color={c.ink} /> : <Icon name="calendar" size={22} color={c.ink} />}
                <T v="bodyStrong" style={{ flex: 1 }}>
                  {cap(longLabel(day))}
                  {w ? ` · ${w.t}°, ${w.label}` : ''}
                </T>
              </View>
              {trip && (
                <Tap testID="planning-detail-trip" onPress={() => nav.navigate('Trip', { id: trip.id })} accessibilityLabel={`Voyage à ${trip.destination}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <DotChip label={`Voyage · ${trip.destination}`} />
                  <Icon name="chevron" size={14} color={c.ink2} />
                </Tap>
              )}

              {events.map((e) => (
                <Tap key={e.id} testID={`planning-event-${e.id}`} onPress={() => nav.navigate('EventEdit', { id: e.id })} scaleTo={0.99} accessibilityLabel={`${timeLabel(e.time) ?? 'Dans la journée'}, ${e.title}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderTopWidth: 1, borderColor: c.rule, paddingTop: 8 }}>
                  <T v="bodyStrong" style={{ width: 62 }}>
                    {timeLabel(e.time) ?? 'Journée'}
                  </T>
                  <View style={{ flex: 1, gap: 4 }}>
                    <T v="bodyStrong" numberOfLines={1}>
                      {e.title}
                    </T>
                    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                      {[e.kind, e.dressCode, e.stake && e.stake !== 'Tranquille' ? e.stake : null].filter((x): x is string => !!x).map((x) => (
                        <DotChip key={x} label={x} />
                      ))}
                    </View>
                  </View>
                  <Icon name="chevron" size={16} color={c.ink2} />
                </Tap>
              ))}

              {planned && pieces.length ? (
                <View style={{ gap: 10 }}>
                  <View style={{ backgroundColor: c.stage, borderRadius: 22, padding: 12 }}>
                    <OutfitBoard pieces={pieces} width={W - 28 - 24} numbered={false} onPiece={(p) => nav.navigate('Piece', { id: p.id })} />
                  </View>
                  <T v="cardTitle" style={{ paddingHorizontal: 4 }}>
                    {planned.title}
                  </T>
                  <View className="flex-row" style={{ gap: 8 }}>
                    <Button grow testID="planning-change" label="Changer" variant="quiet" size="m" icon="layers" onPress={() => nav.navigate('Compose', { date: day, pieces: planned.pieces })} />
                    <Button testID="planning-unplan" label="Retirer" variant="plain" size="m" onPress={() => a.unplan(day)} />
                  </View>
                </View>
              ) : day >= today ? (
                ready ? (
                  <View className="flex-row" style={{ gap: 8 }}>
                    <Button grow testID="planning-compose" label="Composer" size="m" icon="layers" onPress={() => nav.navigate('Compose', { date: day })} />
                    <Button grow testID="planning-ask" label="Kodi" variant="quiet" size="m" icon="kode" loading={busy} onPress={() => lancer([day])} />
                  </View>
                ) : (
                  <Button testID="planning-add-pieces" label="Ajouter des pièces" size="m" icon="plus" onPress={() => nav.navigate('AddPiece')} />
                )
              ) : (
                <T v="caption" tone="ink2">
                  Rien de noté ce jour-là.
                </T>
              )}
              {day >= today && (
                <Button testID="planning-detail-add-event" label="Ajouter un rendez-vous" variant="plain" size="m" icon="plus" onPress={() => nav.navigate('EventEdit', { date: day })} />
              )}
            </Card>
          </Animated.View>
        )}

        {/* Les rappels, demandés en contexte la première fois qu'il y a quelque chose à rappeler. */}
        {s.notifs === null && s.account !== 'demo' && (Object.keys(s.planned).some((d) => d >= today) || s.events.some((e) => e.date >= today)) && (
          <Card className="bg-butter" style={{ padding: 18, gap: 12 }} testID="planning-notifs">
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <Icon name="bell" size={20} color={c['butter-ink']} />
              <T v="bodyStrong" style={{ flex: 1, color: c['butter-ink'] }}>
                Kodi te prévient la veille ?
              </T>
            </View>
            <Button testID="planning-notifs-tout" label="Oui, préviens-moi" size="m" onPress={() => choisirNotifs('tout')} />
            {/* Sur le beurre, les autres réponses en texte noir : lisibles en clair comme en sombre. */}
            <View className="flex-row justify-center flex-wrap">
              {([['planning', 'Seulement mon planning'], ['non', 'Non merci']] as const).map(([id, label]) => (
                <T key={id} testID={`planning-notifs-${id}`} v="bodyStrong" onPress={() => choisirNotifs(id)} accessibilityRole="button" suppressHighlighting style={{ color: c['butter-ink'], paddingVertical: 12, paddingHorizontal: 12 }}>
                  {label}
                </T>
              ))}
            </View>
          </Card>
        )}

        {/* Les voyages : une photo, des dates, une tenue par jour. */}
        <Card style={{ padding: 14, gap: 12 }} testID="planning-trips">
          <Tag label="Voyages" icon="plane" />
          {trips.map((t) => (
            <Tap key={t.id} testID={`planning-trip-${t.id}`} onPress={() => nav.navigate('Trip', { id: t.id })} scaleTo={0.99} accessibilityLabel={`Voyage à ${t.destination}, ${spanLabel(t.start, t.end)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: c.stage, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                {t.image ? <Image source={{ uri: t.image.url }} style={{ width: 64, height: 64 }} resizeMode="cover" accessibilityIgnoresInvertColors /> : <Icon name="plane" size={22} color={c.ink} />}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="bodyStrong" numberOfLines={1}>
                  {t.destination}
                </T>
                <T v="kicker" tone="ink2">
                  {`${spanLabel(t.start, t.end)} · ${t.purpose}`}
                </T>
              </View>
              <Icon name="chevron" size={16} color={c.ink2} />
            </Tap>
          ))}
          <Button testID="planning-new-trip" label={trips.length ? 'Préparer un autre voyage' : 'Préparer un voyage'} variant={trips.length ? 'quiet' : 'primary'} size="m" icon="plane" onPress={() => nav.navigate('Trip', {})} />
        </Card>

        {later.length > 0 && (
          <Card style={{ padding: 14, gap: 4 }} testID="planning-later">
            <Tag label="Rendez-vous à venir" />
            {later.map((e, k) => (
              <Tap key={e.id} testID={`planning-later-${e.id}`} onPress={() => { setDay(e.date); setAt(monthAt(e.date)); setChoisir(false); }} scaleTo={0.99} accessibilityLabel={`${dayName(e.date)}, ${e.title}`} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 12, borderBottomWidth: k === later.length - 1 ? 0 : 1, borderColor: c.rule }}>
                <T v="kicker" tone="ink2" style={{ width: 92 }}>
                  {dayName(e.date)}
                </T>
                <T v="body" style={{ flex: 1 }} numberOfLines={1}>
                  {e.title}
                </T>
                {s.planned[e.date] ? <Icon name="check" size={16} color={c.ink} /> : <View style={{ width: 16 }} />}
              </Tap>
            ))}
          </Card>
        )}
      </Animated.ScrollView>
    </View>
  );
}
