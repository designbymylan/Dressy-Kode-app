import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CATEGORIES, type CategoryId, type Piece, type Season } from '../data/wardrobe';
import { pieceLimit, useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Chip } from '../ui/controls';
import { StackHeader, useStackTop } from '../ui/layout';
import { Card, Gauge, Skeleton } from '../ui/bits';
import { Garment, type GarmentKind } from '../ui/Garment';
import { Icon } from '../ui/Icon';
import { useScreen } from '../ui/screen';
import type { Nav } from '../navigation/types';

type Found = { kind: GarmentKind; tint: string; name: string; category: CategoryId; color: string; material: string; season: Season; backdrop: string };

/** La galerie simulée : ce que l'analyse « reconnaît » sur chaque photo. */
const GALLERY: Found[] = [
  { kind: 'cardigan', tint: '#B98B5E', name: 'Cardigan camel', category: 'hauts', color: 'Camel', material: 'Laine', season: 'mi-saison', backdrop: '#D9CFC2' },
  { kind: 'jupe', tint: '#2F3B52', name: 'Jupe plissée marine', category: 'bas', color: 'Marine', material: 'Crêpe', season: 'toute l’année', backdrop: '#C9CCD2' },
  { kind: 'chemise', tint: '#E3BFB7', name: 'Chemise rose poudré', category: 'hauts', color: 'Rose poudré', material: 'Coton', season: 'été', backdrop: '#E6DDD8' },
  { kind: 'robe', tint: '#C9A13B', name: 'Robe moutarde', category: 'robes', color: 'Moutarde', material: 'Viscose', season: 'été', backdrop: '#DAD3C4' },
  { kind: 'pantalon', tint: '#7B7F4F', name: 'Pantalon olive', category: 'bas', color: 'Olive', material: 'Coton', season: 'mi-saison', backdrop: '#D2D2C6' },
  { kind: 'bottines', tint: '#6E4A32', name: 'Bottines chocolat', category: 'chaussures', color: 'Chocolat', material: 'Daim', season: 'hiver', backdrop: '#D5CBC0' },
];

const STEPS = ['Détourage de la pièce', 'Type de pièce', 'Couleur dominante', 'Matière probable', 'Illustration pour tes portants'];

