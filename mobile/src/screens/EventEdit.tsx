/**
 * Un rendez-vous à habiller (07/10) : le jour, l'heure, le type, l'importance,
 * la tenue voulue, ce qu'on veut dégager, le lieu et les contraintes. Tout
 * part chez Kodi avec la demande de tenue : plus il en sait, plus elle tombe
 * juste.
 */
import { useState, type ReactNode } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useStore } from '../state/store';
import { canCompose } from '../state/outfits';
import { CONSTRAINTS, DRESS_CODES, IMPRESSIONS, RDV_KINDS, SETTINGS, STAKES, isoOf, kindHint, longLabel, newId, type Iso, type RdvEvent, type Setting, type Stake } from '../state/planning';
import { usePlanifier } from '../state/usePlanifier';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { F } from '../theme/fonts';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Chip } from '../ui/controls';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { Card, Tag } from '../ui/bits';
import { Icon } from '../ui/Icon';
import { ChoiceChips, MonthGrid, MonthNav, TimePicker, monthAt } from '../ui/planning';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import type { Nav, Route } from '../navigation/types';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function EventEdit() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route<'EventEdit'>>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { width } = useScreen();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const planifier = usePlanifier();

  const known = params?.id ? s.events.find((e) => e.id === params.id) : undefined;
  const [e, setE] = useState<RdvEvent>(
    known ?? {
      id: newId(),
      date: params?.date ?? isoOf(1),
      time: null,
      title: '',
      kind: null,
      dressCode: null,
      stake: null,
      impressions: [],
      place: null,
      setting: null,
      constraints: [],
      note: null,
    },
  );
  const [dating, setDating] = useState(false);
  const [at, setAt] = useState(monthAt(e.date));
  const [group, setGroup] = useState(RDV_KINDS.find((g) => g.kinds.some((k) => k.id === e.kind))?.group ?? RDV_KINDS[0].group);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<RdvEvent>) => setE((prev) => ({ ...prev, ...patch }));

  const W = width - space.gutter * 2;
  const input = { minHeight: 50, borderRadius: 25, paddingHorizontal: 18, color: c.ink, backgroundColor: c.sunk, ...F.s400, fontSize: 16 } as const;
  const ok = e.title.trim().length > 0;
  const hint = kindHint(e.kind);

  const clean = (): RdvEvent => ({ ...e, title: e.title.trim(), place: e.place?.trim() || null, note: e.note?.trim() || null });
  const save = () => {
    if (!ok) return;
    a.saveEvent(clean());
    a.toast(known ? 'Rendez-vous corrigé' : 'Rendez-vous noté');
    nav.goBack();
  };
  // Enregistre, puis Kodi prépare la tenue de ce jour-là avec tout ce qui vient d'être dit.
  const saveAndDress = async () => {
    if (!ok) return;
    const ev = clean();
    a.saveEvent(ev);
    setBusy(true);
    try {
      const out = await planifier([ev.date]);
      const o = out[ev.date];
      if (o) {
        a.plan(ev.date, { ...o, tripId: s.planned[ev.date]?.tripId ?? null }, 'kode');
        a.toast('Rendez-vous noté, tenue prévue');
      } else a.toast('Rendez-vous noté');
      nav.navigate('Planning', { date: ev.date });
    } finally {
      setBusy(false);
    }
  };

  const section = (label: string, children: ReactNode, testID?: string) => (
    <Card style={{ padding: 14, gap: 12 }} testID={testID}>
      <Tag label={label} />
      {children}
    </Card>
  );

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-event-edit">
      <Ambient />
      <StackHeader title={known ? 'Rendez-vous' : 'Nouveau rendez-vous'} y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40, gap: 14 }}>
        {section(
          'L’essentiel',
          <>
            <TextInput testID="event-title" value={e.title} onChangeText={(t) => set({ title: t })} maxLength={80} placeholder="Dîner chez Léa" placeholderTextColor={c.ink2} accessibilityLabel="Titre du rendez-vous" style={input} />
            <Tap testID="event-date" onPress={() => setDating((v) => !v)} accessibilityLabel={`Jour : ${longLabel(e.date)}`} style={{ minHeight: 50, borderRadius: 25, paddingHorizontal: 18, backgroundColor: c.sunk, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="calendar" size={18} color={c.ink} />
              <T v="body" style={{ flex: 1 }}>
                {cap(longLabel(e.date))}
              </T>
              <Icon name={dating ? 'up' : 'down'} size={16} color={c.ink2} />
            </Tap>
            {dating && (
              <Animated.View entering={FadeIn.duration(200)} style={{ gap: 10 }}>
                <MonthNav at={at} onChange={setAt} min={0} max={12} />
                <MonthGrid
                  at={at}
                  width={W - 28}
                  cellHeight={44}
                  testID="event-day"
                  state={(iso) => ({ selected: iso === e.date, disabled: iso < isoOf(0) })}
                  label={(iso) => cap(longLabel(iso))}
                  onPick={(iso: Iso) => {
                    set({ date: iso });
                    setDating(false);
                  }}
                />
              </Animated.View>
            )}
            <TimePicker value={e.time} onChange={(time) => set({ time })} testID="event-hour" />
          </>,
          'event-basics',
        )}

        {section(
          'Type de rendez-vous',
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -14 }} contentContainerStyle={{ paddingHorizontal: 14, gap: 18 }}>
              {RDV_KINDS.map((g) => (
                <T key={g.group} testID={`event-group-${g.group}`} v="bodyStrong" onPress={() => setGroup(g.group)} accessibilityRole="tab" accessibilityState={{ selected: group === g.group }} suppressHighlighting style={{ paddingVertical: 10, color: group === g.group ? c.ink : c.ink2, borderBottomWidth: 2, borderColor: group === g.group ? c.ink : 'transparent' }}>
                  {g.group}
                </T>
              ))}
            </ScrollView>
            <ChoiceChips testID="event-kind" options={RDV_KINDS.find((g) => g.group === group)!.kinds.map((k) => k.id)} value={e.kind ? [e.kind] : []} onChange={(v) => set({ kind: v[0] ?? null })} />
            {hint && (
              <View className="flex-row" style={{ gap: 8 }}>
                <Icon name="kode" size={16} color={c.ink} />
                <T v="caption" tone="ink2" style={{ flex: 1 }}>
                  {cap(hint)}.
                </T>
              </View>
            )}
          </>,
          'event-kind-card',
        )}

        {section(
          'Importance',
          <View className="flex-row" style={{ gap: 8 }}>
            {STAKES.map((x) => {
              const on = e.stake === x.id;
              return (
                <Tap key={x.id} testID={`event-stake-${x.id}`} onPress={() => set({ stake: on ? null : (x.id as Stake) })} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${x.id}, ${x.note}`} outerStyle={{ flex: 1 }} style={{ minHeight: 76, borderRadius: 22, padding: 12, gap: 4, justifyContent: 'center', backgroundColor: on ? c['primary-bg'] : c.pill }}>
                  <T v="bodyStrong" style={{ color: on ? c['primary-fg'] : c.ink }}>
                    {x.id}
                  </T>
                  <T v="small" style={{ color: on ? c['primary-fg'] : c.ink2 }}>
                    {x.note}
                  </T>
                </Tap>
              );
            })}
          </View>,
          'event-stake',
        )}

        {section(
          'Tenue voulue',
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            <Chip testID="event-code-kode" label="Kodi choisit" icon="kode" on={e.dressCode === null} onPress={() => set({ dressCode: null })} />
            {DRESS_CODES.map((d) => (
              <Chip key={d} testID={`event-code-${d}`} label={d} on={e.dressCode === d} onPress={() => set({ dressCode: e.dressCode === d ? null : d })} />
            ))}
          </View>,
          'event-code',
        )}

        {section('Ce que tu veux dégager', <ChoiceChips testID="event-impression" options={IMPRESSIONS} value={e.impressions} onChange={(impressions) => set({ impressions })} multi max={3} />, 'event-impressions')}

        {section(
          'Lieu',
          <>
            <TextInput testID="event-place" value={e.place ?? ''} onChangeText={(t) => set({ place: t })} maxLength={80} placeholder="Restaurant, bureau, jardin…" placeholderTextColor={c.ink2} accessibilityLabel="Lieu" style={input} />
            <ChoiceChips testID="event-setting" options={SETTINGS} value={e.setting ? [e.setting] : []} onChange={(v) => set({ setting: (v[0] as Setting) ?? null })} />
          </>,
          'event-place-card',
        )}

        {section('Contraintes', <ChoiceChips testID="event-constraint" options={CONSTRAINTS} value={e.constraints} onChange={(constraints) => set({ constraints })} multi />, 'event-constraints')}

        {section(
          'Note pour Kodi',
          <View style={{ gap: 8 }}>
          <TextInput
            testID="event-note"
            value={e.note ?? ''}
            onChangeText={(t) => set({ note: t })}
            maxLength={400}
            multiline
            placeholder="Je veux être à l’aise, il y aura sa famille…"
            placeholderTextColor={c.ink2}
            accessibilityLabel="Note pour Kodi"
            style={{ ...input, minHeight: 96, borderRadius: 22, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' }}
          />
          <T v="small" tone="ink2">
            Ta note part chez Kodi pour choisir ta tenue. Pas besoin d’y mettre de détail sur ta santé.
          </T>
          </View>,
          'event-note-card',
        )}

        <View style={{ gap: 8, paddingTop: 4 }}>
          {canCompose(s.pieces) && !s.planned[e.date] && (
            <Button testID="event-save-dress" label="Enregistrer et prévoir la tenue" icon="kode" disabled={!ok} loading={busy} onPress={saveAndDress} />
          )}
          <Button testID="event-save" label={known ? 'Enregistrer' : 'Noter le rendez-vous'} variant={canCompose(s.pieces) && !s.planned[e.date] ? 'secondary' : 'primary'} disabled={!ok || busy} onPress={save} />
          {known && (
            <Button
              testID="event-delete"
              label="Supprimer ce rendez-vous"
              variant="plain"
              onPress={() => {
                a.removeEvent(known.id);
                a.toast('Rendez-vous supprimé');
                nav.goBack();
              }}
            />
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}
