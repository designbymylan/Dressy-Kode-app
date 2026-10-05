import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { relativeDay, type CategoryId, type Piece } from '../data/wardrobe';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Chip } from '../ui/controls';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { EmptyState } from '../ui/bits';
import { Garment } from '../ui/Garment';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import type { Nav, Route } from '../navigation/types';

type SlotId = 'veste' | 'haut' | 'bas' | 'chaussures' | 'sac';
const SLOTS: { id: SlotId; label: string; cats: CategoryId[] }[] = [
  { id: 'veste', label: 'Veste', cats: ['manteaux'] },
  { id: 'haut', label: 'Haut', cats: ['hauts'] },
  { id: 'bas', label: 'Bas ou robe', cats: ['bas', 'robes'] },
  { id: 'chaussures', label: 'Chaussures', cats: ['chaussures'] },
  { id: 'sac', label: 'Sac, accessoire', cats: ['accessoires'] },
];

const slotOf = (p: Piece): SlotId => SLOTS.find((s) => s.cats.includes(p.category))!.id;

/** Une lecture simple de la tenue, dite comme un conseil, jamais comme une note. */
function advice(chosen: Piece[]): string {
  const has = (cat: CategoryId) => chosen.some((p) => p.category === cat);
  if (!chosen.length) return 'Choisis une première pièce : Kode s’adapte à partir d’elle.';
  if (!has('robes') && !(has('hauts') && has('bas'))) return has('hauts') ? 'Il manque un bas ou une jupe.' : has('bas') ? 'Il manque un haut.' : 'Tu pourrais partir d’un haut et d’un bas, ou d’une robe.';
  if (!has('chaussures')) return 'Il manque les chaussures.';
  const colors = [...new Set(chosen.map((p) => p.color.toLowerCase()))];
  const sleeping = chosen.find((p) => p.lastWorn === null || p.lastWorn > 60);
  if (sleeping) return `Bonne idée : ${sleeping.name.toLowerCase()} ressort enfin.`;
  if (colors.length <= 2) return `Tout en ${colors.join(' et ')} : sobre et net.`;
  return `${colors.length} couleurs : tu pourrais garder un seul accent pour que l’ensemble respire.`;
}

/** La rotation : d'abord ce qui dort le plus longtemps, pour faire tourner le dressing. */
const byRest = (a: Piece, b: Piece) => (b.lastWorn ?? 999) - (a.lastWorn ?? 999);

/**
 * « Habille-moi » (05/10, inspiré des apps de garde-robe) : une rangée par
 * emplacement, la pièce choisie au centre, ses voisines de part et d'autre.
 * On touche une voisine pour la prendre, le cadenas garde une pièce, et
 * « Mélanger » laisse Kode changer tout ce qui n'est pas gardé.
 */
