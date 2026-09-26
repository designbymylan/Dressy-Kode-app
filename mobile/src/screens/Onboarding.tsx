import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, SlideInRight, SlideOutLeft, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLOR_CHOICES, STYLES } from '../data/wardrobe';
import { precision, useStore, type MeasureId, type Silhouette } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { motion, space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button, IconButton } from '../ui/Button';
import { Chip, Stepper, Swatch } from '../ui/controls';
import { Ring } from '../ui/bits';
import { SILHOUETTES, SilhouetteShape } from '../ui/SilhouetteShape';
import { MEASURES } from './Silhouette';
import type { Nav } from '../navigation/types';

const TITLES = [
  { kicker: 'Étape 1 sur 3', lead: 'Ta silhouette,\n', em: 'si tu veux.' },
  { kicker: 'Étape 2 sur 3', lead: 'Quelques mesures,\n', em: 'facultatives.' },
  { kicker: 'Étape 3 sur 3', lead: 'Ce que tu aimes\n', em: 'porter.' },
];

/**
 * Trois écrans, pas un de plus (la cible abandonne les onboardings longs).
 * Chaque étape se passe ; rien n'est obligatoire, et la précision de Kode
 * montre ce que chaque réponse apporte, sans culpabiliser.
 */
export function Onboarding() {
  const { a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [step, setStep] = useState(0);
  const [silhouette, setSilhouette] = useState<Silhouette | null>(null);
  const [measures, setMeasures] = useState<Partial<Record<MeasureId, number>>>({});
  const [styles, setStyles] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const score = precision({ silhouette, measures, styles, colors });

  const finish = () => a.completeOnboarding({ silhouette, measures, styles, colors });
  const next = () => (step < 2 ? setStep(step + 1) : finish());
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const t = TITLES[step];

  return (
    <View className="bg-paper" style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }} testID="screen-onboarding">
      <View className="flex-row items-center" style={{ paddingHorizontal: 12, gap: 8 }}>
        <IconButton testID="onb-back" icon="back" label={step ? 'Étape précédente' : 'Retour'} variant="plain" onPress={() => (step ? setStep(step - 1) : nav.goBack())} />
        <View className="flex-row" style={{ flex: 1, gap: 6 }} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 3, now: step + 1 }}>
          {[0, 1, 2].map((i) => (
            <Bar key={i} on={i <= step} />
          ))}
        </View>
        <T testID="onb-skip" v="bodyStrong" onPress={next} accessibilityRole="button" style={{ paddingHorizontal: 10, paddingVertical: 12 }}>
          Passer
        </T>
      </View>

      <Animated.ScrollView key={step} entering={SlideInRight.springify().damping(22)} exiting={SlideOutLeft.duration(160)} contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 20, paddingBottom: 24, gap: 20 }}>
        <View style={{ gap: 6 }}>
          <T v="kicker" tone="ink2" upper>
            {t.kicker}
          </T>
          <T v="title" accessibilityRole="header">
            {t.lead}
            <T v="title" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }}>
              {t.em}
            </T>
          </T>
        </View>

        {step === 0 && (
          <View style={{ gap: 10 }}>
            <T v="body" tone="ink2">
              Elle aide Kode à choisir les coupes. Aucune n’est meilleure qu’une autre.
            </T>
            {SILHOUETTES.map((x) => {
              const on = silhouette === x.id;
              return (
                <Tap key={x.id} testID={`onb-sil-${x.id}`} onPress={() => setSilhouette(on ? null : x.id)} feedback="select" accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`En ${x.id} : ${x.note}`} scaleTo={0.99} className="flex-row items-center" style={{ gap: 14, padding: 10, paddingRight: 16, borderRadius: 20, borderWidth: on ? 2 : 1, borderColor: on ? c.ink : c.rule }}>
                  <View className="bg-sunk items-center justify-center" style={{ width: 52, height: 64, borderRadius: 14 }}>
                    <SilhouetteShape id={x.id} size={30} color={c.ink} fill={on ? c.raised : 'transparent'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">En {x.id}</T>
                    <T v="caption" tone="ink2">
                      {x.note}
                    </T>
                  </View>
                </Tap>
              );
            })}
            <Chip label="Je ne sais pas, Kode apprendra" on={silhouette === 'inconnue'} onPress={() => setSilhouette(silhouette === 'inconnue' ? null : 'inconnue')} testID="onb-sil-unknown" />
          </View>
        )}

        {step === 1 && (
          <View style={{ gap: 16 }}>
            <View className="flex-row items-center bg-raised" style={{ borderRadius: 22, padding: 14, gap: 14 }}>
              <Ring value={score} size={64} stroke={6}>
                <T v="bodyStrong">{score} %</T>
              </Ring>
              <T v="caption" tone="ink2" style={{ flex: 1 }}>
                Précision de Kode. Chaque mesure l’aide à viser juste — et elles restent privées.
              </T>
            </View>
            {MEASURES.map((m) => {
              const v = measures[m.id];
              return (
                <View key={m.id} className="flex-row items-center justify-between" style={{ minHeight: 56, borderBottomWidth: 1, borderColor: c.rule, gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">{m.label}</T>
                    <T v="small" tone="ink2">
                      +{m.gain} % de précision
                    </T>
                  </View>
                  {v === undefined ? (
                    <Button testID={`onb-add-${m.id}`} label="Ajouter" size="s" variant="quiet" icon="plus" onPress={() => setMeasures({ ...measures, [m.id]: m.start })} />
                  ) : (
                    <Stepper value={v} onChange={(n) => setMeasures({ ...measures, [m.id]: n })} min={m.min} max={m.max} unit={m.unit || 'EU'} label={m.label} />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 18 }}>
            <View style={{ gap: 10 }}>
              <T v="kicker" tone="ink2" upper>
                Tes styles
              </T>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {STYLES.map((x) => (
                  <Chip key={x} testID={`onb-style-${x}`} label={x} on={styles.includes(x)} onPress={() => setStyles(toggle(styles, x))} />
                ))}
              </View>
            </View>
            <View style={{ gap: 10 }}>
              <T v="kicker" tone="ink2" upper>
                Les couleurs que tu portes volontiers
              </T>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {COLOR_CHOICES.map((x) => (
                  <Swatch key={x.name} hex={x.hex} label={x.name} on={colors.includes(x.name)} onPress={() => setColors(toggle(colors, x.name))} />
                ))}
              </View>
              {colors.length > 0 && (
                <Animated.View entering={FadeIn}>
                  <T v="caption" tone="ink2">
                    {colors.join(', ')}
                  </T>
                </Animated.View>
              )}
            </View>
          </View>
        )}
      </Animated.ScrollView>

      <View style={{ paddingHorizontal: space.gutter, gap: 4 }}>
        <Button testID="onb-next" label={step < 2 ? 'Continuer' : 'Découvrir mon dressing'} onPress={next} />
      </View>
    </View>
  );
}

function Bar({ on }: { on: boolean }) {
  const style = useAnimatedStyle(() => ({ opacity: withSpring(on ? 1 : 0.25, motion.gentle) }));
  return <Animated.View className="bg-ink" style={[{ flex: 1, height: 3, borderRadius: 2 }, style]} />;
}
