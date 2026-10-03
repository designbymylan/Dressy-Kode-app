/**
 * L'onboarding : quatre chapitres (Toi, Silhouette, Style, Dressing), une
 * question par écran. Chaque question dit pourquoi elle est posée ; seuls le
 * prénom et le rayon sont obligatoires. Avant d'ouvrir l'espace, on accroche
 * ses premières pièces et Kode compose les premières tenues : l'utilisatrice
 * voit la valeur de l'app avant même d'y entrer.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { COLOR_CHOICES, GALLERY, pieceFrom, type Found, type Piece } from '../data/wardrobe';
import { AGES, CITIES, EMPTY_PROFILE, OCCASIONS, RAYONS, STYLE_CARDS, precision, sizeOptions, type MeasureId, type Profile, type Silhouette } from '../state/profile';
import { canCompose, missingForOutfit, suggestOutfits } from '../state/outfits';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { motion, space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap, haptic } from '../ui/Tap';
import { Button, IconButton } from '../ui/Button';
import { Chip, Stepper, Toggle } from '../ui/controls';
import { Card, Ring } from '../ui/bits';
import { Icon, type IconName } from '../ui/Icon';
import { Masthead } from '../ui/layout';
import { OutfitBoard, Legend } from '../ui/outfit';
import { Garment } from '../ui/Garment';
import { Sheet } from '../ui/Sheet';
import { SILHOUETTES, SilhouetteShape } from '../ui/SilhouetteShape';
import { ChoiceCard, ColorChoice, FirstRail, Figure, MeasureFigure, PhotoSlot, Ruler, StyleCard, Trio, IS_WEB, type ColorState } from '../ui/onboarding';
import { useScreen } from '../ui/screen';
import { AccountSheet, EmailField, FormError, PASSWORD_MIN, PasswordField, validEmail } from '../ui/account';
import { online } from '../state/remote';
import { Ambient } from '../ui/Ambient';
import type { Nav } from '../navigation/types';
import { F } from '../theme/fonts';

type StepId = 'prenom' | 'rayon' | 'age' | 'corps' | 'silhouette' | 'mesures' | 'tailles' | 'styles' | 'couleurs' | 'quotidien' | 'ville' | 'pieces' | 'generation' | 'compte' | 'bienvenue';

const CHAPTERS: { label: string; steps: StepId[] }[] = [
  { label: 'Toi', steps: ['prenom', 'rayon', 'age'] },
  { label: 'Silhouette', steps: ['corps', 'silhouette', 'mesures', 'tailles'] },
  { label: 'Style', steps: ['styles', 'couleurs', 'quotidien', 'ville'] },
  { label: 'Dressing', steps: ['pieces', 'compte'] },
];
const ORDER: StepId[] = ['prenom', 'rayon', 'age', 'corps', 'silhouette', 'mesures', 'tailles', 'styles', 'couleurs', 'quotidien', 'ville', 'pieces', 'generation', 'compte', 'bienvenue'];
/** Ce que « Passer » efface : on n'enregistre jamais une valeur que la personne n'a pas choisie. */
const SKIP: Partial<Record<StepId, Partial<Profile>>> = {
  age: { age: null },
  corps: { height: null, weight: null },
  silhouette: { silhouette: null, silhouetteSource: null },
  mesures: { measures: {} },
  tailles: { sizes: {} },
  styles: { styles: [] },
  couleurs: { love: [], avoid: [] },
  quotidien: { occasions: [] },
  ville: { city: null, agenda: false },
};

type Ctx = {
  draft: Profile;
  set: (patch: Partial<Profile>) => void;
  pieces: Piece[];
  setPieces: (p: Piece[]) => void;
  next: () => void;
  W: number;
};

export function Onboarding() {
  const { a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width } = useScreen();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [draft, setDraft] = useState<Profile>(EMPTY_PROFILE);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const step = ORDER[i];
  const chapter = CHAPTERS.findIndex((c) => c.steps.includes(step));
  const W = width - space.gutter * 2;

  const go = (to: number) => {
    setDir(to > i ? 1 : -1);
    setI(Math.max(0, Math.min(ORDER.length - 1, to)));
  };
  const next = () => go(i + 1);
  const back = () => {
    if (i === 0) return nav.goBack();
    // On ne revient pas sur l'écran de préparation : il se rejoue tout seul.
    go(ORDER[i - 1] === 'generation' ? i - 2 : i - 1);
  };
  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }));
  const ctx: Ctx = { draft, set, pieces, setPieces, next, W };
  const full = step === 'generation' || step === 'bienvenue';

  const body: Record<StepId, ReactNode> = {
    prenom: <Prenom {...ctx} />,
    rayon: <RayonStep {...ctx} />,
    age: <AgeStep {...ctx} />,
    corps: <Corps {...ctx} />,
    silhouette: <SilhouetteStep {...ctx} />,
    mesures: <Mesures {...ctx} />,
    tailles: <Tailles {...ctx} />,
    styles: <Styles {...ctx} />,
    couleurs: <Couleurs {...ctx} />,
    quotidien: <Quotidien {...ctx} />,
    ville: <Ville {...ctx} />,
    pieces: <Pieces {...ctx} />,
    generation: <Generation {...ctx} />,
    compte: <Compte {...ctx} />,
    bienvenue: <Bienvenue {...ctx} onEnter={() => a.completeOnboarding(draft, pieces)} />,
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} className="bg-paper" testID="screen-onboarding">
      <Ambient />
      <View style={{ flex: 1, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 10 }}>
        {!full && (
          <Header
            chapter={chapter}
            fill={(CHAPTERS[chapter].steps.indexOf(step) + 1) / CHAPTERS[chapter].steps.length}
            onBack={back}
            onSkip={SKIP[step] ? () => { set(SKIP[step]!); next(); } : undefined}
          />
        )}
        <Animated.View key={step} entering={(dir > 0 ? SlideInRight : SlideInLeft).springify().damping(24)} exiting={(dir > 0 ? SlideOutLeft : SlideOutRight).duration(160)} style={{ flex: 1 }}>
          {body[step]}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ---- Cadre commun ---- */

