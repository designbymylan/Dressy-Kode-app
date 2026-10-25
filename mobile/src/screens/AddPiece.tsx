import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Platform, TextInput, View } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CATEGORIES, GALLERY, type Found, type Piece, type Season } from '../data/wardrobe';
import { pieceLimit, useStore } from '../state/store';
import * as remote from '../state/remote';
import { CAMERA_BLOCKED, cameraAccess, shootBurst, type Shot } from '../lib/camera';
import { groupByPhoto, isActive, isPiece, jobNote, jobPhrases, jobStep, jobTitle, scanPieces, type Box, type JobRow, type Reveal } from '../state/jobs';
import { useTheme } from '../theme/ThemeProvider';
import { material, space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Chip } from '../ui/controls';
import { StackHeader, useStackTop } from '../ui/layout';
import { glassSurface } from '../ui/Glass';
import { Card, Gauge, Skeleton } from '../ui/bits';
import { Garment } from '../ui/Garment';
import { Icon } from '../ui/Icon';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import { AccountSheet } from '../ui/account';
import { KodeThinking } from '../ui/KodeThinking';
import { PhotoScan, RawCrop, RevealCutout, frameOf, usePreloaded } from '../ui/scan';
import type { Nav } from '../navigation/types';
import { F } from '../theme/fonts';

/** Une photo choisie sur le téléphone, avec ses proportions. */
type Picked = Shot;
/** Une photo confiée à Kodi : son chemin une fois envoyée, ou ce qui l'a arrêtée. */
type Sent = { picked: Picked; path: string | null; error?: string };

const STEPS = ['Détourage de la pièce', 'Type de pièce', 'Couleur dominante', 'Matière probable', 'Illustration pour tes portants'];