export function Compose() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route<'Compose'>>();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { width } = useScreen();
  const { onScroll } = useHeaderScroll();
  const top = useStackTop();
  const byId = useMemo(() => new Map(s.pieces.map((p) => [p.id, p])), [s.pieces]);
  const pools = useMemo(() => Object.fromEntries(SLOTS.map((sl) => [sl.id, s.pieces.filter((p) => sl.cats.includes(p.category)).sort(byRest)])) as Record<SlotId, Piece[]>, [s.pieces]);

  const given = [...(params?.pieces ?? []), ...(params?.with ? [params.with] : [])];
  const [slots, setSlots] = useState<Record<SlotId, string | null>>(() => {
    const start: Record<SlotId, string | null> = { veste: null, haut: null, bas: null, chaussures: null, sac: null };
    for (const id of given) {
      const p = byId.get(id);
      if (p && !start[slotOf(p)]) start[slotOf(p)] = p.id;
    }
    // Kode complète la base autour des pièces données : bas, haut (sauf avec une robe), chaussures.
    if (!start.bas) start.bas = pools.bas.find((p) => p.category === 'bas')?.id ?? pools.bas[0]?.id ?? null;
    const dress = start.bas ? byId.get(start.bas)?.category === 'robes' : false;
    if (!start.haut && !dress) start.haut = pools.haut[0]?.id ?? null;
    if (!start.chaussures) start.chaussures = pools.chaussures[0]?.id ?? null;
    return start;
  });
  // Les pièces de départ sont gardées : « Mélanger » ne les touche pas.
  const [locked, setLocked] = useState<Set<SlotId>>(() => new Set(given.map((id) => byId.get(id)).filter(Boolean).map((p) => slotOf(p as Piece))));
  const [day, setDay] = useState(params?.day ?? 1);
  const [picking, setPicking] = useState<SlotId | null>(null);
  const chosen = SLOTS.map((sl) => (slots[sl.id] ? byId.get(slots[sl.id]!) : undefined)).filter(Boolean) as Piece[];

  const step = (id: SlotId, dir: -1 | 1) => {
    // La rangée tourne sur ses pièces, avec une case « sans » pour laisser l'emplacement vide.
    const seq = [null, ...pools[id].map((p) => p.id)];
    const i = seq.indexOf(slots[id]);
    const next = seq[(i + dir + seq.length) % seq.length];
    setSlots({ ...slots, [id]: next, ...(id === 'bas' && next && byId.get(next)?.category === 'robes' ? { haut: null } : {}) });
  };

  const shuffle = () => {
    const next = { ...slots };
    const dress = chosen.some((p) => p.category === 'robes' && locked.has('bas'));
    for (const sl of SLOTS) {
      if (locked.has(sl.id)) continue;
      if (sl.id === 'haut' && dress) continue;
      const pool = pools[sl.id].filter((p) => p.id !== slots[sl.id] && (sl.id !== 'bas' || p.category === 'bas' || !next.haut));
      // Parmi les trois qui dorment le plus, une au hasard : Kode varie sans oublier la rotation.
      const pick = pool.slice(0, 3)[Math.floor(Math.random() * Math.min(3, pool.length))];
      if (pick && (sl.id !== 'veste' && sl.id !== 'sac' ? true : Math.random() < 0.6)) next[sl.id] = pick.id;
    }
    setSlots(next);
    a.toast('Kode a mélangé la tenue');
  };

  const save = () => {
    a.plan(day, { title: chosen.length ? `Avec ${chosen[0].name.toLowerCase()}` : 'Ma tenue', pieces: chosen.map((p) => p.id) });
    a.toast(`Tenue prévue ${day === 0 ? 'pour aujourd’hui' : day === 1 ? 'pour demain' : `pour ${relativeDay(day).toLowerCase()}`}`);
    nav.goBack();
  };

  const slot = SLOTS.find((x) => x.id === picking);
  const options = slot ? pools[slot.id] : [];
  const W = width - space.gutter * 2;
  const big = Math.min(150, Math.round(W * 0.42));
  const side = Math.round((W - big - 20) / 2);

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-compose">
      <Ambient />
      <StackHeader title="Habille-moi" />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 12 }}>
        {SLOTS.map((sl) => {
          const seq = [null, ...pools[sl.id].map((p) => p.id)];
          const i = Math.max(0, seq.indexOf(slots[sl.id]));
          const prev = seq.length > 1 ? seq[(i - 1 + seq.length) % seq.length] : undefined;
          const next = seq.length > 1 ? seq[(i + 1) % seq.length] : undefined;
          const cur = slots[sl.id] ? byId.get(slots[sl.id]!) : undefined;
          const keep = locked.has(sl.id);
          const neighbour = (id: string | null | undefined, dir: -1 | 1) => {
            if (id === undefined) return <View style={{ width: side }} />;
            const p = id ? byId.get(id) : undefined;
            return (
              <Tap testID={`slot-${sl.id}-${dir > 0 ? 'next' : 'prev'}`} onPress={() => step(sl.id, dir)} accessibilityLabel={p ? `${sl.label} : prendre ${p.name}` : `${sl.label} : sans`} scaleTo={0.95} style={{ width: side, height: 104, borderRadius: 22, backgroundColor: c.stage, opacity: 0.5, alignItems: 'center', justifyContent: 'center' }}>
                {p ? <Garment kind={p.kind} tint={p.tint} image={p.image} size={side * 0.56} dark={scheme === 'dark'} label={p.name} /> : <T v="kicker" tone="ink2">sans</T>}
              </Tap>
            );
          };
          return (
            <View key={sl.id} accessibilityLabel={sl.label} className="flex-row items-center justify-between" style={{ height: 132 }}>
              {neighbour(prev, -1)}
              <Tap
                testID={`slot-${sl.id}`}
                onPress={() => setPicking(sl.id)}
                accessibilityLabel={cur ? `${sl.label} : ${cur.name}. Changer` : `${sl.label} : vide. Choisir`}
                scaleTo={0.97}
                style={{ width: big, height: 132, borderRadius: 22, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center', borderWidth: keep ? 1.5 : 0, borderColor: c.ink }}
              >
                {cur ? (
                  <Garment kind={cur.kind} tint={cur.tint} image={cur.image} size={big * 0.6} dark={scheme === 'dark'} label={cur.name} />
                ) : pools[sl.id].length ? (
                  <T v="kicker" tone="ink2">{`Sans ${sl.label.toLowerCase()}`}</T>
                ) : (
                  <View className="items-center" style={{ gap: 6 }}>
                    <Icon name="plus" size={20} color={c.ink2} />
                    <T v="kicker" tone="ink2">{sl.label}</T>
                  </View>
                )}
                {cur && (
                  <View style={{ position: 'absolute', top: 0, right: 0 }}>
                    <Tap
                      testID={`lock-${sl.id}`}
                      onPress={() => setLocked((prevSet) => { const n = new Set(prevSet); if (n.has(sl.id)) n.delete(sl.id); else n.add(sl.id); return n; })}
                      feedback="select"
                      accessibilityRole="switch"
                      accessibilityState={{ checked: keep }}
                      accessibilityLabel={keep ? `Libérer : ${cur.name}` : `Garder : ${cur.name}`}
                      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: keep ? c['primary-bg'] : c['glass-strong'] }}>
                        <Icon name="lock" size={14} color={keep ? c['primary-fg'] : c.ink} strokeWidth={2} />
                      </View>
                    </Tap>
                  </View>
                )}
              </Tap>
              {neighbour(next, 1)}
            </View>
          );
        })}

        <Animated.View key={advice(chosen)} entering={FadeIn.duration(220)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingTop: 4 }}>
          <Icon name="kode" size={16} color={c.ink} />
          <T v="caption" tone="ink2" style={{ flex: 1 }}>
            {advice(chosen)}
          </T>
        </Animated.View>

        <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <Chip key={i} testID={`day-${i}`} label={relativeDay(i)} on={day === i} onPress={() => setDay(i)} />
          ))}
        </Animated.ScrollView>
        {s.planned[day] && (
          <T v="caption" tone="caution">
            Elle remplacera « {s.planned[day].title} ».
          </T>
        )}

        <View style={{ gap: 8, paddingTop: 4 }}>
          <Button testID="compose-save" label={chosen.length < 2 ? 'Choisis au moins deux pièces' : `Prévoir pour ${relativeDay(day).toLowerCase()}`} disabled={chosen.length < 2} onPress={save} />
          <Button testID="compose-complete" label="Mélanger" variant="secondary" icon="kode" onPress={shuffle} />
        </View>
      </Animated.ScrollView>

      <Sheet visible={!!slot} onClose={() => setPicking(null)} kicker="Emplacement" title={slot?.label ?? ''} testID="slot-sheet">
        {options.length === 0 && (
          <EmptyState
            title="Rien ici pour l’instant"
            body="Ajoute une pièce de cette catégorie : elle apparaîtra ici."
            action={<Button testID="slot-add" label="Ajouter une pièce" size="m" icon="plus" onPress={() => { setPicking(null); nav.navigate('AddPiece'); }} />}
          />
        )}
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {options.map((p) => {
            const on = slot && slots[slot.id] === p.id;
            const w = (width - space.gutter * 2 - 20) / 3;
            return (
              <Tap
                key={p.id}
                testID={`pick-${p.id}`}
                onPress={() => {
                  setSlots({ ...slots, [slot!.id]: p.id, ...(slot!.id === 'bas' && p.category === 'robes' ? { haut: null } : {}) });
                  setPicking(null);
                }}
                accessibilityLabel={p.name}
                accessibilityState={{ selected: !!on }}
                style={{ width: w }}
              >
                <View className="items-center justify-center" style={{ height: w * 1.1, borderRadius: 18, backgroundColor: c.stage, borderWidth: on ? 2 : 0, borderColor: c.ink }}>
                  <Garment kind={p.kind} tint={p.tint} image={p.image} size={w * 0.66} dark={scheme === 'dark'} label={p.name} />
                </View>
                <T v="small" numberOfLines={1} style={{ marginTop: 4 }}>
                  {p.name}
                </T>
              </Tap>
            );
          })}
        </View>
        {slot && slots[slot.id] && (
          <View style={{ marginTop: 14 }}>
            <Button label="Vider l’emplacement" variant="secondary" size="m" onPress={() => { setSlots({ ...slots, [slot.id]: null }); setPicking(null); }} />
          </View>
        )}
      </Sheet>
    </View>
  );
}