function Header({ chapter, fill, onBack, onSkip }: { chapter: number; fill: number; onBack: () => void; onSkip?: () => void }) {
  return (
    <View style={{ paddingHorizontal: 12, gap: 6 }}>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <IconButton testID="onb-back" icon="back" label="Retour" variant="plain" onPress={onBack} />
        <View style={{ flex: 1 }} accessibilityRole="progressbar" accessibilityLabel={`Chapitre ${chapter + 1} sur 4 : ${CHAPTERS[chapter].label}`}>
          <Thread chapter={chapter} fill={fill} count={CHAPTERS.length} />
        </View>
        {onSkip ? (
          <T testID="onb-skip" v="bodyStrong" onPress={onSkip} accessibilityRole="button" style={{ paddingHorizontal: 10, paddingVertical: 12, minWidth: 64, textAlign: 'right' }}>
            Passer
          </T>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>
      <View className="flex-row justify-center" style={{ gap: 18 }}>
        {CHAPTERS.map((c, k) => (
          <T key={c.label} v="small" tone={k === chapter ? 'ink' : 'ink2'} style={{ ...(k === chapter ? F.s700 : F.s500), letterSpacing: 0.4 }} upper>
            {c.label}
          </T>
        ))}
      </View>
    </View>
  );
}

/**
 * Le fil de progression : un point de couture en pointillé qui avance à
 * chaque question, et un nœud qui se forme à chaque chapitre franchi. Le
 * vocabulaire de l'atelier plutôt qu'une barre générique.
 */
function Thread({ chapter, fill, count }: { chapter: number; fill: number; count: number }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const progress = (chapter + fill) / count;
  const p = useSharedValue(progress);
  useEffect(() => {
    p.value = reduced ? progress : withSpring(progress, motion.gentle);
  }, [progress, reduced, p]);
  const sewn = useAnimatedStyle(() => ({ width: Math.max(0, Math.min(1, p.value)) * w }));
  const H = 14;
  const stitch = (colour: string, width: number) => (
    <Svg width={w} height={H}>
      <Line x1={2} y1={H / 2} x2={w - 2} y2={H / 2} stroke={colour} strokeWidth={width} strokeDasharray="6 5" strokeLinecap="round" />
    </Svg>
  );
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
      {w > 0 && (
        <>
          <View style={{ position: 'absolute', left: 0, top: 0 }}>{stitch(c['rule-strong'], 2)}</View>
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: H, overflow: 'hidden' }, sewn]}>{stitch(c.ink, 2.4)}</Animated.View>
          {Array.from({ length: count }, (_, k) => (
            <Knot key={k} x={Math.min(((k + 1) / count) * w, w - 4.5)} tied={k < chapter} colour={c.ink} idle={c['rule-strong']} />
          ))}
        </>
      )}
    </View>
  );
}

/** Un nœud en fin de chapitre : il se serre quand on le franchit. */
function Knot({ x, tied, colour, idle }: { x: number; tied: boolean; colour: string; idle: string }) {
  const reduced = useReducedMotion();
  const k = useSharedValue(tied ? 1 : 0);
  useEffect(() => {
    k.value = reduced ? (tied ? 1 : 0) : withSpring(tied ? 1 : 0, motion.spring);
  }, [tied, reduced, k]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 0.55 + 0.45 * k.value }], backgroundColor: k.value > 0.5 ? colour : idle }));
  return <Animated.View style={[{ position: 'absolute', top: 7 - 4.5, left: x - 4.5, width: 9, height: 9, borderRadius: 0 }, style]} />;
}

function Frame({ kicker, lead, em, intro, children, footer }: { kicker?: string; lead: string; em: string; intro?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 22, paddingBottom: 24, gap: 18 }}>
        <View style={{ gap: 8 }}>
          {kicker && (
            <T v="kicker" tone="ink2" upper>
              {kicker}
            </T>
          )}
          <T v="title" accessibilityRole="header">
            {lead}
            <T v="title" style={{ ...F.accent }}>
              {em}
            </T>
          </T>
          {intro && (
            <T v="body" tone="ink2">
              {intro}
            </T>
          )}
        </View>
        {children}
      </ScrollView>
      {footer && <View style={{ paddingHorizontal: space.gutter, paddingTop: 8, gap: 6 }}>{footer}</View>}
    </View>
  );
}

/** Une petite phrase qui dit pourquoi on demande. */
function Why({ children, icon = 'lock' }: { children: ReactNode; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <View className="flex-row" style={{ gap: 8 }}>
      <Icon name={icon} size={16} color={c.ink2} />
      <T v="caption" tone="ink2" style={{ flex: 1 }}>
        {children}
      </T>
    </View>
  );
}

/* ---- 1. Toi ---- */

function Prenom({ draft, set, next }: Ctx) {
  const { c } = useTheme();
  const ok = draft.name.trim().length > 0;
  return (
    <Frame
      kicker="Faisons connaissance"
      lead={'Comment tu\n'}
      em="t’appelles ?"
      footer={<Button testID="onb-next" label="Continuer" disabled={!ok} onPress={() => { set({ name: draft.name.trim() }); next(); }} />}
    >
      <TextInput
        testID="onb-name"
        value={draft.name}
        onChangeText={(name) => set({ name: name.replace(/^\s+/, '') })}
        placeholder="Ton prénom"
        placeholderTextColor={c.ink2}
        autoFocus={!IS_WEB}
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
        maxLength={30}
        onSubmitEditing={() => ok && next()}
        accessibilityLabel="Ton prénom"
        style={{ ...F.s500, fontSize: 34, color: c.ink, paddingVertical: 8, borderBottomWidth: 1.5, borderColor: ok ? c.ink : c.control }}
      />
      <Why>Kode t’appellera comme ça. Rien n’est public.</Why>
    </Frame>
  );
}

function RayonStep({ draft, set, next }: Ctx) {
  return (
    <Frame lead={'Tu t’habilles\nplutôt…'} em="" intro="Pour les coupes et les tailles, pas pour te ranger dans une case.">
      <View style={{ gap: 10 }}>
        {RAYONS.map((r) => (
          <ChoiceCard
            key={r.id}
            testID={`onb-rayon-${r.id}`}
            title={r.label}
            note={r.note}
            on={draft.rayon === r.id}
            art={<Trio kinds={r.kinds} size={30} />}
            onPress={() => {
              set({ rayon: r.id });
              setTimeout(next, 260);
            }}
          />
        ))}
      </View>
    </Frame>
  );
}

function AgeStep({ draft, set, next }: Ctx) {
  const { c } = useTheme();
  return (
    <Frame lead={'Ta tranche\n'} em="d’âge." intro="Les conseils d’un premier emploi ne sont pas ceux d’un mariage d’amis de vingt ans.">
      <View>
        {AGES.map((age, k) => {
          const on = draft.age === age;
          return (
            <Tap
              key={age}
              testID={`onb-age-${k}`}
              onPress={() => {
                set({ age });
                setTimeout(next, 260);
              }}
              feedback="select"
              scaleTo={0.99}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={age}
              className="flex-row items-center justify-between"
              style={{ minHeight: 58, borderBottomWidth: 1, borderColor: c.rule }}
            >
              <T v="bodyL" style={on ? { ...F.s600 } : undefined}>
                {age}
              </T>
              <View style={{ width: 24, height: 24, borderRadius: 0, borderWidth: on ? 7 : 1.5, borderColor: on ? c.ink : c.control }} />
            </Tap>
          );
        })}
      </View>
      <Why>Jamais affichée, jamais partagée.</Why>
    </Frame>
  );
}