export function AddPiece() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { width } = useScreen();
  const top = useStackTop(true);
  const [found, setFound] = useState<Found | null>(null);
  const [phase, setPhase] = useState<'source' | 'analyse' | 'result' | 'suivi'>('source');
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Found | null>(null);
  const [photo, setPhoto] = useState<Picked | null>(null);
  // Compte connecté : les photos partent vraiment chez Kodi, qui repère et découpe chaque pièce.
  const live = s.account === 'connecte' && remote.online;
  // Le compte de démonstration seul garde la galerie d'exemples ; un espace sans compte n'a aucune pièce fictive.
  const demo = s.account === 'demo';
  const [account, setAccount] = useState(false);
  const waiting = s.pendingPhotos.length;
  const [hint, setHint] = useState('');
  // Précisions sur UN vêtement (marque, taille, coupe, matière) : envoyées avec la photo.
  const [details, setDetails] = useState({ brand: '', size: '', fit: '', material: '' });
  const [error, setError] = useState<string | null>(null);
  // Appareil photo refusé : le message propose d'ouvrir les Réglages.
  const [settings, setSettings] = useState(false);
  const [sent, setSent] = useState<Sent[] | null>(null);
  // La galerie de la démonstration propose d'abord ce qui n'est pas déjà dans le dressing.
  const names = new Set(s.pieces.map((p) => p.name));
  const gallery = [...GALLERY.filter((g) => !names.has(g.name)), ...GALLERY.filter((g) => names.has(g.name))];
  const limit = pieceLimit(s);
  const full = limit !== null && s.pieces.length >= limit;
  const tile = (width - space.gutter * 2 - 20) / 3;
  const burst = !demo && Platform.OS !== 'web';

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

  const pick = (f: Found, picked: Picked | null = null) => {
    setFound(f);
    setDraft(f);
    setPhoto(picked);
    setPhase('analyse');
  };

  /** Les photos partent chez Kodi ; l'écran les montre tout de suite, balayées par le scan. */
  const confide = async (picked: Picked[], withDetails = false) => {
    setSent((prev) => [...(prev ?? []), ...picked.map((p) => ({ picked: p, path: null }))]);
    setPhase('suivi');
    const r = await a.sendPhotos(picked.map((p) => ({ uri: p.uri, mime: p.mime })), hint, withDetails && picked.length === 1 ? details : undefined);
    setSent((prev) =>
      prev &&
      prev.map((x) => {
        const i = picked.indexOf(x.picked);
        return i < 0 ? x : r.ok ? { ...x, path: r.paths[i] } : { ...x, error: r.message };
      }),
    );
    return r;
  };

  /** Rien n'est parti : retour au choix de la photo, avec la raison. */
  const giveUp = (message: string) => {
    setSent(null);
    setPhase('source');
    setError(message);
  };

  /**
   * Une vraie photo (appareil ou galerie). Connectée, elle part chez Kodi ;
   * sans compte, elle attend sur le téléphone et la création du compte est
   * proposée ; dans la démonstration seule, la reconnaissance est simulée.
   */
  const fromDevice = async (camera: boolean) => {
    setError(null);
    setSettings(false);
    const native = Platform.OS !== 'web';
    try {
      if (camera && native && (await cameraAccess()) === 'blocked') {
        // Le toast passerait sous cet écran (présenté en modale) : le message reste ici.
        setSettings(true);
        return setError(CAMERA_BLOCKED);
      }
      if (camera && native && live) {
        // En rafale : chaque photo part chez Kodi pendant qu'on prend la suivante.
        const sending: ReturnType<typeof confide>[] = [];
        const shots = await shootBurst({ max: 10, quality: 0.5, onShot: (shot) => sending.push(confide([shot])) });
        if (!shots.length) return;
        const results = await Promise.all(sending);
        const first = results[0];
        if (!results.some((r) => r.ok) && first && !first.ok) giveUp(first.message);
        return;
      }
      let picked: Picked[];
      if (camera && native) {
        // Sans compte, la rafale attend sur le téléphone ; la démonstration simule une seule photo.
        picked = await shootBurst({ max: demo ? 1 : Math.max(1, 10 - waiting), quality: 0.5 });
      } else {
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, allowsMultipleSelection: !demo, selectionLimit: demo ? 1 : 10 });
        picked = r.canceled ? [] : r.assets.map((x) => ({ uri: x.uri, mime: x.mimeType, ratio: x.width && x.height ? x.width / x.height : 0.75 }));
      }
      if (!picked.length) return;
      if (live) {
        const r = await confide(picked.slice(0, 10), true);
        if (!r.ok) giveUp(r.message);
      } else if (demo) pick(gallery[0], picked[0]);
      else {
        a.queuePhotos(picked.map((p) => ({ uri: p.uri, mime: p.mime })));
        setAccount(true);
      }
    } catch (err) {
      // Une annulation ne passe jamais par ici : c'est une vraie panne, on la dit.
      const detail = err instanceof Error ? err.message : String(err);
      console.warn('[ajout] appareil photo ou galerie :', detail);
      setError(
        camera
          ? `L’appareil photo ne s’est pas ouvert. Réessaie, ou choisis la photo dans ta galerie.${isRunningInExpoGo() ? ` (${detail})` : ''}`
          : `La galerie ne s’est pas ouverte. Réessaie dans un instant.${isRunningInExpoGo() ? ` (${detail})` : ''}`,
      );
    }
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
      <Ambient />
      <StackHeader title="Ajouter une pièce" close />
      {/* Sans compte : les photos choisies attendent ; une fois le compte créé, elles partent chez Kodi. */}
      <AccountSheet visible={account} onClose={() => setAccount(false)} onDone={() => { setAccount(false); setTimeout(() => nav.goBack(), 320); }} initial={s.pendingEmail ? 'login' : 'signup'} />
      <Animated.ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 18 }}>
        {phase === 'source' && (
          <Animated.View entering={FadeIn.duration(200)} style={{ gap: 18 }}>
            <View style={{ gap: 8 }}>
              <T v="title" accessibilityRole="header">
                Une photo suffit.
              </T>
              <T v="body" tone="ink2">
                Kodi la détoure, la reconnaît et la range.
              </T>
            </View>

            {/* Une débutante voit le chemin vers sa première tenue, pas un quota (09/10). */}
            {s.pieces.length < 3 ? (
              <View style={{ gap: 6 }} testID="add-first">
                <T v="kicker" tone="ink2">
                  {`Ta première tenue : ${s.pieces.length}/3 pièces · une photo de tenue entière en compte plusieurs`}
                </T>
                <Gauge value={s.pieces.length} max={3} label="Pièces pour la première tenue" />
              </View>
            ) : limit !== null && (
              <View style={{ gap: 6 }}>
                <T v="kicker" tone={full ? 'caution' : 'ink2'}>
                  {`${s.pieces.length} / ${limit} places`}
                </T>
                <Gauge value={s.pieces.length} max={limit} label="Places utilisées dans le dressing" />
              </View>
            )}

            {full ? (
              <Card className="bg-butter" style={{ gap: 10 }} testID="add-full">
                <T v="cardTitle">Ton dressing est plein.</T>
                <T v="body" tone="ink2">
                  Tu pourrais ajouter 30 places, ou passer à Sapologue : pièces illimitées.
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
                    // Sur iPhone, l'appareil se rouvre après chaque photo (rafale), sauf dans la démonstration.
                    burst
                      ? { icon: 'camera' as const, label: 'Photo', note: 'à la suite, 10 max', hint: 'Prendre des photos à la suite. Touche Annuler quand tu as fini.' }
                      : { icon: 'camera' as const, label: 'Photo', note: 'cintre ou à plat', hint: 'Prendre une photo' },
                    { icon: 'image' as const, label: 'Galerie', note: demo ? '1 photo à la fois' : '10 photos max', hint: 'Depuis la galerie' },
                  ].map((o) => {
                    // La photo est l'action principale (noire) ; la galerie, en gris studio (05/10).
                    const main = o.icon === 'camera';
                    return (
                      <Tap key={o.label} testID={`source-${o.icon}`} onPress={() => fromDevice(main)} accessibilityLabel={o.hint} outerStyle={{ flex: 1 }} style={[{ borderRadius: 28, padding: 16, gap: 12, minHeight: 150, alignItems: 'center', justifyContent: 'center', backgroundColor: main ? c['primary-bg'] : c.stage }]}>
                        <Icon name={o.icon} size={30} color={main ? c['primary-fg'] : c.ink} />
                        <View style={{ gap: 2, alignItems: 'center' }}>
                          <T v="bodyStrong" tone={main ? 'primary-fg' : 'ink'}>{o.label}</T>
                          <T v="kicker" tone={main ? 'primary-fg' : 'ink2'}>
                            {o.note}
                          </T>
                        </View>
                      </Tap>
                    );
                  })}
                </View>
                {!demo && (
                  <View className="flex-row" style={{ gap: 8, paddingHorizontal: 4 }} testID="add-privacy">
                    <Icon name="lock" size={15} color={c.ink2} />
                    <T v="small" tone="ink2" style={{ flex: 1 }}>
                      Ta photo sert seulement à découper tes pièces, puis elle est effacée sous 30 jours. Évite d’y montrer ton visage.
                    </T>
                  </View>
                )}
                {error && (
                  <Card className="bg-butter" style={{ gap: 10 }} testID="add-error">
                    <T v="body">{error}</T>
                    {settings && <Button testID="add-settings" label="Ouvrir les Réglages" size="s" variant="secondary" onPress={() => Linking.openSettings()} />}
                  </Card>
                )}
                {live ? (
                  <View style={{ gap: 8 }}>
                    <T v="kicker" tone="ink2">
                      Seulement certaines pièces ?
                    </T>
                    <TextInput
                      testID="add-hint"
                      value={hint}
                      onChangeText={setHint}
                      maxLength={280}
                      placeholder="Par exemple : seulement la veste et le jean"
                      placeholderTextColor={c.ink2}
                      accessibilityLabel="Les pièces que Kodi doit découper, si tu ne veux pas toute la photo"
                      className="bg-sunk"
                      style={{ minHeight: 50, borderRadius: 25, paddingHorizontal: 18, color: c.ink, ...F.s400, fontSize: 16 }}
                    />
                    <T v="small" tone="ink2">
                      Sinon, Kodi range tout ce qu’il voit.
                    </T>
                    <T v="kicker" tone="ink2" style={{ marginTop: 8 }}>
                      Un seul vêtement ? Précise-le
                    </T>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                      {([
                        ['brand', 'Marque', 60],
                        ['size', 'Taille', 20],
                        ['fit', 'Coupe', 40],
                        ['material', 'Matière', 60],
                      ] as const).map(([key, label, max]) => (
                        <TextInput
                          key={key}
                          testID={`add-${key}`}
                          value={details[key]}
                          onChangeText={(v) => setDetails((d) => ({ ...d, [key]: v }))}
                          maxLength={max}
                          placeholder={label}
                          placeholderTextColor={c.ink2}
                          accessibilityLabel={`${label} du vêtement, facultatif`}
                          className="bg-sunk"
                          style={{ flexBasis: '47%', flexGrow: 1, minHeight: 50, borderRadius: 25, paddingHorizontal: 18, color: c.ink, ...F.s400, fontSize: 16 }}
                        />
                      ))}
                    </View>
                    <T v="small" tone="ink2">
                      Pour une photo à plusieurs pièces, ou en rafale, modifie l’étiquette ensuite.
                    </T>
                  </View>
                ) : !demo ? (
                  // Sans compte : aucune pièce d'exemple, l'invitation à créer le compte.
                  <Card className="bg-butter" style={{ gap: 10 }} testID="add-account">
                    <T v="cardTitle">{waiting ? `${waiting} photo${waiting > 1 ? 's' : ''} attend${waiting > 1 ? 'ent' : ''} ton compte.` : 'Kodi découpe tes pièces avec ton compte.'}</T>
                    <T v="body" tone="ink2">
                      {remote.online
                        ? 'Gratuit, en une minute : Kodi range chaque vêtement de tes photos.'
                        : 'Dans cet aperçu, Kodi ne reçoit pas les photos.'}
                    </T>
                    {remote.online && <Button testID="add-create-account" label="Créer mon compte" size="m" onPress={() => setAccount(true)} />}
                  </Card>
                ) : (
                <>
                <T v="kicker" tone="ink2">
                  Photos d’exemple
                </T>
                <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                  {gallery.slice(0, 9).map((g, i) => (
                    <Tap key={g.name} testID={`photo-${i}`} onPress={() => pick(g)} accessibilityLabel={`Photo ${i + 1}`} style={{ alignItems: 'center', justifyContent: 'center', width: tile, height: tile * 1.2, borderRadius: 14, backgroundColor: g.backdrop, overflow: 'hidden' }}>
                      <View style={{ transform: [{ rotate: `${((i % 3) - 1) * 4}deg` }], opacity: 0.92 }}>
                        <Garment kind={g.kind} tint={g.tint} size={tile * 0.7} />
                      </View>
                    </Tap>
                  ))}
                </View>
                </>
                )}
                <T v="small" tone="ink2">
                  Tes photos servent seulement à découper la pièce. Elles ne sont ni publiées ni partagées.
                </T>
              </>
            )}
          </Animated.View>
        )}

        {phase === 'analyse' && found && (
          <Animated.View entering={FadeIn.duration(200)} style={{ gap: 20 }} accessibilityLiveRegion="polite">
            <T v="title">Kodi regarde ta pièce…</T>
            <DemoScan found={found} photo={photo} step={step} width={width - space.gutter * 2} />
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
              <RevealCutout
                frame={[184, 230]}
                size={[width - space.gutter * 2, 250]}
                label={draft.name}
                raw={
                  <View className="items-center justify-center" style={{ width: 184, height: 230, borderRadius: 6, backgroundColor: found?.backdrop }}>
                    <Garment kind={draft.kind} tint={draft.tint} size={170} />
                  </View>
                }
                cut={
                  <View className="items-center justify-center" style={{ width: 184, height: 230 }}>
                    <Garment kind={draft.kind} tint={draft.tint} size={170} dark={scheme === 'dark'} label={draft.name} />
                  </View>
                }
              />
            </View>
            <View style={{ gap: 4 }}>
              <T v="kicker" tone="positive">
                Reconnue avec confiance
              </T>
              <T v="body" tone="ink2">
                Vérifie la matière : c’est ce que Kodi devine le moins bien sur une photo.
              </T>
              {photo && Platform.OS === 'web' && (
                <T v="small" tone="ink2">
                  Aperçu : la reconnaissance de ta photo est simulée.
                </T>
              )}
            </View>
            <View style={{ gap: 8 }}>
              <T v="kicker" tone="ink2">
                Nom
              </T>
              <TextInput
                testID="add-name"
                value={draft.name}
                onChangeText={(name) => setDraft({ ...draft, name })}
                accessibilityLabel="Nom de la pièce"
                className="bg-sunk"
                style={{ height: 50, borderRadius: 25, paddingHorizontal: 18, color: c.ink, ...F.s500, fontSize: 16 }}
              />
            </View>
            <View style={{ gap: 8 }}>
              <T v="kicker" tone="ink2">
                Catégorie
              </T>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {CATEGORIES.map((cat) => (
                  <Chip key={cat.id} label={cat.short} on={draft.category === cat.id} onPress={() => setDraft({ ...draft, category: cat.id })} />
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <T v="kicker" tone="ink2">
                Matière
              </T>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {[draft.material, 'Coton', 'Laine', 'Lin', 'Synthétique'].filter((m, i, arr) => arr.indexOf(m) === i).map((m) => (
                  <Chip key={m} label={m} on={draft.material === m} onPress={() => setDraft({ ...draft, material: m })} />
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <T v="kicker" tone="ink2">
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
        {phase === 'suivi' && sent && (
          <LiveTracking
            sent={sent}
            hint={hint}
            onAgain={() => {
              setSent(null);
              setHint('');
              setPhase('source');
            }}
          />
        )}
      </Animated.ScrollView>
    </View>
  );
}

/**
 * Sans compte, le repérage est simulé : la photo (ou le dessin de la
 * galerie) est balayée par le faisceau, puis la pièce s'encadre avec son nom.
 */
function DemoScan({ found, photo, step, width }: { found: Found; photo: Picked | null; step: number; width: number }) {
  const h = 240;
  const g = 150;
  // Le cadre de l'illustration centrée, à peu près là où la pièce est dessinée.
  const box: Box = photo ? [0.2, 0.12, 0.6, 0.76] : [((width - g) / 2 + g * 0.1) / width, ((h - g * 1.25) / 2 + g * 1.25 * 0.08) / h, (g * 0.8) / width, (g * 1.25 * 0.86) / h];
  const pieces = step >= 2 ? [{ key: 'demo', name: found.name, box, state: step >= STEPS.length ? ('done' as const) : ('working' as const) }] : [];
  return (
    <PhotoScan
      width={width}
      ratio={photo ? photo.ratio : width / h}
      photo={photo?.uri}
      art={
        <View className="items-center justify-center" style={{ width, height: h, backgroundColor: found.backdrop }}>
          <Garment kind={found.kind} tint={found.tint} size={g} />
        </View>
      }
      pieces={pieces}
      scanning={step < 2}
    />
  );
}

/**
 * Le suivi en direct, compte connecté : chaque photo confiée s'affiche en
 * grand (scan de repérage), avec une ligne par pièce repérée. Quand une
 * pièce est rangée sous nos yeux, sa ligne joue le détourage révélé. En
 * rafale, les photos s'ajoutent au fil des prises.
 */
function LiveTracking({ sent, hint, onAgain }: { sent: Sent[]; hint: string; onAgain: () => void }) {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const { width } = useScreen();
  const W = width - space.gutter * 2;
  const key = sent.map((x) => x.path ?? '').join('|');
  const paths = useMemo(() => key.split('|').filter(Boolean), [key]);
  const jobs = useMemo(() => s.jobs.filter((j) => paths.includes(j.source_paths[0])), [s.jobs, paths]);
  const [reveals, setReveals] = useState<Record<string, Reveal>>({});
  const [cuts, setCuts] = useState<Record<string, string>>({});
  const seen = useRef(new Map<string, string>());
  const working = sent.some((x) => !x.path && !x.error) || jobs.some(isActive);

  // Toutes les deux secondes tant que Kodi travaille (quelques octets).
  useEffect(() => {
    if (!paths.length || !working) return;
    const t = setInterval(() => a.readJobs(paths).catch(() => undefined), 2000);
    return () => clearInterval(t);
  }, [paths, working, a]);

  // Une pièce qui passe à « rangée » sous nos yeux joue son détourage ; une pièce déjà rangée montre sa vignette.
  useEffect(() => {
    const arrived: JobRow[] = [];
    const already: JobRow[] = [];
    for (const j of jobs) {
      const before = seen.current.get(j.id);
      if (j.status === 'done' && isPiece(j)) {
        if (before && before !== 'done') arrived.push(j);
        else if (!before) already.push(j);
      }
      seen.current.set(j.id, j.status);
    }
    if (arrived.length) remote.revealsFor(arrived).then((r) => setReveals((prev) => ({ ...prev, ...r }))).catch(() => undefined);
    if (already.length) {
      remote
        .revealsFor(already)
        .then((r) => setCuts((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(r).map(([id, x]) => [id, x.cut])) })))
        .catch(() => undefined);
    }
  }, [jobs]);

  const revealed = (id: string) => {
    const cut = reveals[id]?.cut;
    if (cut) setCuts((prev) => ({ ...prev, [id]: cut }));
    setReveals((prev) => {
      const rest = { ...prev };
      delete rest[id];
      return rest;
    });
  };

  const playing = Object.keys(reveals).length > 0;
  const anyDone = jobs.some((j) => j.status === 'done' && isPiece(j));
  const groups = new Map(groupByPhoto(jobs).map((g) => [g.key, g.jobs]));

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ gap: 22 }} accessibilityLiveRegion="polite">
      <View style={{ gap: 8 }}>
        <T v="title" accessibilityRole="header">
          {working || playing ? 'Kodi s’occupe\n' : 'Tout est\n'}
          <T v="title" style={{ ...F.accent }}>
            {working || playing ? 'de tes photos.' : 'rangé.'}
          </T>
        </T>
        <T v="body" tone="ink2">
          {working || playing
            ? 'Il repère chaque pièce et les découpe en même temps. Chacune arrive sur tes portants, détourée, sans fond.'
            : 'Tes pièces sont sur tes portants, détourées et sans fond.'}
        </T>
      </View>

      {sent.map((x) => {
        const list = x.path ? groups.get(x.path) : undefined;
        // Une photo retirée (« Retirer ») quitte le suivi.
        if (x.path && !list) return null;
        // Pas encore arrivée chez Kodi (ou arrêtée en route) : la photo seule.
        if (!list) {
          return (
            <View key={x.picked.uri} style={{ gap: 12 }}>
              <PhotoScan width={W} ratio={x.picked.ratio} photo={x.picked.uri} pieces={[]} scanning={!x.error} dim={Boolean(x.error)} />
              {x.error ? (
                <T v="body" tone="ink2">
                  {x.error}
                </T>
              ) : (
                <KodeThinking phrases={['Kodi reçoit ta photo', 'Kodi la regarde de près']} step="look" center every={2000} />
              )}
            </View>
          );
        }
        const parent = list.find((j) => !j.parent_id) ?? null;
        const pieceJobs = list.filter(isPiece);
        const scanning = Boolean(parent && !parent.target && !parent.analysis?.inventory && isActive(parent));
        const failedPhoto = list.filter((j) => !isPiece(j) && j.status === 'failed');
        const note = parent ? jobNote(parent) : null;
        return (
          <View key={x.picked.uri} style={{ gap: 12 }}>
            <PhotoScan width={W} ratio={x.picked.ratio} photo={x.picked.uri} pieces={scanPieces(list, reveals)} scanning={scanning} dim={failedPhoto.length === list.length} />
            {scanning && parent ? <KodeThinking phrases={jobPhrases(parent)} step={jobStep(parent)} center every={2400} /> : null}
            {note ? (
              <T v="caption" tone="ink2" style={{ textAlign: 'center' }}>
                {note}
              </T>
            ) : null}
            {hint.trim() ? (
              <T v="caption" tone="ink2" style={{ textAlign: 'center' }}>
                « {hint.trim()} »
              </T>
            ) : null}
            {failedPhoto.map((j) => (
              <View key={j.id} style={{ gap: 8 }}>
                <T v="body" tone="ink2">
                  {j.error ?? 'Kodi n’a pas pu lire cette photo.'}
                </T>
                <JobActions job={j} />
              </View>
            ))}
            {pieceJobs.map((j) => (
              <PieceRow key={j.id} job={j} reveal={reveals[j.id]} cut={cuts[j.id]} onRevealed={() => revealed(j.id)} />
            ))}
          </View>
        );
      })}

      {working || playing ? (
        <View style={{ gap: 10 }}>
          <T v="small" tone="ink2" style={{ textAlign: 'center' }}>
            Tu peux quitter cet écran : tes pièces arriveront sur tes portants.
          </T>
          <Button label="Revenir plus tard" variant="secondary" onPress={() => nav.goBack()} />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {anyDone && <Button testID="add-see-rails" label="Voir mes portants" icon="hanger" onPress={() => nav.navigate('Tabs', { screen: 'Dressing', params: { view: 'portants' } })} />}
          <Button label="Confier une autre photo" variant={anyDone ? 'secondary' : 'primary'} icon="camera" onPress={onAgain} />
        </View>
      )}
    </Animated.View>
  );
}

/** Une pièce repérée : son dessin (ou son détourage qui se joue), son nom, où en est Kodi. */
function PieceRow({ job, reveal, cut, onRevealed }: { job: JobRow; reveal?: Reveal; cut?: string; onRevealed: () => void }) {
  const { c, scheme } = useTheme();
  const reduced = useReducedMotion();
  const failed = job.status === 'failed';
  const done = job.status === 'done' && !reveal;
  const big = reveal ? 136 : 72;
  const frame = reveal ? frameOf(reveal, big) : ([big, big] as [number, number]);
  const ready = usePreloaded(reveal ? [reveal.raw, reveal.cut] : []);
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced || !isActive(job)) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(withSequence(withTiming(0.45, { duration: 900 }), withTiming(1, { duration: 900 })), -1);
  }, [job.status, reduced, pulse]); // eslint-disable-line react-hooks/exhaustive-deps
  const breathing = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View className="flex-row items-center" style={{ gap: 12 }}>
      <View className="bg-stage items-center justify-center" style={{ width: big, height: big, borderRadius: 18, overflow: 'hidden' }}>
        {reveal ? (
          <RevealCutout
            frame={frame}
            size={[big, big]}
            ready={ready}
            label={jobTitle(job)}
            onDone={onRevealed}
            raw={<RawCrop reveal={reveal} frame={frame} />}
            cut={<Image source={{ uri: reveal.cut }} style={{ width: frame[0], height: frame[1] }} resizeMode="contain" />}
          />
        ) : done && cut ? (
          <Animated.View entering={FadeIn.duration(260)}>
            <Image source={{ uri: cut }} style={{ width: 62, height: 62 }} resizeMode="contain" />
          </Animated.View>
        ) : (
          <Animated.View style={breathing}>
            <Garment kind={remote.garmentKindOf(job.target?.category, job.target?.kind)} tint={c.faint} size={46} dark={scheme === 'dark'} />
          </Animated.View>
        )}
      </View>
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <T v="bodyStrong" numberOfLines={2}>
          {jobTitle(job)}
        </T>
        {failed ? (
          <>
            <T v="caption" tone="ink2">
              {job.error ?? 'Kodi n’a pas pu finir cette pièce.'}
            </T>
            <JobActions job={job} />
          </>
        ) : done ? (
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Icon name="check" size={15} color={c.positive} strokeWidth={2.4} />
            <T v="caption" tone="positive" style={{ flexShrink: 1 }}>
              Rangée sur ton portant, sans fond
            </T>
          </View>
        ) : reveal ? (
          <KodeThinking phrases={['Kodi enlève le fond', 'Kodi la pose sur ton portant']} step="store" size={18} every={1400} style={{ minHeight: 24, gap: 8 }} />
        ) : (
          <KodeThinking phrases={jobPhrases(job)} step={jobStep(job)} size={18} every={2600} style={{ minHeight: 24, gap: 8 }} />
        )}
      </View>
    </View>
  );
}

/** Relancer une pièce en échec (deux fois au plus) ou la retirer. */
function JobActions({ job }: { job: JobRow }) {
  const { a } = useStore();
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<unknown>) => {
    setBusy(true);
    fn().finally(() => setBusy(false));
  };
  return (
    <View className="flex-row" style={{ gap: 8 }}>
      {job.retries < 2 && <Button label="Réessayer" size="s" icon="refresh" loading={busy} onPress={() => run(() => a.retryJob(job.id).then(() => a.readJobs(job.source_paths)))} />}
      <Button label="Retirer" size="s" variant="plain" disabled={busy} onPress={() => run(() => a.dismissJob(job.id))} />
    </View>
  );
}