export function AddPiece() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { width } = useScreen();
  const top = useStackTop(true);
  const [found, setFound] = useState<Found | null>(null);
  const [phase, setPhase] = useState<'source' | 'analyse' | 'result'>('source');
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Found | null>(null);
  const limit = pieceLimit(s);
  const full = limit !== null && s.pieces.length >= limit;
  const tile = (width - space.gutter * 2 - 20) / 3;

  useEffect(() => {
    if (phase !== 'analyse') return;
    setStep(0);
    const timers = STEPS.map((_, i) => setTimeout(() => setStep(i + 1), 420 * (i + 1)));
    const done = setTimeout(() => setPhase('result'), 420 * STEPS.length + 350);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [phase]);

  const pick = (f: Found) => {
    setFound(f);
    setDraft(f);
    setPhase('analyse');
  };

  const add = () => {
    if (!draft) return;
    const piece: Piece = {
      id: `n${Date.now()}`,
      name: draft.name.trim() || 'Nouvelle pièce',
      kind: draft.kind,
      tint: draft.tint,
      category: draft.category,
      color: draft.color,
      swatch: draft.tint,
      material: draft.material,
      season: draft.season,
      wears: 0,
      lastWorn: null,
      addedDaysAgo: 0,
    };
    a.addPiece(piece);
    nav.goBack();
  };

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-add">
      <StackHeader title="Ajouter une pièce" close />
      <Animated.ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 18 }}>
        {phase === 'source' && (
          <Animated.View entering={FadeIn.duration(200)} style={{ gap: 18 }}>
            <View style={{ gap: 8 }}>
              <T v="title" accessibilityRole="header">
                Une photo suffit.
              </T>
              <T v="body" tone="ink2">
                Kode détoure ta pièce, la reconnaît et la dessine pour tes portants. Tu vérifies, c’est rangé.
              </T>
            </View>

            {limit !== null && (
              <View style={{ gap: 6 }}>
                <View className="flex-row justify-between">
                  <T v="caption" tone="ink2">
                    Places utilisées
                  </T>
                  <T v="caption" tone={full ? 'caution' : 'ink2'}>
                    {s.pieces.length} sur {limit}
                  </T>
                </View>
                <Gauge value={s.pieces.length} max={limit} label="Places utilisées dans le dressing" />
              </View>
            )}

            {full ? (
              <Card className="bg-caution-soft" style={{ gap: 10 }} testID="add-full">
                <T v="cardTitle">Ton dressing est plein.</T>
                <T v="body" tone="ink2">
                  Tu pourrais ajouter 30 places pour 4,99 €, une seule fois — ou passer à Atelier, jusqu’à 200 pièces.
                </T>
                <View className="flex-row" style={{ gap: 8 }}>
                  <Button label="+30 places · 4,99 €" size="m" grow onPress={a.buyPlaces} />
                  <Button label="Les offres" size="m" variant="secondary" grow onPress={() => nav.navigate('Offers')} />
                </View>
              </Card>
            ) : (
              <>
                <View className="flex-row" style={{ gap: 10 }}>
                  {[
                    { icon: 'camera' as const, label: 'Prendre une photo', note: 'Sur un cintre ou à plat' },
                    { icon: 'image' as const, label: 'Depuis la galerie', note: 'Jusqu’à 10 à la fois' },
                  ].map((o) => (
                    <Tap key={o.label} testID={`source-${o.icon}`} onPress={() => pick(GALLERY[o.icon === 'camera' ? 0 : 1])} accessibilityLabel={o.label} outerStyle={{ flex: 1 }} className="bg-raised" style={{ borderRadius: 22, padding: 16, gap: 18, minHeight: 128 }}>
                      <Icon name={o.icon} size={28} color={c.ink} />
                      <View style={{ gap: 2 }}>
                        <T v="bodyStrong">{o.label}</T>
                        <T v="small" tone="ink2">
                          {o.note}
                        </T>
                      </View>
                    </Tap>
                  ))}
                </View>
                <T v="kicker" tone="ink2" upper>
                  Photos récentes
                </T>
                <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                  {GALLERY.map((g, i) => (
                    <Tap key={g.name} testID={`photo-${i}`} onPress={() => pick(g)} accessibilityLabel={`Photo ${i + 1}`} style={{ width: tile, height: tile * 1.2, borderRadius: 14, backgroundColor: g.backdrop, overflow: 'hidden' }} className="items-center justify-center">
                      <View style={{ transform: [{ rotate: `${((i % 3) - 1) * 4}deg` }], opacity: 0.92 }}>
                        <Garment kind={g.kind} tint={g.tint} size={tile * 0.7} />
                      </View>
                    </Tap>
                  ))}
                </View>
                <T v="small" tone="ink2">
                  Tes photos servent seulement à dessiner la pièce. Elles ne sont ni publiées ni partagées.
                </T>
              </>
            )}
          </Animated.View>
        )}

        {phase === 'analyse' && found && (
          <Animated.View entering={FadeIn.duration(200)} style={{ gap: 20 }} accessibilityLiveRegion="polite">
            <T v="title">Kode regarde ta pièce…</T>
            <Scan found={found} width={width - space.gutter * 2} />
            <View style={{ gap: 10 }}>
              {STEPS.map((label, i) => (
                <View key={label} className="flex-row items-center" style={{ gap: 10, minHeight: 26 }}>
                  {step > i ? <Icon name="check" size={18} color={c.positive} strokeWidth={2.2} /> : <Skeleton w={18} h={18} r={9} />}
                  <T v="body" tone={step > i ? 'ink' : 'ink2'}>
                    {label}
                    {step > i && i === 1 ? ` : ${found.name.split(' ')[0].toLowerCase()}` : ''}
                    {step > i && i === 2 ? ` : ${found.color.toLowerCase()}` : ''}
                    {step > i && i === 3 ? ` : ${found.material.toLowerCase()}` : ''}
                  </T>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {phase === 'result' && draft && (
          <Animated.View entering={FadeInDown.duration(260)} style={{ gap: 18 }} testID="add-result">
            <View className="bg-stage items-center justify-center" style={{ height: 250, borderRadius: 28 }}>
              <Garment kind={draft.kind} tint={draft.tint} size={170} dark={scheme === 'dark'} label={draft.name} />
            </View>
            <View style={{ gap: 4 }}>
              <T v="kicker" tone="positive" upper>
                Reconnue avec confiance
              </T>
              <T v="body" tone="ink2">
                Vérifie la matière : c’est ce que Kode devine le moins bien sur une photo.
              </T>
            </View>
            <View style={{ gap: 8 }}>
              <T v="kicker" tone="ink2" upper>
                Nom
              </T>
              <TextInput
                testID="add-name"
                value={draft.name}
                onChangeText={(name) => setDraft({ ...draft, name })}
                accessibilityLabel="Nom de la pièce"
                className="bg-sunk"
                style={{ height: 50, borderRadius: 25, paddingHorizontal: 18, color: c.ink, fontFamily: 'HankenGrotesk_500Medium', fontSize: 16 }}
              />
            </View>
            <View style={{ gap: 8 }}>
              <T v="kicker" tone="ink2" upper>
                Catégorie
              </T>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {CATEGORIES.map((cat) => (
                  <Chip key={cat.id} label={cat.short} on={draft.category === cat.id} onPress={() => setDraft({ ...draft, category: cat.id })} />
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <T v="kicker" tone="ink2" upper>
                Matière
              </T>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {[draft.material, 'Coton', 'Laine', 'Lin', 'Synthétique'].filter((m, i, arr) => arr.indexOf(m) === i).map((m) => (
                  <Chip key={m} label={m} on={draft.material === m} onPress={() => setDraft({ ...draft, material: m })} />
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <T v="kicker" tone="ink2" upper>
                Saison
              </T>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {(['mi-saison', 'hiver', 'été', 'toute l’année'] as Season[]).map((x) => (
                  <Chip key={x} label={x[0].toUpperCase() + x.slice(1)} on={draft.season === x} onPress={() => setDraft({ ...draft, season: x })} />
                ))}
              </View>
            </View>
            <View style={{ gap: 8, marginTop: 4 }}>
              <Button testID="add-confirm" label="Ranger dans mes portants" onPress={add} />
              <Button label="Choisir une autre photo" variant="plain" onPress={() => setPhase('source')} />
            </View>
          </Animated.View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

/** La photo, avec une ligne de lecture qui la parcourt pendant l'analyse. */
function Scan({ found, width }: { found: Found; width: number }) {
  const { c } = useTheme();
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [y]);
  const h = 240;
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * (h - 4) }] }));
  return (
    <View style={{ height: h, borderRadius: 28, backgroundColor: found.backdrop, overflow: 'hidden' }} className="items-center justify-center" accessibilityLabel="Analyse de la photo en cours">
      <Garment kind={found.kind} tint={found.tint} size={150} />
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width, height: 3, backgroundColor: c.brass, opacity: 0.85 }, line]} />
    </View>
  );
}
