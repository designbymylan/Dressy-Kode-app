/**
 * L'onboarding (raccourci le 09/10, diagnostic UX) : quatre écrans avant
 * l'app (prénom, rayon, style, premier portant), le compte seulement si des
 * photos attendent Kodi, puis la préparation, et on entre. Seuls le prénom
 * et le rayon sont obligatoires.
 *
 * Tout le reste (taille, silhouette, mesures, tailles, couleurs, quotidien,
 * ville, âge) passe dans « Affiner » : le même écran, ouvert plus tard et
 * en contexte (Moi, Ma silhouette, Premiers pas de l'accueil). La cible
 * fuit les onboardings longs, et le poids ou les mesures ne se demandent
 * pas avant d'avoir montré la valeur de l'app.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInLeft, SlideInRight, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { CAMERA_BLOCKED, cameraAccess, shootBurst } from '../lib/camera';
import { COLOR_CHOICES } from '../data/wardrobe';
import { AGES, CITIES, EMPTY_PROFILE, OCCASIONS, RAYONS, STYLE_CARDS, precision, sizeOptions, type MeasureId, type Profile, type Silhouette } from '../state/profile';
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
import { SILHOUETTES, SilhouetteShape } from '../ui/SilhouetteShape';
import { ChoiceCard, ColorChoice, FirstRail, MeasureFigure, Ruler, StyleCard, Trio, IS_WEB, type ColorState } from '../ui/onboarding';
import { useScreen } from '../ui/screen';
import { AccountSheet, EmailField, FormError, PASSWORD_MIN, PasswordField, SignupTerms, validEmail } from '../ui/account';
import { online, type Photo } from '../state/remote';
import { Ambient } from '../ui/Ambient';
import type { Nav } from '../navigation/types';
import { F } from '../theme/fonts';

type StepId = 'prenom' | 'rayon' | 'age' | 'confiance' | 'corps' | 'silhouette' | 'mesures' | 'tailles' | 'styles' | 'couleurs' | 'quotidien' | 'ville' | 'pieces' | 'generation' | 'compte';

const CHAPTERS: { label: string; steps: StepId[] }[] = [
  { label: 'Toi', steps: ['prenom', 'rayon'] },
  { label: 'Style', steps: ['styles'] },
  { label: 'Dressing', steps: ['pieces', 'compte'] },
];
/** Le compte ne se demande que si des photos attendent Kodi (voir `order`). */
const ORDER: StepId[] = ['prenom', 'rayon', 'styles', 'pieces', 'compte', 'generation'];
/** « Affiner » : ce qui aide Kodi, demandé une fois l'app découverte. Tout se passe. */
const AFFINER_CHAPTERS: { label: string; steps: StepId[] }[] = [
  { label: 'Silhouette', steps: ['confiance', 'corps', 'silhouette', 'mesures', 'tailles'] },
  { label: 'Goûts', steps: ['couleurs', 'quotidien', 'ville', 'age'] },
];
const AFFINER: StepId[] = ['corps', 'silhouette', 'mesures', 'tailles', 'couleurs', 'quotidien', 'ville', 'age'];
/**
 * Ce qui touche au corps (09/10, RGPD) : demandé seulement après un accord
 * explicite (étape « confiance »). Sans accord, ces écrans sont sautés.
 */
const BODY: StepId[] = ['corps', 'silhouette', 'mesures'];
/** Les champs qu'« Affiner » enregistre dans le profil. */
const AFFINE = ['bodyConsent', 'height', 'weight', 'silhouette', 'silhouetteSource', 'measures', 'sizes', 'love', 'avoid', 'occasions', 'city', 'agenda', 'age'] as const;
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
  /** Les vraies photos choisies au premier portant : Kodi les dessine une fois le compte créé. */
  photos: Photo[];
  setPhotos: (p: Photo[]) => void;
  next: () => void;
  W: number;
};

/** Photos confiées d'un coup, comme sur l'écran d'ajout. */
const MAX_PHOTOS = 10;

/** « Affiner mon profil » : les questions qui aident Kodi, ouvertes depuis l'app. */
export function Affiner() {
  return <Onboarding affiner />;
}

