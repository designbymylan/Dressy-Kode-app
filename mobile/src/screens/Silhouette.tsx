import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLOR_CHOICES } from '../data/wardrobe';
import { STYLE_CARDS, nextBestAnswer, precision, sizeOptions, type MeasureId, type Profile } from '../state/profile';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Chip, Stepper } from '../ui/controls';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { Card, Ring, Row } from '../ui/bits';
import { Sheet } from '../ui/Sheet';
import { SILHOUETTES, SilhouetteShape } from '../ui/SilhouetteShape';
import { ColorChoice, MeasureFigure, Ruler } from '../ui/onboarding';
import { useScreen } from '../ui/screen';

type Edit = 'taille' | 'poids' | 'silhouette' | MeasureId | 'haut' | 'bas' | 'pointure' | 'styles' | 'couleurs' | null;

const MEASURES: { id: MeasureId; label: string; min: number; max: number; start: number }[] = [
  { id: 'poitrine', label: 'Tour de poitrine', min: 70, max: 140, start: 90 },
  { id: 'taille', label: 'Tour de taille', min: 50, max: 130, start: 72 },
  { id: 'hanches', label: 'Tour de hanches', min: 70, max: 150, start: 98 },
];

/** Moi › Ma silhouette : tout ce que l'onboarding a demandé, modifiable à tout moment. */
export function SilhouetteScreen() {
  const { s, a } = useStore();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { width } = useScreen();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const p = s.profile;
  const [edit, setEdit] = useState<Edit>(null);
  const [num, setNum] = useState(0);
  const score = precision(p);
  const next = nextBestAnswer(p);
  const set = (patch: Partial<Profile>) => a.setProfile(patch);
  const sizes = sizeOptions(p.rayon);
  const W = width - space.gutter * 2;

  const open = (e: Edit, value?: number) => {
    if (value !== undefined) setNum(value);
    setEdit(e);
  };
  const m = MEASURES.find((x) => x.id === edit);

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
            Tout est facultatif et reste sur ton compte : rien n’est partagé, rien n’est jugé.
          </T>
        </View>

        <Card className="flex-row items-center" style={{ gap: 18 }}>
          <Ring value={score} size={92}>
            <T v="cardTitle" style={{ fontSize: 25 }}>
              {score} %
            </T>
          </Ring>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="bodyStrong">Précision de Kode</T>
            <T v="caption" tone="ink2">
              {next ? `Ajoute ${next.label} : +${next.gain} %.` : 'Kode a tout ce qu’il lui faut.'}
            </T>
          </View>
        </Card>

        <View>
          <T v="kicker" tone="ink2" upper style={{ marginBottom: 2 }}>
            Ton corps
          </T>
          <Row testID="sil-taille" title="Taille" detail={p.height ? `${p.height} cm` : 'Ajouter · +10 %'} onPress={() => open('taille', p.height ?? 165)} />
          <Row testID="sil-poids" title="Poids" detail={p.weight ? `${p.weight} kg · visible par toi seulement` : 'Facultatif · +5 %'} onPress={() => open('poids', p.weight ?? 60)} />
          <Row
            testID="sil-silhouette"
            title="Silhouette"
            detail={p.silhouette && p.silhouette !== 'inconnue' ? `En ${p.silhouette}${p.silhouetteSource === 'photos' ? ' · estimée sur photos' : ' · choisie'}` : 'Ajouter · +20 %'}
            onPress={() => open('silhouette')}
            last
          />
        </View>

        <View>
          <T v="kicker" tone="ink2" upper style={{ marginBottom: 2 }}>
            Tes mesures
          </T>
          {MEASURES.map((x, i) => (
            <Row key={x.id} testID={`measure-${x.id}`} title={x.label} detail={p.measures[x.id] ? `${p.measures[x.id]} cm` : 'Ajouter · +8 %'} onPress={() => open(x.id, p.measures[x.id] ?? x.start)} last={i === MEASURES.length - 1} />
          ))}
        </View>

        <View>
          <T v="kicker" tone="ink2" upper style={{ marginBottom: 2 }}>
            Tes tailles
          </T>
          <Row testID="sil-haut" title="Hauts" detail={p.sizes.haut ?? 'Ajouter'} onPress={() => open('haut')} />
          <Row testID="sil-bas" title="Bas" detail={p.sizes.bas ?? 'Ajouter'} onPress={() => open('bas')} />
          <Row testID="sil-pointure" title="Pointure" detail={p.sizes.pointure ?? 'Ajouter'} onPress={() => open('pointure')} last />
        </View>

        <View>
          <T v="kicker" tone="ink2" upper style={{ marginBottom: 2 }}>
            Ton style
          </T>
          <Row testID="sil-styles" title="Styles" detail={p.styles.length ? p.styles.join(', ') : 'Ajouter'} onPress={() => open('styles')} />
          <Row testID="sil-couleurs" title="Couleurs" detail={[p.love.length ? `Aime : ${p.love.join(', ')}` : '', p.avoid.length ? `Évite : ${p.avoid.join(', ')}` : ''].filter(Boolean).join(' · ') || 'Ajouter'} onPress={() => open('couleurs')} last />
        </View>
      </Animated.ScrollView>

      <Sheet visible={edit === 'taille' || edit === 'poids'} onClose={() => setEdit(null)} kicker="Ton corps" title={edit === 'poids' ? 'Poids' : 'Taille'} testID="body-sheet"
        footer={
          <View className="flex-row" style={{ gap: 8 }}>
            {edit === 'poids' && p.weight !== null && <Button label="Effacer" variant="secondary" grow onPress={() => { set({ weight: null }); setEdit(null); }} />}
            <Button testID="body-save" label="Enregistrer" grow onPress={() => { set(edit === 'poids' ? { weight: num } : { height: num }); setEdit(null); }} />
          </View>
        }
      >
        {(edit === 'taille' || edit === 'poids') && (
          <View style={{ gap: 10 }}>
            <Ruler value={num} onChange={setNum} min={edit === 'poids' ? 35 : 140} max={edit === 'poids' ? 160 : 205} unit={edit === 'poids' ? 'kg' : 'cm'} label={edit === 'poids' ? 'Ton poids' : 'Ta taille'} width={W} />
            {edit === 'poids' && (
              <T v="caption" tone="ink2">
                Il sert uniquement à ajuster les coupes. Jamais affiché ailleurs qu’ici, jamais partagé.
              </T>
            )}
          </View>
        )}
      </Sheet>

      <Sheet visible={edit === 'silhouette'} onClose={() => setEdit(null)} kicker="Ton corps" title="Silhouette" testID="shape-sheet">
        <View style={{ gap: 8 }}>
          <View className="flex-row" style={{ gap: 8 }}>
            {SILHOUETTES.map((x) => {
              const on = p.silhouette === x.id;
              return (
                <Tap key={x.id} testID={`sil-${x.id}`} onPress={() => set({ silhouette: x.id, silhouetteSource: 'choix' })} feedback="select" accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`En ${x.id} : ${x.note}`} outerStyle={{ flex: 1 }} style={{ alignItems: 'center', paddingVertical: 12, borderRadius: 18, borderWidth: on ? 2 : 1, borderColor: on ? c.ink : c.rule, gap: 6 }}>
                  <SilhouetteShape id={x.id} size={30} color={c.ink} fill={on ? c.sunk : 'transparent'} />
                  <T v="bodyStrong">{x.id}</T>
                </Tap>
              );
            })}
          </View>
          <T v="caption" tone="ink2">
            {p.silhouette && p.silhouette !== 'inconnue' ? SILHOUETTES.find((x) => x.id === p.silhouette)?.note : 'Un doute ? Laisse vide : Kode apprendra de ce que tu portes.'}
          </T>
          <T v="small" tone="ink2">
            L’analyse par photos se relance depuis l’app : deux photos, supprimées juste après.
          </T>
        </View>
      </Sheet>

      <Sheet visible={!!m} onClose={() => setEdit(null)} kicker="Mesure" title={m?.label ?? ''} testID="measure-sheet"
        footer={
          <View className="flex-row" style={{ gap: 8 }}>
            {m && p.measures[m.id] ? <Button label="Effacer" variant="secondary" grow onPress={() => { const rest = { ...p.measures }; delete rest[m.id]; set({ measures: rest }); setEdit(null); }} /> : null}
            <Button testID="measure-save" label="Enregistrer" grow onPress={() => { if (m) set({ measures: { ...p.measures, [m.id]: num } }); setEdit(null); }} />
          </View>
        }
      >
        {m && (
          <View className="flex-row items-center" style={{ gap: 16 }}>
            <MeasureFigure active={m.id} done={p.measures} height={150} />
            <View style={{ flex: 1, gap: 10, alignItems: 'center' }}>
              <Stepper value={num} onChange={setNum} min={m.min} max={m.max} unit="cm" label={m.label} />
              <T v="caption" tone="ink2" style={{ textAlign: 'center' }}>
                Mètre ruban souple, à même la peau, sans serrer.
              </T>
            </View>
          </View>
        )}
      </Sheet>

      <Sheet visible={edit === 'haut' || edit === 'bas' || edit === 'pointure'} onClose={() => setEdit(null)} kicker="Tes tailles" title={edit === 'haut' ? 'Hauts' : edit === 'bas' ? 'Bas' : 'Pointure'} testID="size-sheet">
        {(edit === 'haut' || edit === 'bas' || edit === 'pointure') && (
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {sizes[edit].map((v) => (
              <Chip key={v} label={v} on={p.sizes[edit] === v} onPress={() => { set({ sizes: { ...p.sizes, [edit]: p.sizes[edit] === v ? undefined : v } }); setEdit(null); }} />
            ))}
          </View>
        )}
      </Sheet>

      <Sheet visible={edit === 'styles'} onClose={() => setEdit(null)} kicker="Ton style" title="1 à 3 styles" testID="styles-sheet">
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {STYLE_CARDS.map((x) => {
            const on = p.styles.includes(x.name);
            return <Chip key={x.name} label={x.name} on={on} onPress={() => set({ styles: on ? p.styles.filter((n) => n !== x.name) : p.styles.length >= 3 ? p.styles : [...p.styles, x.name] })} />;
          })}
        </View>
      </Sheet>

      <Sheet visible={edit === 'couleurs'} onClose={() => setEdit(null)} kicker="Ton style" title="Couleurs" testID="colors-sheet">
        <T v="caption" tone="ink2" style={{ marginBottom: 12 }}>
          Une touche : tu aimes. Deux : tu évites. Trois : on oublie.
        </T>
        <View className="flex-row flex-wrap" style={{ rowGap: 14 }}>
          {COLOR_CHOICES.map((x) => {
            const st = p.love.includes(x.name) ? 'aime' : p.avoid.includes(x.name) ? 'evite' : null;
            return (
              <ColorChoice
                key={x.name}
                name={x.name}
                hex={x.hex}
                state={st}
                onPress={() => {
                  const love = p.love.filter((n) => n !== x.name);
                  const avoid = p.avoid.filter((n) => n !== x.name);
                  set(st === null ? { love: [...love, x.name], avoid } : st === 'aime' ? { love, avoid: [...avoid, x.name] } : { love, avoid });
                }}
                width={W / 4}
              />
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}
