import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { precision, useStore, type MeasureId } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Stepper } from '../ui/controls';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { Card, Ring, Row } from '../ui/bits';
import { Sheet } from '../ui/Sheet';
import { SILHOUETTES, SilhouetteShape } from '../ui/SilhouetteShape';

export const MEASURES: { id: MeasureId; label: string; your: string; unit: string; min: number; max: number; start: number; gain: number }[] = [
  { id: 'hauteur', label: 'Taille (hauteur)', your: 'ta taille', unit: 'cm', min: 140, max: 200, start: 165, gain: 10 },
  { id: 'poitrine', label: 'Tour de poitrine', your: 'ton tour de poitrine', unit: 'cm', min: 70, max: 140, start: 90, gain: 12 },
  { id: 'taille', label: 'Tour de taille', your: 'ton tour de taille', unit: 'cm', min: 50, max: 130, start: 72, gain: 12 },
  { id: 'hanches', label: 'Tour de hanches', your: 'ton tour de hanches', unit: 'cm', min: 70, max: 150, start: 98, gain: 12 },
  { id: 'pointure', label: 'Pointure', your: 'ta pointure', unit: '', min: 34, max: 44, start: 38, gain: 4 },
];

export function SilhouetteScreen() {
  const { s, a } = useStore();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const [edit, setEdit] = useState<MeasureId | null>(null);
  const [value, setValue] = useState(0);
  const score = precision(s);
  const next = MEASURES.filter((m) => !s.measures[m.id]).sort((x, z) => z.gain - x.gain)[0];
  const m = MEASURES.find((x) => x.id === edit);

  const open = (id: MeasureId) => {
    const def = MEASURES.find((x) => x.id === id)!;
    setValue(s.measures[id] ?? def.start);
    setEdit(id);
  };

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-silhouette">
      <StackHeader title="Ma silhouette" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 22 }}>
        <View style={{ gap: 8 }}>
          <T v="kicker" tone="ink2" upper>
            Ma silhouette
          </T>
          <T v="title" accessibilityRole="header">
            Ce qui aide Kode{'\n'}
            <T v="title" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }}>
              à viser juste.
            </T>
          </T>
          <T v="body" tone="ink2">
            Tout est facultatif, et reste sur ton compte : rien n’est partagé, rien n’est jugé.
          </T>
        </View>

        <Card className="flex-row items-center" style={{ gap: 18 }}>
          <Ring value={score} size={96}>
            <T v="cardTitle" style={{ fontSize: 26 }}>
              {score} %
            </T>
          </Ring>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="bodyStrong">Précision de Kode</T>
            <T v="caption" tone="ink2">
              {next ? `Ajoute ${next.your} : +${next.gain} %.` : 'Kode a tout ce qu’il lui faut.'}
            </T>
            {next && (
              <T testID="silhouette-next" v="caption" onPress={() => open(next.id)} accessibilityRole="button" style={{ fontFamily: 'HankenGrotesk_600SemiBold', paddingVertical: 12, textDecorationLine: 'underline' }}>
                L’ajouter
              </T>
            )}
          </View>
        </Card>

        <View style={{ gap: 12 }}>
          <T v="kicker" tone="ink2" upper>
            Ta silhouette
          </T>
          <View className="flex-row" style={{ gap: 8 }}>
            {SILHOUETTES.map((x) => {
              const on = s.silhouette === x.id;
              return (
                <Tap key={x.id} testID={`sil-${x.id}`} onPress={() => a.setSilhouette(on ? null : x.id)} feedback="select" accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`En ${x.id} : ${x.note}`} outerStyle={{ flex: 1 }} style={{ alignItems: 'center', paddingVertical: 12, borderRadius: 18, borderWidth: on ? 2 : 1, borderColor: on ? c.ink : c.rule, gap: 6 }}>
                  <SilhouetteShape id={x.id} size={30} color={c.ink} fill={on ? c.sunk : 'transparent'} />
                  <T v="bodyStrong">{x.id}</T>
                </Tap>
              );
            })}
          </View>
          <T v="caption" tone="ink2">
            {s.silhouette && s.silhouette !== 'inconnue' ? SILHOUETTES.find((x) => x.id === s.silhouette)?.note : 'Un doute ? Laisse vide : Kode apprendra de ce que tu portes.'}
          </T>
        </View>

        <View>
          <T v="kicker" tone="ink2" upper style={{ marginBottom: 4 }}>
            Tes mesures
          </T>
          {MEASURES.map((x, i) => (
            <Row key={x.id} testID={`measure-${x.id}`} title={x.label} detail={s.measures[x.id] ? `${s.measures[x.id]} ${x.unit}`.trim() : `Ajouter · +${x.gain} % de précision`} onPress={() => open(x.id)} last={i === MEASURES.length - 1} />
          ))}
        </View>
      </Animated.ScrollView>

      <Sheet
        visible={!!m}
        onClose={() => setEdit(null)}
        kicker="Mesure"
        title={m?.label ?? ''}
        testID="measure-sheet"
        footer={
          <View className="flex-row" style={{ gap: 8 }}>
            {m && s.measures[m.id] ? <Button label="Effacer" variant="secondary" grow onPress={() => { a.setMeasure(m.id, undefined); setEdit(null); }} /> : null}
            <Button testID="measure-save" label="Enregistrer" grow onPress={() => { if (m) a.setMeasure(m.id, value); setEdit(null); }} />
          </View>
        }
      >
        {m && (
          <View className="items-center" style={{ gap: 12, paddingVertical: 8 }}>
            <Stepper value={value} onChange={setValue} min={m.min} max={m.max} unit={m.unit || 'EU'} label={m.label} />
            <T v="caption" tone="ink2" style={{ textAlign: 'center' }}>
              Mesure prise à même la peau, mètre ruban souple, sans serrer.
            </T>
          </View>
        )}
      </Sheet>
    </View>
  );
}