/* ---- 2. Silhouette ---- */

function Corps({ draft, set, next, W }: Ctx) {
  const homme = draft.rayon === 'homme';
  const [height, setHeight] = useState(draft.height ?? (homme ? 178 : 165));
  const [withWeight, setWithWeight] = useState(draft.weight !== null);
  const [weight, setWeight] = useState(draft.weight ?? (homme ? 75 : 60));
  return (
    <Frame
      lead={'Ta taille,\n'}
      em="et ton poids."
      intro="Fais glisser la règle, ou touche − et +."
      footer={<Button testID="onb-next" label="Continuer" onPress={() => { set({ height, weight: withWeight ? weight : null }); next(); }} />}
    >
      <Card style={{ gap: 4, paddingHorizontal: 12 }}>
        <T v="kicker" tone="ink2" upper style={{ paddingHorizontal: 4 }}>
          Ta taille
        </T>
        <Ruler testID="ruler-taille" value={height} onChange={setHeight} min={140} max={205} unit="cm" label="Ta taille" width={W - 24} />
      </Card>
      <Card style={{ gap: 10, paddingHorizontal: 12 }}>
        <View className="flex-row items-center" style={{ gap: 12, paddingHorizontal: 4 }}>
          <View style={{ flex: 1 }}>
            <T v="kicker" tone="ink2" upper>
              Ton poids
            </T>
            <T v="caption" tone="ink2">
              Facultatif
            </T>
          </View>
          <Toggle testID="onb-weight" value={withWeight} onChange={setWithWeight} label="Indiquer mon poids" />
        </View>
        {withWeight && (
          <Animated.View entering={FadeInDown.duration(220)}>
            <Ruler testID="ruler-poids" value={weight} onChange={setWeight} min={35} max={160} unit="kg" label="Ton poids" width={W - 24} />
          </Animated.View>
        )}
      </Card>
      <Why>Ils servent uniquement à ajuster les coupes et les longueurs. Jamais affichés, jamais partagés, jamais commentés.</Why>
    </Frame>
  );
}

const ANALYSE_STEPS = ['Repérage des épaules', 'Repérage de la taille', 'Repérage des hanches', 'Calcul des proportions'];