export function Onboarding({ affiner }: { affiner?: boolean }) {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width } = useScreen();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [draft, setDraft] = useState<Profile>(affiner ? s.profile : EMPTY_PROFILE);
  const [photos, setPhotos] = useState<Photo[]>([]);
  // Sans photo confiée, pas de compte à créer maintenant : il se propose plus tard, dans Moi.
  const order = affiner
    ? draft.bodyConsent
      ? AFFINER
      : (['confiance', ...AFFINER.filter((x) => !BODY.includes(x))] as StepId[])
    : ORDER.filter((x) => x !== 'compte' || photos.length > 0);
  const chapters = affiner ? AFFINER_CHAPTERS : CHAPTERS;
  const step = order[Math.min(i, order.length - 1)];
  const chapter = Math.max(0, chapters.findIndex((c) => c.steps.includes(step)));
  const W = width - space.gutter * 2;

  const finish = () => {
    if (!affiner) return a.completeOnboarding(draft, [], photos);
    a.setProfile(Object.fromEntries(AFFINE.map((k) => [k, draft[k]])) as Partial<Profile>);
    a.toast(`Kodi te connaît à ${precision(draft)} %`);
    nav.goBack();
  };
  const go = (to: number) => {
    if (to >= order.length) return finish();
    setDir(to > i ? 1 : -1);
    setI(Math.max(0, to));
  };
  const next = () => go(i + 1);
  const back = () => {
    if (i === 0) {
      if (affiner) return nav.goBack();
      // Le questionnaire a remplacé l'accueil (voir Welcome) : on y retourne de même.
      return nav.dispatch(StackActions.replace('Welcome'));
    }
    // On ne revient pas sur l'écran de préparation : il se rejoue tout seul.
    go(order[i - 1] === 'generation' ? i - 2 : i - 1);
  };
  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }));
  const ctx: Ctx = { draft, set, photos, setPhotos, next, W };
  const full = step === 'generation';

  const body: Record<StepId, ReactNode> = {
    prenom: <Prenom {...ctx} />,
    rayon: <RayonStep {...ctx} />,
    age: <AgeStep {...ctx} />,
    confiance: <Confiance {...ctx} />,
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
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} className="bg-paper" testID="screen-onboarding">
      <Ambient />
      <View style={{ flex: 1, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 10 }}>
        {!full && (
          <Header
            chapters={chapters}
            chapter={chapter}
            fill={(chapters[chapter].steps.indexOf(step) + 1) / chapters[chapter].steps.length}
            onBack={back}
            onSkip={SKIP[step] ? () => { // En « Affiner », passer garde ce qui était déjà dit.
              if (!affiner) set(SKIP[step]!);
              next();
            } : undefined}
          />
        )}
        <Animated.View key={step} entering={(dir > 0 ? SlideInRight : SlideInLeft).duration(motion.duration.base).easing(motion.easing)} style={{ flex: 1 }}>
          {body[step]}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ---- Cadre commun ---- */

function Header({ chapters, chapter, fill, onBack, onSkip }: { chapters: { label: string }[]; chapter: number; fill: number; onBack: () => void; onSkip?: () => void }) {
  return (
    <View style={{ paddingHorizontal: 12, gap: 6 }}>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <IconButton testID="onb-back" icon="back" label="Retour" variant="plain" onPress={onBack} />
        <View style={{ flex: 1 }} accessibilityRole="progressbar" accessibilityLabel={`Chapitre ${chapter + 1} sur ${chapters.length} : ${chapters[chapter].label}`}>
          <Thread chapter={chapter} fill={fill} count={chapters.length} />
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
        {chapters.map((c, k) => (
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
  return <Animated.View style={[{ position: 'absolute', top: 7 - 4.5, left: x - 4.5, width: 9, height: 9, borderRadius: 5 }, style]} />;
}

function Frame({ kicker, lead, em, intro, children, footer }: { kicker?: string; lead: string; em: string; intro?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 22, paddingBottom: 24, gap: 18 }}>
        <View style={{ gap: 8 }}>
          {kicker && (
            <T v="kicker" tone="ink2">
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
        style={{ ...F.display, fontSize: 30, color: c.ink, paddingVertical: 8, borderBottomWidth: 1.5, borderColor: ok ? c.ink : c.control }}
      />
      <Why>Kodi t’appellera comme ça. Rien n’est public.</Why>
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
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 58, borderBottomWidth: 1, borderColor: c.rule }}
            >
              <T v="bodyL" style={on ? { ...F.s600 } : undefined}>
                {age}
              </T>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 7 : 1.5, borderColor: on ? c.ink : c.control }} />
            </Tap>
          );
        })}
      </View>
      <Why>Jamais affichée, jamais partagée.</Why>
    </Frame>
  );
}

