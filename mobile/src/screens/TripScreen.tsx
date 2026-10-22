/**
 * Un voyage (07/10) : la destination, ses dates, pourquoi on part ; une
 * photo du lieu, sa météo jour par jour, et une tenue par jour proposée par
 * Kodi, que l'on change à volonté. La valise suit.
 */
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackActions } from '@react-navigation/native';
import { WEATHER, type Piece, type Weather } from '../data/wardrobe';
import { useStore } from '../state/store';
import { canCompose } from '../state/outfits';
import { KIND } from '../state/contexte';
import * as remote from '../state/remote';
import type { InfosVoyage, Lieu } from '../state/remote';
import { TRIP_ACTIVITIES, TRIP_PURPOSES, dateOf, daysFrom, isoOf, longLabel, newId, spanLabel, type Iso, type Trip, type TripPurpose } from '../state/planning';
import { usePlanifier } from '../state/usePlanifier';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { F } from '../theme/fonts';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { Card, DotChip, Tag, WeatherIcon } from '../ui/bits';
import { Credit } from '../ui/Credit';
import { Garment } from '../ui/Garment';
import { FlatLay, headToToe } from '../ui/outfit';
import { Icon } from '../ui/Icon';
import { ChoiceChips, MonthGrid, MonthNav, WEEK_LETTERS } from '../ui/planning';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import { KodeThinking } from '../ui/KodeThinking';
import type { Nav, Route } from '../navigation/types';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Sans compte (démonstration, hors ligne) : quelques destinations connues. */
const LIEUX_DEMO: Lieu[] = [
  { nom: 'Tokyo', pays: 'Japon', region: null, lat: 35.69, lon: 139.69 },
  { nom: 'Lisbonne', pays: 'Portugal', region: null, lat: 38.72, lon: -9.14 },
  { nom: 'New York', pays: 'États-Unis', region: null, lat: 40.71, lon: -74.01 },
  { nom: 'Londres', pays: 'Royaume-Uni', region: null, lat: 51.51, lon: -0.13 },
  { nom: 'Rome', pays: 'Italie', region: null, lat: 41.9, lon: 12.5 },
  { nom: 'Barcelone', pays: 'Espagne', region: null, lat: 41.39, lon: 2.17 },
  { nom: 'Marrakech', pays: 'Maroc', region: null, lat: 31.63, lon: -8.01 },
  { nom: 'Copenhague', pays: 'Danemark', region: null, lat: 55.68, lon: 12.57 },
  { nom: 'Séoul', pays: 'Corée du Sud', region: null, lat: 37.57, lon: 126.98 },
  { nom: 'Nice', pays: 'France', region: null, lat: 43.7, lon: 7.27 },
];

const sansAccents = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** La météo du voyage, jour par jour, au format de l'app. */
function meteoDe(infos: InfosVoyage | null): Record<Iso, Weather | null> {
  const out: Record<Iso, Weather | null> = {};
  for (const b of [infos?.prevision, infos?.saison]) for (const j of b?.valeur ?? []) out[j.date] = { t: j.max, low: j.min, kind: KIND[j.ciel] ?? 'nuages', label: j.libelle };
  return out;
}

export function TripScreen() {
  const { params } = useRoute<Route<'Trip'>>();
  const { s } = useStore();
  const trip = params?.id ? s.trips.find((t) => t.id === params.id) : undefined;
  return trip ? <TripView trip={trip} /> : <TripNew />;
}

/* ---- Préparer un voyage ---- */