function SilhouetteStep({ draft, set, next, W }: Ctx) {
  const { c } = useTheme();
  const [mode, setMode] = useState<'choix' | 'photos' | 'manuel'>(draft.silhouetteSource === 'choix' ? 'manuel' : 'choix');
  const [photos, setPhotos] = useState<{ face: string | null; profil: string | null; example: boolean }>({ face: null, profil: null, example: false });
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<'pose' | 'analyse' | 'resultat'>('pose');
  const [k, setK] = useState(0);
  const [slot, setSlot] = useState<'face' | 'profil' | null>(null);
  const [picked, setPicked] = useState<Silhouette | null>(draft.silhouette);

  useEffect(() => {
    if (phase !== 'analyse') return;
    setK(0);
    const t = ANALYSE_STEPS.map((_, n) => setTimeout(() => setK(n + 1), 480 * (n + 1)));
    const done = setTimeout(() => setPhase('resultat'), 480 * ANALYSE_STEPS.length + 350);
    return () => {
      t.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [phase]);

  const choose = async (from: 'camera' | 'library' | 'example') => {
    const which = slot;
    setSlot(null);
    if (!which) return;
    if (from === 'example') return setPhotos({ face: null, profil: null, example: true });
    try {
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
      }
      const r = from === 'camera' ? await ImagePicker.launchCameraAsync({ quality: 0.6 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (!r.canceled && r.assets[0]) setPhotos((p) => ({ ...p, example: false, [which]: r.assets[0].uri }));
    } catch {
      // Sélection annulée ou refusée : rien à faire, l'emplacement reste vide.
    }
  };

  if (mode === 'choix') {
    return (
      <Frame lead={'Ta\n'} em="silhouette." intro="Elle aide Kode à choisir les coupes qui te mettent en valeur. Deux façons de la lui donner :">
        <View style={{ gap: 10 }}>
          <ChoiceCard
            testID="onb-sil-photos"
            badge="Le plus précis"
            title="Analyse par photos"
            note="Deux photos, trente secondes. Supprimées juste après l’analyse."
            art={<Figure color={c.ink2} fill={c.raised} width={24} />}
            onPress={() => setMode('photos')}
          />
          <ChoiceCard
            testID="onb-sil-manuel"
            title="Je la choisis"
            note="Cinq silhouettes, décrites sans jugement."
            art={<SilhouetteShape id="X" size={30} color={c.ink2} fill={c.raised} />}
            onPress={() => setMode('manuel')}
          />
        </View>
        <Tap testID="onb-sil-unknown" onPress={() => { set({ silhouette: 'inconnue', silhouetteSource: null }); next(); }} scaleTo={1} accessibilityLabel="Je ne sais pas encore : Kode apprendra" style={{ minHeight: 44, justifyContent: 'center' }}>
          <T v="bodyStrong" style={{ textDecorationLine: 'underline' }}>
            Je ne sais pas encore : Kode apprendra
          </T>
        </Tap>
      </Frame>
    );
  }

  if (mode === 'manuel') {
    return (
      <Frame
        lead={'Laquelle te\n'}
        em="ressemble ?"
        intro="Aucune n’est meilleure qu’une autre : c’est un point de départ pour les coupes."
        footer={<Button testID="onb-next" label="Continuer" disabled={!picked} onPress={() => { set({ silhouette: picked, silhouetteSource: 'choix' }); next(); }} />}
      >
        <View style={{ gap: 8 }}>
          {SILHOUETTES.map((x) => (
            <ChoiceCard key={x.id} testID={`onb-sil-${x.id}`} title={`En ${x.id}`} note={x.note} on={picked === x.id} art={<SilhouetteShape id={x.id} size={30} color={c.ink} fill={picked === x.id ? c.raised : 'transparent'} />} onPress={() => setPicked(x.id)} />
          ))}
        </View>
        <Button label="Plutôt l’analyse par photos" variant="plain" icon="camera" onPress={() => setMode('photos')} />
      </Frame>
    );
  }

  // Analyse par photos
  const half = (W - 12) / 2;
  const ready = (photos.face || photos.example) && consent;
  if (phase === 'resultat') {
    const result: Silhouette = 'X';
    const note = SILHOUETTES.find((x) => x.id === result)!.note;
    return (
      <Frame
        lead={'Silhouette\n'}
        em={`en ${result}.`}
        footer={
          <>
            <Button testID="onb-next" label="C’est bien moi" onPress={() => { set({ silhouette: result, silhouetteSource: 'photos' }); next(); }} />
            <Button label="Ce n’est pas ça : je choisis" variant="plain" onPress={() => { setPicked(result); setMode('manuel'); }} />
          </>
        }
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <Card className="flex-row items-center" style={{ gap: 16 }}>
            <View className="bg-sunk items-center justify-center" style={{ width: 92, height: 120, borderRadius: 0 }}>
              <SilhouetteShape id={result} size={44} color={c.ink} fill={c.raised} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <T v="bodyStrong">{note}</T>
              <T v="caption" tone="ink2">
                Kode va privilégier les coupes qui marquent la taille, et les longueurs qui gardent l’équilibre épaules-hanches.
              </T>
              <T v="small" tone="positive" style={{ ...F.s600 }}>
                Confiance : bonne
              </T>
            </View>
          </Card>
        </Animated.View>
        <Why icon="trash">Tes photos ont été supprimées dès la fin de l’analyse. Seul le résultat est gardé, et tu peux le changer à tout moment.</Why>
        <T v="small" tone="ink2">
          Aperçu : le résultat est simulé. Dans l’app, l’analyse est faite par Kode sur nos serveurs.
        </T>
      </Frame>
    );
  }

  return (
    <Frame
      lead={'Deux photos,\n'}
      em="c’est tout."
      footer={
        <Button testID="onb-analyse" label={phase === 'analyse' ? 'Analyse en cours…' : 'Analyser mes photos'} loading={phase === 'analyse'} disabled={!ready} onPress={() => setPhase('analyse')} />
      }
    >
      <View style={{ gap: 8 }}>
        {[
          { icon: 'check' as const, text: 'Garde une tenue ajustée : pas besoin de te déshabiller.' },
          { icon: 'person' as const, text: 'En entier, de face puis de profil, bras légèrement écartés.' },
          { icon: 'sun' as const, text: 'Lumière du jour, fond uni, téléphone à hauteur de taille.' },
        ].map((t) => (
          <View key={t.text} className="flex-row items-center" style={{ gap: 10 }}>
            <View className="bg-sunk items-center justify-center" style={{ width: 30, height: 30, borderRadius: 0 }}>
              <Icon name={t.icon} size={16} color={c.ink} />
            </View>
            <T v="caption" style={{ flex: 1 }}>
              {t.text}
            </T>
          </View>
        ))}
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <PhotoSlot testID="slot-face" label="De face" pose="face" width={half} uri={photos.face} example={photos.example} onPress={() => setSlot('face')} scanning={phase === 'analyse'} />
        <PhotoSlot testID="slot-profil" label="De profil" pose="profil" width={half} uri={photos.profil} example={photos.example} onPress={() => setSlot('profil')} scanning={phase === 'analyse'} />
      </View>
      {phase === 'analyse' ? (
        <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
          {ANALYSE_STEPS.map((s, n) => (
            <View key={s} className="flex-row items-center" style={{ gap: 10, opacity: k > n ? 1 : 0.45 }}>
              <Icon name={k > n ? 'check' : 'clock'} size={18} color={k > n ? c.positive : c.ink2} strokeWidth={2} />
              <T v="body">{s}</T>
            </View>
          ))}
        </View>
      ) : (
        <>
          <Tap testID="onb-consent" onPress={() => setConsent(!consent)} feedback="select" scaleTo={1} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} accessibilityLabel="J’accepte que Kode analyse ces photos pour estimer ma silhouette. Elles sont supprimées juste après." className="flex-row" style={{ gap: 12, paddingVertical: 4, minHeight: 44 }}>
            <View style={{ width: 24, height: 24, borderRadius: 0, borderWidth: 1.5, borderColor: consent ? c.ink : c.control, backgroundColor: consent ? c['primary-bg'] : 'transparent' }} className="items-center justify-center">
              {consent && <Icon name="check" size={15} color={c['primary-fg']} strokeWidth={2.4} />}
            </View>
            <T v="caption" style={{ flex: 1 }}>
              J’accepte que Kode analyse ces photos pour estimer ma silhouette. Elles sont supprimées juste après, jamais montrées ni partagées.
            </T>
          </Tap>
          {!photos.face && !photos.example && (
            <Button testID="onb-example" label="Essayer avec des photos d’exemple" variant="plain" icon="image" onPress={() => setPhotos({ face: null, profil: null, example: true })} />
          )}
        </>
      )}
      <Sheet visible={!!slot} onClose={() => setSlot(null)} kicker="Photo" title={slot === 'profil' ? 'De profil' : 'De face'} testID="photo-sheet">
        <View style={{ gap: 8 }}>
          {!IS_WEB && <Button label="Prendre la photo" icon="camera" onPress={() => choose('camera')} />}
          <Button testID="photo-library" label="Choisir dans ma galerie" icon="image" variant={IS_WEB ? 'primary' : 'secondary'} onPress={() => choose('library')} />
          <Button testID="photo-example" label="Utiliser une photo d’exemple" variant="plain" onPress={() => choose('example')} />
        </View>
      </Sheet>
    </Frame>
  );
}

const MEASURE_ROWS: { id: MeasureId; label: string; min: number; max: number; start: [number, number] }[] = [
  { id: 'poitrine', label: 'Tour de poitrine', min: 70, max: 140, start: [90, 100] },
  { id: 'taille', label: 'Tour de taille', min: 50, max: 130, start: [72, 84] },
  { id: 'hanches', label: 'Tour de hanches', min: 70, max: 150, start: [98, 100] },
];

function Mesures({ draft, set, next }: Ctx) {
  const { c } = useTheme();
  const [active, setActive] = useState<MeasureId | null>(null);
  const m = draft.measures;
  const score = precision(draft);
  const homme = draft.rayon === 'homme' ? 1 : 0;
  return (
    <Frame
      lead={'Tes mesures,\n'}
      em="si tu les as."
      intro={draft.silhouetteSource === 'photos' ? 'Kode a déjà estimé tes proportions. En centimètres, il devient exact.' : 'Chaque mesure rend Kode plus juste. Aucune n’est obligatoire.'}
      footer={<Button testID="onb-next" label="Continuer" onPress={next} />}
    >
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="bg-stage items-center justify-center" style={{ borderRadius: 0, paddingVertical: 12, paddingHorizontal: 6 }}>
          <MeasureFigure active={active} done={m} height={200} />
        </View>
        <View style={{ flex: 1 }}>
          {MEASURE_ROWS.map((r) => {
            const v = m[r.id];
            const on = active === r.id;
            return (
              <Tap
                key={r.id}
                testID={`onb-measure-${r.id}`}
                onPress={() => {
                  setActive(r.id);
                  if (v === undefined) set({ measures: { ...m, [r.id]: r.start[homme] } });
                }}
                scaleTo={0.99}
                accessibilityLabel={`${r.label} : ${v ? `${v} centimètres` : 'à ajouter'}`}
                style={{ minHeight: 60, justifyContent: 'center', borderBottomWidth: 1, borderColor: c.rule }}
              >
                <T v="caption" tone={on ? 'brass' : 'ink2'} style={{ ...F.s600 }}>
                  {r.label}
                </T>
                <T v="cardTitle" style={{ fontSize: 22 }}>
                  {v ? `${v} cm` : <T v="body" tone="ink2">Ajouter</T>}
                </T>
              </Tap>
            );
          })}
        </View>
      </View>
      {active && (
        <Animated.View entering={FadeIn.duration(200)} className="items-center" style={{ gap: 8 }}>
          <Stepper
            value={m[active] ?? MEASURE_ROWS.find((r) => r.id === active)!.start[homme]}
            onChange={(v) => set({ measures: { ...m, [active]: v } })}
            min={MEASURE_ROWS.find((r) => r.id === active)!.min}
            max={MEASURE_ROWS.find((r) => r.id === active)!.max}
            unit="cm"
            label={MEASURE_ROWS.find((r) => r.id === active)!.label}
          />
          <Button label="Effacer cette mesure" size="s" variant="plain" onPress={() => { const rest = { ...m }; delete rest[active]; set({ measures: rest }); setActive(null); }} />
        </Animated.View>
      )}
      <Card className="flex-row items-center" style={{ gap: 14 }}>
        <Ring value={score} size={56} stroke={5}>
          <T v="small" style={{ ...F.s700 }}>
            {score} %
          </T>
        </Ring>
        <T v="caption" tone="ink2" style={{ flex: 1 }}>
          Précision de Kode. Mètre ruban souple, à même la peau, sans serrer.
        </T>
      </Card>
    </Frame>
  );
}

function Tailles({ draft, set, next }: Ctx) {
  const o = sizeOptions(draft.rayon);
  const s = draft.sizes;
  const row = (key: 'haut' | 'bas' | 'pointure', title: string, list: string[], hint: string) => (
    <View style={{ gap: 8 }}>
      <View className="flex-row items-baseline justify-between">
        <T v="kicker" tone="ink2" upper>
          {title}
        </T>
        <T v="small" tone="ink2">
          {hint}
        </T>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
        {list.map((v) => (
          <Chip key={v} testID={`onb-size-${key}-${v}`} label={v} on={s[key] === v} onPress={() => set({ sizes: { ...s, [key]: s[key] === v ? undefined : v } })} />
        ))}
      </ScrollView>
    </View>
  );
  const filled = [s.haut, s.bas, s.pointure].filter(Boolean).length;
  return (
    <Frame
      lead={'Tes tailles\n'}
      em="habituelles."
      intro="Celles que tu portes le plus souvent. Elles servent pour les prêts entre amies et pour affiner les coupes."
      footer={<Button testID="onb-next" label={filled ? 'Continuer' : 'Continuer sans'} onPress={next} />}
    >
      {row('haut', 'Hauts', o.haut, 'XS à XXL')}
      {row('bas', 'Bas', o.bas, 'Taille française')}
      {row('pointure', 'Pointure', o.pointure, 'Pointure européenne')}
    </Frame>
  );
}

/* ---- 3. Style ---- */

function Styles({ draft, set, next, W }: Ctx) {
  const [warn, setWarn] = useState(false);
  const w = (W - 12) / 2;
  const toggle = (name: string) => {
    const on = draft.styles.includes(name);
    if (!on && draft.styles.length >= 3) {
      setWarn(true);
      haptic('medium');
      return;
    }
    setWarn(false);
    set({ styles: on ? draft.styles.filter((x) => x !== name) : [...draft.styles, name] });
  };
  return (
    <Frame
      lead={'Ton style,\n'}
      em="en 1 à 3 mots."
      intro="Choisis ceux qui te ressemblent aujourd’hui. Kode s’ajustera à ce que tu portes vraiment."
      footer={
        <>
          {warn && (
            <Animated.View entering={FadeIn}>
              <T v="caption" tone="caution" style={{ textAlign: 'center' }}>
                Trois au maximum : retire-en un pour en choisir un autre.
              </T>
            </Animated.View>
          )}
          <Button testID="onb-next" label={draft.styles.length ? `Continuer · ${draft.styles.length} sur 3` : 'Choisis au moins un style'} disabled={!draft.styles.length} onPress={next} />
        </>
      }
    >
      <View className="flex-row flex-wrap" style={{ gap: 12 }}>
        {STYLE_CARDS.map((s) => (
          <StyleCard key={s.name} name={s.name} note={s.note} kinds={s.kinds} width={w} on={draft.styles.includes(s.name)} order={draft.styles.indexOf(s.name) + 1} onPress={() => toggle(s.name)} />
        ))}
      </View>
    </Frame>
  );
}

function Couleurs({ draft, set, next, W }: Ctx) {
  const state = (name: string): ColorState => (draft.love.includes(name) ? 'aime' : draft.avoid.includes(name) ? 'evite' : null);
  const cycle = (name: string) => {
    const st = state(name);
    const love = draft.love.filter((x) => x !== name);
    const avoid = draft.avoid.filter((x) => x !== name);
    if (st === null) set({ love: [...love, name], avoid });
    else if (st === 'aime') set({ love, avoid: [...avoid, name] });
    else set({ love, avoid });
  };
  return (
    <Frame
      lead={'Tes\n'}
      em="couleurs."
      intro="Une touche : tu aimes. Deux : tu évites. Trois : on oublie."
      footer={<Button testID="onb-next" label="Continuer" onPress={next} />}
    >
      <View className="flex-row flex-wrap" style={{ rowGap: 14 }}>
        {COLOR_CHOICES.map((x) => (
          <ColorChoice key={x.name} name={x.name} hex={x.hex} state={state(x.name)} onPress={() => cycle(x.name)} width={W / 4} />
        ))}
      </View>
      {(draft.love.length > 0 || draft.avoid.length > 0) && (
        <Animated.View entering={FadeIn}>
          <Card style={{ gap: 4 }}>
            {draft.love.length > 0 && (
              <T v="caption">
                <T v="caption" style={{ ...F.s700 }}>
                  Tu aimes :{' '}
                </T>
                {draft.love.join(', ')}
              </T>
            )}
            {draft.avoid.length > 0 && (
              <T v="caption">
                <T v="caption" style={{ ...F.s700 }}>
                  Tu évites :{' '}
                </T>
                {draft.avoid.join(', ')}
              </T>
            )}
          </Card>
        </Animated.View>
      )}
    </Frame>
  );
}

function Quotidien({ draft, set, next, W }: Ctx) {
  const { c } = useTheme();
  const w = (W - 10) / 2;
  return (
    <Frame lead={'Ton\n'} em="quotidien." intro="Ce qui remplit tes semaines. Kode prépare la bonne tenue au bon moment." footer={<Button testID="onb-next" label="Continuer" onPress={next} />}>
      <View className="flex-row flex-wrap" style={{ gap: 10 }}>
        {OCCASIONS.map((o) => {
          const on = draft.occasions.includes(o.label);
          return (
            <Tap
              key={o.label}
              testID={`onb-occ-${o.label}`}
              onPress={() => set({ occasions: on ? draft.occasions.filter((x) => x !== o.label) : [...draft.occasions, o.label] })}
              feedback="select"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.label}
              scaleTo={0.97}
              className="flex-row items-center"
              style={{ width: w, height: 58, borderRadius: 0, paddingHorizontal: 14, gap: 10, borderWidth: on ? 2 : 1, borderColor: on ? c.ink : c.rule, backgroundColor: on ? c.raised : 'transparent' }}
            >
              <Icon name={o.icon} size={20} color={on ? c.ink : c.ink2} />
              <T v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {o.label}
              </T>
            </Tap>
          );
        })}
      </View>
    </Frame>
  );
}

function Ville({ draft, set, next }: Ctx) {
  const { c } = useTheme();
  const [q, setQ] = useState(draft.city ?? '');
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = CITIES.filter((x) => !q || norm(x).startsWith(norm(q))).slice(0, 6);
  return (
    <Frame lead={'Où tu\n'} em="vis ?" intro="Pour la météo de chaque matin : un trench quand il pleut, pas de laine quand il fait 25°." footer={<Button testID="onb-next" label="Continuer" onPress={next} />}>
      <View className="flex-row items-center bg-sunk" style={{ height: 52, borderRadius: 0, paddingHorizontal: 16, gap: 10 }}>
        <Icon name="pin" size={20} color={c.ink2} />
        <TextInput
          testID="onb-city"
          value={q}
          onChangeText={(v) => {
            setQ(v);
            if (draft.city) set({ city: null });
          }}
          placeholder="Ta ville"
          placeholderTextColor={c.ink2}
          autoComplete="postal-address-locality"
          textContentType="addressCity"
          accessibilityLabel="Ta ville"
          style={{ flex: 1, height: 52, color: c.ink, ...F.s500, fontSize: 17 }}
        />
      </View>
      {!draft.city && (
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {list.map((x) => (
            <Chip key={x} testID={`onb-city-${x}`} label={x} onPress={() => { setQ(x); set({ city: x }); }} />
          ))}
          {q.trim().length > 1 && !list.some((x) => norm(x) === norm(q.trim())) && <Chip label={`Utiliser « ${q.trim()} »`} onPress={() => set({ city: q.trim() })} />}
        </View>
      )}
      {draft.city && (
        <Animated.View entering={FadeInDown.duration(220)}>
          <Card className="flex-row items-center" style={{ gap: 12 }}>
            <Icon name="cloud" size={26} color={c.ink} />
            <View style={{ flex: 1 }}>
              <T v="bodyStrong">{draft.city}, c’est noté</T>
              <T v="caption" tone="ink2">
                Kode regardera sa météo chaque matin, dès ton compte créé.
              </T>
            </View>
          </Card>
        </Animated.View>
      )}
      <Card className="flex-row items-center" style={{ gap: 14 }}>
        <Icon name="calendar" size={24} color={c.ink} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="bodyStrong">Relier mon agenda</T>
          <T v="caption" tone="ink2">
            Kode prépare les jours chargés : réunion, dîner, mariage. Tu choisis les agendas, et tu arrêtes quand tu veux.
          </T>
        </View>
        <Toggle testID="onb-agenda" value={draft.agenda} onChange={(agenda) => set({ agenda })} label="Relier mon agenda" />
      </Card>
    </Frame>
  );
}

/* ---- 4. Dressing ---- */

function Pieces({ draft, pieces, setPieces, next, W }: Ctx) {
  const { c } = useTheme();
  const [busy, setBusy] = useState<string[]>([]);
  const [imported, setImported] = useState<{ id: string; uri: string }[]>([]);
  const [last, setLast] = useState<string | null>(null);
  const counter = useRef(0);
  const used = new Set(pieces.map((p) => p.name));
  const tile = (W - 3 * 8) / 4;
  const ok = canCompose(pieces);
  const missing = missingForOutfit(pieces);

  const recognise = (f: Found, key: string, uri?: string) => {
    setBusy((b) => [...b, key]);
    if (uri) setImported((x) => [...x, { id: key, uri }]);
    setTimeout(() => {
      setBusy((b) => b.filter((k) => k !== key));
      setImported((x) => x.filter((y) => y.id !== key));
      setPieces([...piecesRef.current, pieceFrom(f, `n${Date.now()}${counter.current++}`)]);
      setLast(f.name);
      haptic('success');
    }, 900);
  };
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;

  const importPhotos = async (camera: boolean) => {
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
      }
      const r = camera
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.6 });
      if (r.canceled) return;
      // Aperçu : chaque photo est « reconnue » comme une pièce de la galerie pas encore ajoutée.
      const free = GALLERY.filter((g) => !used.has(g.name));
      r.assets.forEach((asset, n) => {
        const f = free[n % Math.max(1, free.length)] ?? GALLERY[n % GALLERY.length];
        setTimeout(() => recognise(f, `imp${Date.now()}${n}`, asset.uri), n * 250);
      });
    } catch {
      // Sélection annulée : rien à faire.
    }
  };

  return (
    <Frame
      lead={'Ton premier\n'}
      em="portant."
      intro={`Ajoute quelques pièces que tu portes souvent${draft.name ? `, ${draft.name}` : ''}. Kode compose tes premières tenues avec, avant même que tu entres.`}
      footer={
        <>
          <Button testID="onb-generate" label={ok ? `Générer mes premières tenues` : pieces.length ? `Il manque ${missing}` : 'Ajoute tes premières pièces'} icon={ok ? 'kode' : undefined} disabled={!ok} onPress={next} />
          <Button testID="onb-later" label="Plus tard : entrer avec un dressing vide" variant="plain" onPress={next} />
        </>
      }
    >
      <View style={{ marginHorizontal: -space.gutter }}>
        <FirstRail pieces={pieces} slots={5} size={74} onPiece={(p) => setPieces(pieces.filter((x) => x.id !== p.id))} />
      </View>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View className="flex-row" style={{ gap: 5 }}>
          {[0, 1, 2].map((k) => (
            <View key={k} style={{ width: 10, height: 10, borderRadius: 0, backgroundColor: k < Math.min(3, pieces.length) ? (ok ? c.positive : c.ink) : c.rule }} />
          ))}
        </View>
        <T v="caption" tone={ok ? 'positive' : 'ink2'} style={{ flex: 1, ...F.s600 }}>
          {ok ? `${pieces.length} pièces : Kode peut composer.` : pieces.length ? `${pieces.length} pièce${pieces.length > 1 ? 's' : ''} · il manque ${missing}` : '3 pièces suffisent pour une première tenue'}
        </T>
      </View>
      {last && (
        <Animated.View key={last + pieces.length} entering={FadeIn.duration(200)} accessibilityLiveRegion="polite">
          <T v="small" tone="ink2">
            Reconnu : {last}. Touche une pièce sur la tringle pour la retirer.
          </T>
        </Animated.View>
      )}
      <View className="flex-row" style={{ gap: 8 }}>
        <Button testID="onb-import" label="Importer des photos" icon="image" variant="secondary" size="m" grow onPress={() => importPhotos(false)} />
        {!IS_WEB && <Button label="Photographier" icon="camera" variant="secondary" size="m" grow onPress={() => importPhotos(true)} />}
      </View>
      {imported.length > 0 && (
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {imported.map((x) => (
            <View key={x.id} style={{ width: tile, height: tile, borderRadius: 0, overflow: 'hidden' }} className="bg-sunk">
              <Animated.View entering={FadeIn}>
                <Image source={{ uri: x.uri }} style={{ width: tile, height: tile, opacity: 0.7 }} />
              </Animated.View>
              <View className="absolute items-center justify-center" style={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <T v="small" style={{ ...F.s700 }}>
                  Analyse…
                </T>
              </View>
            </View>
          ))}
        </View>
      )}
      <View style={{ gap: 8 }}>
        <T v="kicker" tone="ink2" upper>
          Photos récentes
        </T>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {GALLERY.map((g, n) => {
            const key = `g${n}`;
            const added = used.has(g.name);
            const working = busy.includes(key);
            return (
              <Tap
                key={g.name}
                testID={`onb-photo-${n}`}
                onPress={() => !added && !working && recognise(g, key)}
                disabled={added || working}
                accessibilityLabel={added ? `${g.name}, ajouté` : `Photo ${n + 1}`}
                accessibilityState={{ selected: added, busy: working }}
                style={{ width: tile, height: tile * 1.15, borderRadius: 0, backgroundColor: g.backdrop, overflow: 'hidden', opacity: added ? 0.45 : 1 }}
                className="items-center justify-center"
                scaleTo={0.95}
              >
                <View style={{ transform: [{ rotate: `${((n % 3) - 1) * 5}deg` }] }}>
                  <Garment kind={g.kind} tint={g.tint} size={tile * 0.66} />
                </View>
                {(added || working) && (
                  <View className="absolute items-center justify-center" style={{ top: 6, right: 6, width: 22, height: 22, borderRadius: 0, backgroundColor: added ? c['primary-bg'] : c.raised }}>
                    <Icon name={added ? 'check' : 'clock'} size={13} color={added ? c['primary-fg'] : c.ink} strokeWidth={2.2} />
                  </View>
                )}
              </Tap>
            );
          })}
        </View>
        <T v="small" tone="ink2">
          Tes photos servent seulement à dessiner tes pièces : elles ne sont ni publiées ni partagées.{IS_WEB ? ' Aperçu : la reconnaissance est simulée.' : ''}
        </T>
      </View>
    </Frame>
  );
}