/* ---- 2. Silhouette ---- */

/**
 * L'accord avant tout ce qui touche au corps (09/10, RGPD art. 9, par
 * prudence) : ce qui est demandé, à quoi ça sert, qui le reçoit, comment le
 * retirer. Accepter ouvre la taille, la silhouette et les mesures ; « Pas
 * maintenant » passe directement aux tailles de vêtements.
 */
function Confiance({ set, next }: Ctx) {
  const { a } = useStore();
  const nav = useNavigation<Nav>();
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const rows: { icon: IconName; text: string }[] = [
    { icon: 'lock', text: 'Elles restent dans ton espace, protégées. Personne d’autre ne les voit.' },
    { icon: 'kode', text: 'Kodi reçoit ta silhouette et ta taille, sans ton nom, pour choisir tes coupes. Jamais tes mesures.' },
    { icon: 'trash', text: 'Tu retires ton accord quand tu veux, dans Réglages › Tes données : tout est effacé aussitôt.' },
  ];
  return (
    <Frame
      kicker="Avant de continuer"
      lead={'Ta silhouette,\n'}
      em="en confiance."
      intro="Ta taille, ta silhouette et tes mesures aident Kodi à choisir tes coupes. Elles touchent à ton corps : on te demande ton accord."
      footer={
        <>
          <Button
            testID="onb-consent-yes"
            label="J’accepte"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              const ok = await a.setBodyConsent(true);
              setBusy(false);
              if (ok) set({ bodyConsent: new Date().toISOString() });
            }}
          />
          <Button testID="onb-consent-no" label="Pas maintenant" variant="plain" onPress={next} />
        </>
      }
    >
      <View style={{ gap: 12 }}>
        {rows.map((r) => (
          <View key={r.text} className="flex-row items-center" style={{ gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.pill }}>
              <Icon name={r.icon} size={17} color={c.ink} />
            </View>
            <T v="caption" style={{ flex: 1 }}>
              {r.text}
            </T>
          </View>
        ))}
      </View>
      <Why icon="help">On ne te demande plus ton poids : Kodi n’en a pas besoin pour t’habiller.</Why>
      <T testID="onb-policy" v="label" tone="ink2" onPress={() => nav.navigate('Confidentialite')} accessibilityRole="link" suppressHighlighting style={{ paddingVertical: 12 }}>
        Politique de confidentialité
      </T>
    </Frame>
  );
}

function Corps({ draft, set, next, W }: Ctx) {
  const homme = draft.rayon === 'homme';
  const [height, setHeight] = useState(draft.height ?? (homme ? 178 : 165));
  return (
    <Frame
      lead={'Ta taille\n'}
      em="en centimètres."
      intro="Fais glisser la règle, ou touche − et +."
      footer={<Button testID="onb-next" label="Continuer" onPress={() => { set({ height }); next(); }} />}
    >
      <Card style={{ gap: 4, paddingHorizontal: 12 }}>
        <T v="kicker" tone="ink2" style={{ paddingHorizontal: 4 }}>
          Ta taille
        </T>
        <Ruler testID="ruler-taille" value={height} onChange={setHeight} min={140} max={205} unit="cm" label="Ta taille" width={W - 24} />
      </Card>
      <Why>Elle sert à choisir les longueurs : manches, ourlets, robes. Jamais affichée, jamais commentée.</Why>
    </Frame>
  );
}

