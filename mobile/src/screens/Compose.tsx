import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
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
import { Card, EmptyState } from '../ui/bits';
import { OutfitBoard, Legend, boardHeight } from '../ui/outfit';
import { Garment } from '../ui/Garment';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import type { Nav, Route } from '../navigation/types';
import { F } from '../theme/fonts';

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

export function Compose() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route<'Compose'>>();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { width } = useScreen();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const byId = useMemo(() => new Map(s.pieces.map((p) => [p.id, p])), [s.pieces]);

  const [slots, setSlots] = useState<Record<SlotId, string | null>>(() => {
    const start: Record<SlotId, string | null> = { veste: null, haut: null, bas: null, chaussures: null, sac: null };
    const ids = [...(params?.pieces ?? []), ...(params?.with ? [params.with] : [])];
    for (const id of ids) {
      const p = byId.get(id);
      if (p && !start[slotOf(p)]) start[slotOf(p)] = p.id;
    }
    return start;
  });
  const [day, setDay] = useState(params?.day ?? 1);
  const [picking, setPicking] = useState<SlotId | null>(null);
  const chosen = SLOTS.map((sl) => (slots[sl.id] ? byId.get(slots[sl.id]!) : undefined)).filter(Boolean) as Piece[];
  const W = width - space.gutter * 2;
  const tile = (W - 4 * 8) / 5;

  const complete = () => {
    const next = { ...slots };
    const dress = chosen.some((p) => p.category === 'robes');
    for (const sl of SLOTS) {
      if (next[sl.id]) continue;
      if (sl.id === 'haut' && dress) continue;
      // La pièce la moins portée de l'emplacement : Kode fait tourner le dressing.
      const pool = s.pieces.filter((p) => sl.cats.includes(p.category) && (sl.id !== 'bas' || p.category === 'bas' || !next.haut));
      const pick = [...pool].sort((x, z) => (z.lastWorn ?? 999) - (x.lastWorn ?? 999))[Math.min(1, pool.length - 1)];
      if (pick) next[sl.id] = pick.id;
    }
    setSlots(next);
    a.toast('Kode a complété la tenue');
  };

  const save = () => {
    a.plan(day, { title: chosen.length ? `Avec ${chosen[0].name.toLowerCase()}` : 'Ma tenue', pieces: chosen.map((p) => p.id) });
    a.toast(`Tenue prévue ${day === 0 ? 'pour aujourd’hui' : day === 1 ? 'pour demain' : `pour ${relativeDay(day).toLowerCase()}`}`);
    nav.goBack();
  };

  const slot = SLOTS.find((x) => x.id === picking);
  const options = slot ? s.pieces.filter((p) => slot.cats.includes(p.category)) : [];

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-compose">
      <Ambient />
      <StackHeader title="Composer une tenue" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 20 }}>
        <View style={{ gap: 6 }}>
          <T v="kicker" tone="ink2">
            La planche
          </T>
          <T v="title" accessibilityRole="header">
            Compose,{'\n'}
            <T v="title" style={{ ...F.accent }}>
              Kode ajuste.
            </T>
          </T>
        </View>

        <Animated.View layout={LinearTransition.springify().damping(20)} className="bg-stage" style={{ borderRadius: 28, padding: 16, gap: 12 }}>
          {chosen.length ? (
            <>
              <OutfitBoard pieces={chosen} width={W - 32} frame={false} onPiece={(p) => setPicking(slotOf(p))} />
              <Legend pieces={chosen} />
            </>
          ) : (
            <View style={{ height: boardHeight(W - 32) * 0.6 }} className="items-center justify-center">
              <T v="body" tone="ink2" style={{ textAlign: 'center' }}>
                Ta planche est vide.{'\n'}Touche un emplacement pour commencer.
              </T>
            </View>
          )}
        </Animated.View>

        <View className="flex-row" style={{ gap: 8 }}>
          {SLOTS.map((sl) => {
            const p = slots[sl.id] ? byId.get(slots[sl.id]!) : undefined;
            return (
              <Tap key={sl.id} testID={`slot-${sl.id}`} onPress={() => setPicking(sl.id)} accessibilityLabel={p ? `${sl.label} : ${p.name}. Changer` : `${sl.label} : vide. Choisir`} style={{ width: tile, gap: 6, alignItems: 'center' }}>
                <View
                  style={{ width: tile, height: tile * 1.2, borderRadius: 16, borderWidth: p ? 0 : 1.5, borderStyle: 'dashed', borderColor: c.control, backgroundColor: p ? c.raised : 'transparent' }}
                  className="items-center justify-center"
                >
                  {p ? <Garment kind={p.kind} tint={p.tint} image={p.image} size={tile * 0.78} dark={scheme === 'dark'} label={p.name} /> : <Icon name="plus" size={20} color={c.ink2} />}
                </View>
                <T v="small" tone={p ? 'ink' : 'ink2'} numberOfLines={1} style={{ textAlign: 'center' }}>
                  {sl.label}
                </T>
              </Tap>
            );
          })}
        </View>

        <Animated.View key={advice(chosen)} entering={FadeIn.duration(220)}>
          <Card className="bg-sunk" style={{ gap: 10 }}>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Icon name="kode" size={18} color={c.brass} />
              <T v="kicker" tone="ink2">
                Kode
              </T>
            </View>
            <T v="bodyL">{advice(chosen)}</T>
            {chosen.length < 5 && <Button testID="compose-complete" label="Compléter avec Kode" variant="secondary" size="m" icon="kode" onPress={complete} />}
          </Card>
        </Animated.View>

        <View style={{ gap: 10 }}>
          <T v="kicker" tone="ink2">
            Pour quand ?
          </T>
          <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
            {Array.from({ length: 7 }, (_, i) => (
              <Chip key={i} testID={`day-${i}`} label={relativeDay(i)} on={day === i} onPress={() => setDay(i)} />
            ))}
          </Animated.ScrollView>
          {s.planned[day] && (
            <T v="caption" tone="caution">
              Elle remplacera « {s.planned[day].title} », déjà prévue ce jour-là.
            </T>
          )}
        </View>

        <Button testID="compose-save" label={chosen.length < 2 ? 'Choisis au moins deux pièces' : `Prévoir pour ${relativeDay(day).toLowerCase()}`} disabled={chosen.length < 2} onPress={save} />
      </Animated.ScrollView>

      <Sheet visible={!!slot} onClose={() => setPicking(null)} kicker="Emplacement" title={slot?.label ?? ''} testID="slot-sheet">
        {options.length === 0 && (
          <EmptyState
            title="Rien ici pour l’instant"
            body="Ajoute une pièce de cette catégorie : elle apparaîtra dans cet emplacement."
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
                <View className="items-center justify-center" style={{ height: w * 1.1, borderRadius: 16, backgroundColor: c.paper, borderWidth: on ? 2 : 0, borderColor: c.ink }}>
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