function Generation({ draft, pieces, next }: Ctx) {
  const { c } = useTheme();
  // Pas encore de compte, donc pas encore de vraie météo : les tenues se composent sans.
  const outfits = useMemo(() => suggestOutfits(pieces, null), [pieces]);
  const rayon = draft.rayon === 'femme' ? 'rayon femme' : draft.rayon === 'homme' ? 'rayon homme' : draft.rayon === 'mixte' ? 'rayons femme et homme' : '';
  const lines = [
    `Profil : ${[rayon, draft.height ? `${draft.height} cm` : '', draft.silhouette && draft.silhouette !== 'inconnue' ? `silhouette en ${draft.silhouette}` : ''].filter(Boolean).join(', ') || 'Kode apprendra en route'}`,
    `Style : ${draft.styles.length ? draft.styles.join(', ') : 'à découvrir avec toi'}`,
    `Palette : ${draft.love.length ? draft.love.join(', ') : 'toutes les couleurs'}${draft.avoid.length ? `, sans ${draft.avoid.join(', ').toLowerCase()}` : ''}`,
    draft.city ? `Météo de ${draft.city}, suivie chaque matin` : 'Météo : ta ville, au prochain lancement',
    pieces.length ? `${pieces.length} pièce${pieces.length > 1 ? 's' : ''} rangée${pieces.length > 1 ? 's' : ''} sur tes portants` : 'Tes portants, prêts à se remplir',
    outfits.length ? `${outfits.length} tenue${outfits.length > 1 ? 's' : ''} composée${outfits.length > 1 ? 's' : ''} pour aujourd’hui` : 'Ta première tenue, dès trois pièces',
  ];
  const [k, setK] = useState(0);
  useEffect(() => {
    const t = lines.map((_, n) => setTimeout(() => setK(n + 1), 420 * (n + 1)));
    const done = setTimeout(next, 420 * lines.length + 700);
    return () => {
      t.forEach(clearTimeout);
      clearTimeout(done);
    };
    // Une seule fois, à l'arrivée sur l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.gutter, gap: 24 }} testID="onb-generation" accessibilityLiveRegion="polite">
      <View className="items-center" style={{ gap: 14 }}>
        <Ring value={Math.round((k / lines.length) * 100)} size={88} stroke={6}>
          <Icon name="kode" size={30} color={c.brass} />
        </Ring>
        <T v="title" style={{ textAlign: 'center' }}>
          Kode prépare{'\n'}
          <T v="title" style={{ ...F.accent }}>
            ton espace…
          </T>
        </T>
      </View>
      <View style={{ gap: 10 }}>
        {lines.map((l, n) => (
          <View key={l} className="flex-row items-center" style={{ gap: 10, opacity: k > n ? 1 : 0.3 }}>
            <Icon name={k > n ? 'check' : 'clock'} size={18} color={k > n ? c.positive : c.ink2} strokeWidth={2} />
            <T v="body" style={{ flex: 1 }}>
              {l}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Le compte : e-mail et mot de passe. Si le projet demande de confirmer
 * l'e-mail, l'espace reste sur le téléphone et part sur le compte à la
 * première connexion (voir signIn dans state/store.tsx).
 */
function Compte({ draft, set, next }: Ctx) {
  const { s, a } = useStore();
  const [email, setEmail] = useState(draft.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState(false);
  const ready = validEmail(email) && (!online || password.length >= PASSWORD_MIN);
  const legal = (
    <T v="small" tone="ink2">
      En continuant, tu acceptes les conditions d’utilisation et la politique de confidentialité de Dresskode. Tes photos de silhouette ne sont jamais conservées.
    </T>
  );

  // Déjà connectée (compte ouvert depuis l'accueil) ou compte créé en attente de confirmation.
  if (s.session || s.pendingEmail) {
    const mail = s.session?.email ?? s.pendingEmail!;
    return (
      <Frame
        lead={s.session ? 'Ton espace sera\n' : 'Compte créé,\n'}
        em={s.session ? 'enregistré.' : 'à confirmer.'}
        intro={
          s.session
            ? `Ton compte est ouvert avec ${mail}. Ton profil et tes pièces y partent dès que tu entres.`
            : `On a envoyé un lien à ${mail}. Touche-le pour confirmer ton adresse, puis connecte-toi depuis Moi : ton espace partira sur ton compte à ce moment-là.`
        }
        footer={<Button testID="onb-account-continue" label="Continuer" onPress={() => { set({ email: mail }); next(); }} />}
      >
        <Why>{s.session ? 'Tu pourras tout modifier depuis Moi, sur n’importe quel appareil.' : 'En attendant, tout reste sur ce téléphone. Rien n’est perdu.'}</Why>
      </Frame>
    );
  }

  const create = async () => {
    if (!ready || busy) return;
    if (!online) {
      // Aperçu sans serveur : l'e-mail est gardé, rien n'est envoyé.
      set({ email: email.trim() });
      return next();
    }
    setBusy(true);
    setError(null);
    const r = await a.signUp(email, password, draft.name);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    set({ email: email.trim().toLowerCase() });
    // Avec confirmation demandée, l'écran se redessine avec le message « à confirmer ».
    if (!r.confirm) next();
  };

  return (
    <Frame
      lead={'Garde ton espace,\n'}
      em={`${draft.name}.`}
      intro={online
        ? 'Ton profil et tes pièces sont enregistrés sur ton compte : tu les retrouves sur tous tes appareils.'
        : 'Ton profil et tes pièces sont enregistrés sur ton compte : tu les retrouves sur tous tes appareils. Dans cet aperçu, rien n’est envoyé.'}
      footer={
        <>
          <Button testID="onb-account" label="Créer mon compte" disabled={!ready} loading={busy} onPress={create} />
          <Button testID="onb-no-account" label="Continuer sans compte pour l’instant" variant="plain" onPress={() => { set({ email: null }); next(); }} />
        </>
      }
    >
      <EmailField testID="onb-email" value={email} onChange={setEmail} />
      {online && <PasswordField testID="onb-password" value={password} onChange={setPassword} onSubmit={create} isNew />}
      <FormError text={error} />
      <Why>Sans compte, tout reste sur ce téléphone ; tu pourras le créer plus tard depuis Moi.</Why>
      {online && (
        <T v="caption" tone="ink2" onPress={() => setLogin(true)} accessibilityRole="button" testID="onb-login" style={{ paddingVertical: 6 }}>
          Tu as déjà un compte ? <T v="caption" style={{ ...F.s600, textDecorationLine: 'underline' }}>Me connecter</T>
        </T>
      )}
      {legal}
      <AccountSheet
        visible={login}
        onClose={() => setLogin(false)}
        // Compte déjà rempli : l'app s'ouvre d'elle-même ; compte vierge : on continue ici, session ouverte.
        onDone={() => setLogin(false)}
      />
    </Frame>
  );
}

function Bienvenue({ draft, pieces, W, onEnter }: Ctx & { onEnter: () => void }) {
  const outfits = useMemo(() => suggestOutfits(pieces, null), [pieces]);
  const first = outfits[0];
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const shown = first ? (first.pieces.map((id) => byId.get(id)).filter(Boolean) as Piece[]) : [];
  const score = precision(draft);
  const chips = [
    draft.silhouette && draft.silhouette !== 'inconnue' ? `Silhouette en ${draft.silhouette}` : null,
    draft.height ? `${draft.height} cm` : null,
    draft.sizes.haut ? `Haut ${draft.sizes.haut}` : null,
    draft.sizes.bas ? `Bas ${draft.sizes.bas}` : null,
    draft.sizes.pointure ? `Pointure ${draft.sizes.pointure}` : null,
    ...draft.styles,
    draft.city,
  ].filter(Boolean) as string[];
  return (
    <View style={{ flex: 1 }} testID="onb-welcome">
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 12, paddingBottom: 20, gap: 18 }}>
        <Masthead kicker="DRESSKODE" meta="Ton espace est prêt" />
        <Animated.View entering={FadeInDown.duration(400)}>
          <T v="hero" accessibilityRole="header">
            Bienvenue,{'\n'}
            <T v="hero" style={{ ...F.accent }}>
              {draft.name}.
            </T>
          </T>
        </Animated.View>
        {first ? (
          <Animated.View entering={FadeInDown.delay(250).duration(400)} style={{ gap: 12 }}>
            <T v="kicker" tone="ink2" upper>
              Ta première tenue, pour aujourd’hui
            </T>
            <OutfitBoard pieces={shown} width={W} />
            <Legend pieces={shown} />
            <T v="quote">« {first.why} »</T>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(250).duration(400)} style={{ gap: 12 }}>
            <View style={{ marginHorizontal: -space.gutter }}>
              <FirstRail pieces={[]} slots={5} size={70} />
            </View>
            <T v="cardTitle">Ton dressing t’attend.</T>
            <T v="body" tone="ink2">
              Dès trois pièces ajoutées, Kode compose ta première tenue, avec la météo {draft.city ? `de ${draft.city}` : 'du jour'} et ton style.
            </T>
          </Animated.View>
        )}
        <Animated.View entering={FadeInDown.delay(450).duration(400)}>
          <Card style={{ gap: 12 }}>
            <View className="flex-row items-center" style={{ gap: 14 }}>
              <Ring value={score} size={52} stroke={5}>
                <T v="small" style={{ ...F.s700 }}>
                  {score} %
                </T>
              </Ring>
              <View style={{ flex: 1 }}>
                <T v="bodyStrong">Ce que Kode sait de toi</T>
                <T v="caption" tone="ink2">
                  Tu peux tout compléter ou changer dans Moi.
                </T>
              </View>
            </View>
            {chips.length > 0 && (
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {chips.map((x) => (
                  <View key={x} className="bg-pill" style={{ borderRadius: 0, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <T v="small" style={{ ...F.s600 }}>
                      {x}
                    </T>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </Animated.View>
      </ScrollView>
      <View style={{ paddingHorizontal: space.gutter, paddingTop: 8 }}>
        <Button testID="onb-enter" label="Entrer dans mon Dresskode" iconRight="chevron" onPress={onEnter} />
      </View>
    </View>
  );
}