/** La silhouette, choisie parmi cinq (l'estimation par photos est retirée le 09/10 : elle n'était qu'une démonstration). */
function SilhouetteStep({ draft, set, next }: Ctx) {
  const { c } = useTheme();
  const [picked, setPicked] = useState<Silhouette | null>(draft.silhouette && draft.silhouette !== 'inconnue' ? draft.silhouette : null);
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
      <Tap testID="onb-sil-unknown" onPress={() => { set({ silhouette: 'inconnue', silhouetteSource: null }); next(); }} scaleTo={1} accessibilityLabel="Je ne sais pas encore : Kodi apprendra" style={{ minHeight: 44, justifyContent: 'center' }}>
        <T v="bodyStrong" style={{ textDecorationLine: 'underline' }}>
          Je ne sais pas encore : Kodi apprendra
        </T>
      </Tap>
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
      intro="Pour t’aider à choisir une taille quand tu achètes. Aucune n’est obligatoire."
      footer={<Button testID="onb-next" label="Continuer" onPress={next} />}
    >
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="bg-stage items-center justify-center" style={{ borderRadius: 22, paddingVertical: 12, paddingHorizontal: 6 }}>
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
                <T v="stat" style={{ fontSize: 22, lineHeight: 26 }}>
                  {v ? `${v} cm` : <T v="body" tone="ink2">Ajouter</T>}
                </T>
              </Tap>
            );
          })}
        </View>
      </View>
      {active && (
        <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: 'center', gap: 8 }}>
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
          Précision de Kodi. Mètre ruban souple, à même la peau, sans serrer.
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
        <T v="kicker" tone="ink2">
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
      intro="Choisis ceux qui te ressemblent aujourd’hui. Kodi s’ajustera à ce que tu portes vraiment."
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
    <Frame lead={'Ton\n'} em="quotidien." intro="Ce qui remplit tes semaines. Kodi prépare la bonne tenue au bon moment." footer={<Button testID="onb-next" label="Continuer" onPress={next} />}>
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
              style={{ flexDirection: 'row', alignItems: 'center', width: w, height: 58, borderRadius: 18, paddingHorizontal: 14, gap: 10, borderWidth: on ? 2 : 1, borderColor: on ? c.ink : c.rule, backgroundColor: on ? c.raised : 'transparent' }}
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
      <View className="flex-row items-center bg-sunk" style={{ height: 52, borderRadius: 26, paddingHorizontal: 16, gap: 10 }}>
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
                Kodi regardera sa météo chaque matin, dès ton compte créé.
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
            Kodi prépare les jours chargés : réunion, dîner, mariage. Tu choisis les agendas, et tu arrêtes quand tu veux.
          </T>
        </View>
        <Toggle testID="onb-agenda" value={draft.agenda} onChange={(agenda) => set({ agenda })} label="Relier mon agenda" />
      </Card>
    </Frame>
  );
}

/* ---- 4. Dressing ---- */

/**
 * Le premier portant : de vraies photos (une tenue entière ou une pièce à
 * plat), jamais de pièces d'exemple. Elles restent sur l'appareil jusqu'à la
 * création du compte, puis partent chez Kodi, qui repère chaque vêtement et
 * le dessine pour les portants (state/store.tsx : sendPending).
 */