function TripNew() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { width } = useScreen();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const planifier = usePlanifier();
  const live = s.account === 'connecte' && remote.online;

  const [q, setQ] = useState('');
  const [found, setFound] = useState<Lieu[]>([]);
  const [lieu, setLieu] = useState<Lieu | null>(null);
  const [at, setAt] = useState(0);
  const [start, setStart] = useState<Iso | null>(null);
  const [end, setEnd] = useState<Iso | null>(null);
  const [purpose, setPurpose] = useState<TripPurpose>('Plaisir');
  const [activities, setActivities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La recherche part un instant après la dernière lettre.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const text = q.trim();
    if (lieu || text.length < 2) return setFound([]);
    timer.current = setTimeout(async () => {
      if (!live) return setFound(LIEUX_DEMO.filter((l) => sansAccents(l.nom).startsWith(sansAccents(text))));
      const r = await remote.lieux(text).catch(() => null);
      setFound(r?.ok ? r.lieux.slice(0, 5) : []);
    }, 380);
  }, [q, lieu, live]);

  const W = width - space.gutter * 2;
  const input = { minHeight: 50, borderRadius: 25, paddingHorizontal: 18, color: c.ink, backgroundColor: c.sunk, ...F.s400, fontSize: 16 } as const;
  const days = start ? daysFrom(start, end ?? start) : [];
  const ok = !!lieu && !!start && canCompose(s.pieces);

  const pickDay = (iso: Iso) => {
    if (!start || end || iso < start) {
      setStart(iso);
      setEnd(null);
    } else if (daysFrom(start, iso).length <= 30) setEnd(iso);
  };

  const go = async () => {
    if (!lieu || !start) return;
    setBusy(true);
    try {
      const fin = end ?? start;
      const infos = live ? await remote.infosVoyage(lieu.nom, lieu.lat, lieu.lon, start, fin) : null;
      const trip: Trip = {
        id: newId(),
        destination: lieu.nom,
        country: lieu.pays,
        lat: lieu.lat,
        lon: lieu.lon,
        start,
        end: fin,
        purpose,
        activities,
        image: infos?.photo?.valeur ? { url: infos.photo.valeur.url, credit: infos.photo.valeur.credit, page: infos.photo.valeur.page ?? undefined } : null,
      };
      // En démonstration, la météo simulée de l'app, jour après jour.
      const meteo = live ? meteoDe(infos) : Object.fromEntries(daysFrom(start, fin).map((d, i) => [d, WEATHER[i % WEATHER.length]]));
      const outfits = await planifier(daysFrom(start, fin), { trip, meteo, consigne: activities.length ? `Activités prévues : ${activities.join(', ')}.` : '' });
      a.saveTrip(trip, outfits);
      a.toast(`Voyage à ${lieu.nom} prêt`);
      nav.dispatch(StackActions.replace('Trip', { id: trip.id }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-trip-new">
      <Ambient />
      <StackHeader title="Voyage" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <Card style={{ padding: 14, gap: 12 }} testID="trip-where">
          <Tag label="Où pars-tu ?" icon="pin" />
          {lieu ? (
            <Tap testID="trip-place-chosen" onPress={() => { setLieu(null); setQ(''); }} accessibilityLabel={`${lieu.nom}, changer de destination`} style={{ minHeight: 50, borderRadius: 25, paddingHorizontal: 18, backgroundColor: c['primary-bg'], flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="pin" size={18} color={c['primary-fg']} />
              <T v="bodyStrong" style={{ flex: 1, color: c['primary-fg'] }} numberOfLines={1}>
                {[lieu.nom, lieu.pays].filter(Boolean).join(', ')}
              </T>
              <Icon name="close" size={16} color={c['primary-fg']} />
            </Tap>
          ) : (
            <TextInput testID="trip-place" value={q} onChangeText={setQ} placeholder="Tokyo, Lisbonne, New York…" placeholderTextColor={c.ink2} accessibilityLabel="Destination" autoCorrect={false} style={input} />
          )}
          {!lieu &&
            found.map((l, k) => (
              <Tap key={`${l.nom}-${k}`} testID={`trip-place-${k}`} onPress={() => { setLieu(l); setFound([]); }} accessibilityLabel={[l.nom, l.region, l.pays].filter(Boolean).join(', ')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 6 }}>
                <Icon name="pin" size={18} color={c.ink2} />
                <View style={{ flex: 1 }}>
                  <T v="bodyStrong">{l.nom}</T>
                  <T v="caption" tone="ink2">
                    {[l.region, l.pays].filter(Boolean).join(', ')}
                  </T>
                </View>
              </Tap>
            ))}
        </Card>

        <Card style={{ padding: 14, gap: 12 }} testID="trip-when">
          <View className="flex-row items-center justify-between">
            <Tag label="Quand ?" icon="calendar" />
            <T v="kicker" tone="ink2">
              {start ? `${spanLabel(start, end ?? start)} · ${days.length} jour${days.length > 1 ? 's' : ''}` : 'Touche le départ, puis le retour'}
            </T>
          </View>
          <MonthNav at={at} onChange={setAt} min={0} max={12} />
          <MonthGrid
            at={at}
            width={W - 28}
            cellHeight={44}
            testID="trip-day"
            onPick={pickDay}
            label={(iso) => cap(longLabel(iso))}
            state={(iso) => ({ selected: iso === start || iso === end, inRange: !!start && !!end && iso > start && iso < end, disabled: iso < isoOf(0) })}
          />
        </Card>

        <Card style={{ padding: 14, gap: 12 }} testID="trip-why">
          <Tag label="Pourquoi ?" />
          <ChoiceChips testID="trip-purpose" options={TRIP_PURPOSES} value={[purpose]} onChange={(v) => v[0] && setPurpose(v[0] as TripPurpose)} />
          <T v="kicker" tone="ink2">
            Au programme
          </T>
          <ChoiceChips testID="trip-activity" options={TRIP_ACTIVITIES} value={activities} onChange={setActivities} multi />
        </Card>

        {busy ? (
          <Card className="bg-butter" style={{ padding: 18, borderBottomLeftRadius: 8 }}>
            <KodeThinking phrases={['Kodi regarde la météo sur place', 'Kodi fait ta valise', 'Kodi compose chaque jour']} />
          </Card>
        ) : (
          <Button testID="trip-go" label={canCompose(s.pieces) ? 'Préparer mes tenues' : 'Ajoute d’abord quelques pièces'} icon="kode" disabled={!ok} onPress={go} />
        )}
      </Animated.ScrollView>
    </View>
  );
}

/* ---- Le voyage ---- */

function TripView({ trip }: { trip: Trip }) {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { width } = useScreen();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const planifier = usePlanifier();
  const live = s.account === 'connecte' && remote.online;
  const [infos, setInfos] = useState<InfosVoyage | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!live || trip.lat === null || trip.lon === null) return;
    let gone = false;
    remote.infosVoyage(trip.destination, trip.lat, trip.lon, trip.start, trip.end).then((r) => !gone && setInfos(r));
    return () => {
      gone = true;
    };
  }, [live, trip.destination, trip.lat, trip.lon, trip.start, trip.end]);

  const W = width - space.gutter * 2;
  const days = daysFrom(trip.start, trip.end);
  const meteo: Record<Iso, Weather | null> = live ? meteoDe(infos) : Object.fromEntries(days.map((d, i) => [d, WEATHER[i % WEATHER.length]]));
  const byId = new Map(s.pieces.map((p) => [p.id, p]));
  const piecesOf = (ids: string[]) => ids.map((id) => byId.get(id)).filter(Boolean) as Piece[];
  const valise = [...new Set(days.flatMap((d) => s.planned[d]?.pieces ?? []))].map((id) => byId.get(id)).filter(Boolean) as Piece[];
  const saison = infos?.saison?.valeur?.length ? true : false;

  const refaire = async () => {
    setBusy(true);
    try {
      const out = await planifier(days, { trip, meteo, consigne: trip.activities.length ? `Activités prévues : ${trip.activities.join(', ')}.` : '' });
      a.saveTrip(trip, out);
      a.toast('Kodi a refait tes tenues');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-trip">
      <Ambient />
      <StackHeader title={trip.destination} y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40, gap: 14 }}>
        {/* La photo du lieu, son nom posé dessus. */}
        <Animated.View entering={FadeIn.duration(320)} style={{ gap: 6 }}>
          <View style={{ height: 240, borderRadius: 28, overflow: 'hidden', backgroundColor: c.stage, justifyContent: 'flex-end' }} testID="trip-photo">
            {trip.image ? (
              <Image source={{ uri: trip.image.url }} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} resizeMode="cover" accessibilityLabel={`Photo de ${trip.destination}`} />
            ) : (
              <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="plane" size={42} color={c.ink2} />
              </View>
            )}
            <View style={{ margin: 12, alignSelf: 'flex-start', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c['glass-strong'], borderWidth: 1, borderColor: c['glass-border'] }}>
              <T v="hero" style={{ fontSize: 28, lineHeight: 30 }}>
                {trip.destination}
              </T>
              <T v="kicker" tone="ink2">
                {[trip.country, spanLabel(trip.start, trip.end)].filter(Boolean).join(' · ')}
              </T>
            </View>
          </View>
          {trip.image && (
            <T v="small" tone="ink2" onPress={trip.image.page ? () => Linking.openURL(trip.image!.page!) : undefined} accessibilityRole={trip.image.page ? 'link' : 'text'} style={{ paddingHorizontal: 6 }}>
              {trip.image.credit}
            </T>
          )}
        </Animated.View>

        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {[`${days.length} jour${days.length > 1 ? 's' : ''}`, trip.purpose, ...trip.activities].map((x) => (
            <DotChip key={x} label={x} />
          ))}
        </View>

        {/* La météo sur place, jour par jour. */}
        <Card style={{ padding: 14, gap: 10 }} testID="trip-weather">
          <Tag label={saison ? 'Météo sur place · prévision et saison' : 'Météo sur place'} />
          <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -14 }} contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }}>
            {days.map((d) => {
              const w = meteo[d];
              const jour = dateOf(d);
              return (
                <View key={d} style={{ width: 52, height: 104, borderRadius: 18, backgroundColor: c.pill, alignItems: 'center', justifyContent: 'center', gap: 4 }} accessible accessibilityLabel={`${cap(longLabel(d))}${w ? `, ${w.t} degrés, ${w.label}` : ', météo inconnue'}`}>
                  <T v="kicker">{WEEK_LETTERS[(jour.getDay() + 6) % 7]}</T>
                  <T v="bodyStrong">{String(jour.getDate())}</T>
                  {w ? <WeatherIcon w={w} size={18} color={c.ink} /> : <View style={{ height: 18 }} />}
                  <T v="kicker">{w ? `${w.t}°` : '·'}</T>
                </View>
              );
            })}
          </Animated.ScrollView>
          {live ? <Credit blocs={[infos?.prevision, infos?.saison]} /> : null}
        </Card>

        {/* Une tenue par jour : la proposition de Kodi, à changer à volonté. */}
        <Card style={{ padding: 14, gap: 12 }} testID="trip-days">
          <Tag label="Une tenue par jour" />
          {busy ? (
            <KodeThinking phrases={['Kodi refait chaque jour']} />
          ) : (
            days.map((d, i) => {
              const o = s.planned[d];
              const ps = o ? headToToe(piecesOf(o.pieces)) : [];
              const w = meteo[d];
              return (
                <Animated.View key={d} entering={FadeInDown.delay(i * 60).duration(300)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingTop: i ? 12 : 0, borderTopWidth: i ? 1 : 0, borderColor: c.rule }}>
                  <View style={{ width: 92, gap: 4 }}>
                    <T v="kicker" tone="ink2">{`Jour ${i + 1}`}</T>
                    <T v="stat" style={{ fontSize: 30, lineHeight: 32 }}>
                      {String(dateOf(d).getDate()).padStart(2, '0')}
                    </T>
                    <T v="caption" tone="ink2">
                      {cap(longLabel(d).split(' ')[0])}
                      {w ? ` · ${w.t}°` : ''}
                    </T>
                    <T testID={`trip-change-${i}`} v="caption" onPress={() => nav.navigate('Compose', { date: d, pieces: o?.pieces })} accessibilityRole="button" suppressHighlighting style={{ ...F.s600, paddingVertical: 8 }}>
                      {o ? 'Changer' : 'Choisir'}
                    </T>
                  </View>
                  <Tap testID={`trip-day-${i}`} onPress={() => nav.navigate('Compose', { date: d, pieces: o?.pieces })} accessibilityLabel={o ? `Jour ${i + 1}, ${o.title}, changer` : `Jour ${i + 1}, choisir une tenue`} outerStyle={{ flex: 1 }} style={{ height: 140, borderRadius: 22, overflow: 'hidden' }}>
                    {ps.length ? (
                      <FlatLay pieces={ps} w={W - 28 - 104} h={140} />
                    ) : (
                      <View style={{ flex: 1, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.faint, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="plus" size={22} color={c.ink} />
                      </View>
                    )}
                  </Tap>
                </Animated.View>
              );
            })
          )}
          <Button testID="trip-redo" label="Kodi refait les tenues" variant="quiet" size="m" icon="kode" disabled={busy || !canCompose(s.pieces)} onPress={refaire} />
        </Card>

        {/* La valise : les pièces qui partent, une seule fois chacune. */}
        {valise.length > 0 && (
          <Card style={{ padding: 14, gap: 12 }} testID="trip-suitcase">
            <View className="flex-row items-center justify-between">
              <Tag label="Ta valise" icon="suitcase" />
              <T v="kicker" tone="ink2">{`${valise.length} pièce${valise.length > 1 ? 's' : ''} · ${days.length} jour${days.length > 1 ? 's' : ''}`}</T>
            </View>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {valise.map((p) => (
                <Tap key={p.id} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={p.name} style={{ width: 64, height: 76, borderRadius: 18, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <Garment kind={p.kind} tint={p.tint} image={p.image} size={50} dark={scheme === 'dark'} label={p.name} />
                </Tap>
              ))}
            </View>
          </Card>
        )}

        <Button
          testID="trip-delete"
          label="Supprimer ce voyage"
          variant="plain"
          onPress={() => {
            a.removeTrip(trip.id);
            a.toast('Voyage supprimé');
            nav.goBack();
          }}
        />
      </Animated.ScrollView>
    </View>
  );
}