function Pieces({ draft, photos, setPhotos, next, W }: Ctx) {
  const { a } = useStore();
  const { c } = useTheme();
  const tile = (W - 3 * 8) / 4;
  const n = photos.length;
  const room = MAX_PHOTOS - n;

  const importPhotos = async (camera: boolean) => {
    if (room <= 0) return;
    try {
      if (camera && (await cameraAccess()) === 'blocked') return a.toast(CAMERA_BLOCKED, true);
      // L'appareil en rafale : il se rouvre après chaque photo, jusqu'à « Annuler ».
      const picked = camera
        ? await shootBurst({ max: room, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.7 }).then((r) => (r.canceled ? [] : r.assets.map((x) => ({ uri: x.uri, mime: x.mimeType }))));
      if (!picked.length) return;
      setPhotos([...photos, ...picked.map((x) => ({ uri: x.uri, mime: x.mime }))].slice(0, MAX_PHOTOS));
      haptic('success');
    } catch {
      // Sélection annulée : rien à faire.
    }
  };

  return (
    <Frame
      lead={'Ton premier\n'}
      em="portant."
      intro={`Ajoute des photos des pièces que tu portes souvent${draft.name ? `, ${draft.name}` : ''} : une tenue entière ou une pièce posée à plat. Kodi repère chaque vêtement et le découpe pour tes portants.`}
      footer={
        <>
          <Button testID="onb-generate" label={n ? `Confier ${n} photo${n > 1 ? 's' : ''} à Kodi` : 'Ajoute une première photo'} icon={n ? 'kode' : undefined} disabled={!n} onPress={next} />
          <Button testID="onb-later" label="Plus tard : entrer avec un dressing vide" variant="plain" onPress={() => { setPhotos([]); next(); }} />
        </>
      }
    >
      <View style={{ marginHorizontal: -space.gutter }}>
        <FirstRail pieces={[]} slots={5} size={74} />
      </View>
      <T v="caption" tone="ink2" accessibilityLiveRegion="polite">
        {n
          ? `${n} photo${n > 1 ? 's' : ''} prête${n > 1 ? 's' : ''} · Kodi découpe tes pièces dès que ton compte est créé.`
          : 'Une photo peut porter plusieurs pièces : Kodi les repère toutes, jusqu’à 10 photos à la fois.'}
      </T>
      <View className="flex-row" style={{ gap: 8 }}>
        <Button testID="onb-import" label="Importer des photos" icon="image" variant="secondary" size="m" grow disabled={room <= 0} onPress={() => importPhotos(false)} />
        {!IS_WEB && <Button label="Photographier" icon="camera" variant="secondary" size="m" grow disabled={room <= 0} onPress={() => importPhotos(true)} />}
      </View>
      {n > 0 && (
        <View className="flex-row flex-wrap" style={{ gap: 8 }} testID="onb-photos">
          {photos.map((ph, i) => (
            <Animated.View key={`${ph.uri}-${i}`} entering={FadeIn.duration(200)} style={{ backgroundColor: c.stage, width: tile, height: tile, borderRadius: 14, overflow: 'hidden' }}>
              <Image source={{ uri: ph.uri }} style={{ width: tile, height: tile }} accessibilityIgnoresInvertColors />
              <View style={{ position: 'absolute', top: 4, right: 4 }}>
                <Tap onPress={() => setPhotos(photos.filter((_, j) => j !== i))} accessibilityLabel={`Retirer la photo ${i + 1}`} hitSlop={8} scaleTo={0.9} style={{ alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 14, backgroundColor: c['glass-strong'] }}>
                  <Icon name="close" size={13} color={c.ink} strokeWidth={2.2} />
                </Tap>
              </View>
            </Animated.View>
          ))}
        </View>
      )}
      <T v="small" tone="ink2">
        Tes photos servent seulement à découper tes pièces : elles ne sont ni publiées ni partagées.
        {!online ? ' Dans cet aperçu, elles restent sur l’appareil : c’est l’app, avec ton compte, qui les confie à Kodi.' : ''}
      </T>
    </Frame>
  );
}

function Generation({ draft, photos, next }: Ctx) {
  const { c } = useTheme();
  const n = photos.length;
  const rayon = draft.rayon === 'femme' ? 'rayon femme' : draft.rayon === 'homme' ? 'rayon homme' : draft.rayon === 'mixte' ? 'rayons femme et homme' : '';
  const lines = [
    `Profil : ${rayon || 'Kodi apprendra en route'}`,
    `Style : ${draft.styles.length ? draft.styles.join(', ') : 'à découvrir avec toi'}`,
    'La météo du jour, chaque matin',
    n ? `${n} photo${n > 1 ? 's' : ''} pour Kodi : il découpe tes pièces dès ton arrivée` : 'Tes portants, prêts à se remplir',
    n ? 'Tes premières tenues, dès tes pièces dessinées' : 'Ta première tenue, dès trois pièces',
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
          Kodi prépare{'\n'}
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
  const [adult, setAdult] = useState(false);
  const nav = useNavigation<Nav>();
  const ready = validEmail(email) && (!online || password.length >= PASSWORD_MIN) && adult;
  const legal = <SignupTerms adult={adult} onAdult={setAdult} onPolicy={() => nav.navigate('Confidentialite')} />;

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

