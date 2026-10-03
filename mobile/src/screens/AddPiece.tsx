import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CATEGORIES, GALLERY, type Found, type Piece, type Season } from '../data/wardrobe';
import { pieceLimit, useStore } from '../state/store';
import * as remote from '../state/remote';
import { groupByPhoto, isActive, isPiece, jobNote, jobPhrases, jobStep, jobTitle, scanPieces, type Box, type JobRow, type Reveal } from '../state/jobs';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Chip } from '../ui/controls';
import { StackHeader, useStackTop } from '../ui/layout';
import { Card, Gauge, Skeleton } from '../ui/bits';
import { Garment } from '../ui/Garment';
import { Icon } from '../ui/Icon';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import { KodeThinking } from '../ui/KodeThinking';
import { PhotoScan, RawCrop, RevealCutout, frameOf, usePreloaded } from '../ui/scan';
import type { Nav } from '../navigation/types';
import { F } from '../theme/fonts';

/** Une photo choisie sur le téléphone, avec ses proportions. */
type Picked = { uri: string; ratio: number; mime?: string | null };

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
  // Compte connecté : les photos partent vraiment chez Kode, qui repère et dessine chaque pièce.
  const live = s.account === 'connecte' && remote.online;
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ picked: Picked[]; paths: string[] | null } | null>(null);
  // La galerie simulée propose d'abord ce qui n'est pas déjà dans le dressing.
  const names = new Set(s.pieces.map((p) => p.name));
  const gallery = [...GALLERY.filter((g) => !names.has(g.name)), ...GALLERY.filter((g) => names.has(g.name))];
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

  const pick = (f: Found, picked: Picked | null = null) => {
    setFound(f);
    setDraft(f);
    setPhoto(picked);
    setPhase('analyse');
  };

  /** Les photos partent chez Kode ; l'écran les montre tout de suite, balayées par le scan. */
  const confide = async (picked: Picked[]) => {
    setError(null);
    setSent({ picked, paths: null });
    setPhase('suivi');
    const r = await a.sendPhotos(picked.map((p) => ({ uri: p.uri, mime: p.mime })), hint);
    if (!r.ok) {
      setSent(null);
      setPhase('source');
      return setError(r.message);
    }
    setSent({ picked, paths: r.paths });
  };

  /** Une vraie photo (appareil ou galerie). Sans compte, la reconnaissance est simulée. */
  const fromDevice = async (camera: boolean) => {
    try {
      if (camera && Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return a.toast('Autorise l’appareil photo dans Réglages');
      }
      const r =
        camera && Platform.OS !== 'web'
          ? await ImagePicker.launchCameraAsync({ quality: 0.5 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, allowsMultipleSelection: live, selectionLimit: live ? 10 : 1 });
      if (r.canceled || !r.assets.length) return;
      const picked = r.assets.map((x) => ({ uri: x.uri, mime: x.mimeType, ratio: x.width && x.height ? x.width / x.height : 0.75 }));
      if (live) confide(picked.slice(0, 10));
      else pick(gallery[0], picked[0]);
    } catch {
      // Annulé : on reste sur le choix de la source.
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
              <Card className="bg-butter" style={{ gap: 10 }} testID="add-full">
                <T v="cardTitle">Ton dressing est plein.</T>
                <T v="body" tone="ink2">
                  Tu pourrais ajouter 30 places pour 4,99 €, une seule fois, ou passer à Atelier, jusqu’à 200 pièces.
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
                    { icon: 'image' as const, label: 'Depuis la galerie', note: live ? 'Jusqu’à 10 à la fois' : 'Une photo à la fois' },
                  ].map((o) => (
                    <Tap key={o.label} testID={`source-${o.icon}`} onPress={() => fromDevice(o.icon === 'camera')} accessibilityLabel={o.label} outerStyle={{ flex: 1 }} className="bg-stage" style={{ borderRadius: 22, padding: 16, gap: 18, minHeight: 128 }}>
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
                {error && (
                  <Card className="bg-butter" style={{ gap: 6 }} testID="add-error">
                    <T v="body">{error}</T>
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
                      accessibilityLabel="Les pièces que Kode doit dessiner, si tu ne veux pas toute la photo"
                      className="bg-sunk"
                      style={{ minHeight: 50, borderRadius: 25, paddingHorizontal: 18, color: c.ink, ...F.s400, fontSize: 16 }}
                    />
                    <T v="small" tone="ink2">
                      Sinon, Kode dessine toutes les pièces qu’il voit : vêtements, chaussures, sacs et bijoux.
                    </T>
                  </View>
                ) : (
                <>
                <T v="kicker" tone="ink2">
                  Photos récentes
                </T>
                <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                  {gallery.slice(0, 9).map((g, i) => (
                    <Tap key={g.name} testID={`photo-${i}`} onPress={() => pick(g)} accessibilityLabel={`Photo ${i + 1}`} style={{ width: tile, height: tile * 1.2, borderRadius: 14, backgroundColor: g.backdrop, overflow: 'hidden' }} className="items-center justify-center">
                      <View style={{ transform: [{ rotate: `${((i % 3) - 1) * 4}deg` }], opacity: 0.92 }}>
                        <Garment kind={g.kind} tint={g.tint} size={tile * 0.7} />
                      </View>
                    </Tap>
                  ))}
                </View>
                </>
                )}
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
                Vérifie la matière : c’est ce que Kode devine le moins bien sur une photo.
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
            picked={sent.picked}
            paths={sent.paths}
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
 * pièce est rangée sous nos yeux, sa ligne joue le détourage révélé.
 */
function LiveTracking({ picked, paths, hint, onAgain }: { picked: Picked[]; paths: string[] | null; hint: string; onAgain: () => void }) {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const { width } = useScreen();
  const W = width - space.gutter * 2;
  const jobs = useMemo(() => (paths ? s.jobs.filter((j) => paths.includes(j.source_paths[0])) : []), [s.jobs, paths]);
  const [reveals, setReveals] = useState<Record<string, Reveal>>({});
  const [cuts, setCuts] = useState<Record<string, string>>({});
  const seen = useRef(new Map<string, string>());
  const working = !paths || jobs.some(isActive);

  // Toutes les deux secondes tant que Kode travaille (quelques octets).
  useEffect(() => {
    if (!paths || !working) return;
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
  const groups = paths ? groupByPhoto(jobs) : [];

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ gap: 22 }} accessibilityLiveRegion="polite">
      <View style={{ gap: 8 }}>
        <T v="title" accessibilityRole="header">
          {working || playing ? 'Kode s’occupe\n' : 'Tout est\n'}
          <T v="title" style={{ ...F.accent }}>
            {working || playing ? 'de tes photos.' : 'rangé.'}
          </T>
        </T>
        <T v="body" tone="ink2">
          {working || playing
            ? 'Il repère chaque pièce et les dessine en même temps. Chacune arrive sur tes portants, détourée, sans fond.'
            : 'Tes pièces sont sur tes portants, détourées et sans fond.'}
        </T>
      </View>

      {!paths
        ? picked.map((p) => (
            <View key={p.uri} style={{ gap: 12 }}>
              <PhotoScan width={W} ratio={p.ratio} photo={p.uri} pieces={[]} scanning />
              <KodeThinking phrases={['Kode reçoit tes photos', 'Kode les regarde de près']} step="look" center every={2000} />
            </View>
          ))
        : groups.map((g, gi) => {
            const parent = g.jobs.find((j) => !j.parent_id) ?? null;
            const pieceJobs = g.jobs.filter(isPiece);
            const scanning = Boolean(parent && !parent.target && !parent.analysis?.inventory && isActive(parent));
            const failedPhoto = g.jobs.filter((j) => !isPiece(j) && j.status === 'failed');
            const local = picked[paths.indexOf(g.key)] ?? picked[gi];
            const note = parent ? jobNote(parent) : null;
            return (
              <View key={g.key} style={{ gap: 12 }}>
                <PhotoScan width={W} ratio={local?.ratio ?? 0.75} photo={local?.uri} pieces={scanPieces(g.jobs, reveals)} scanning={scanning} dim={failedPhoto.length === g.jobs.length} />
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
                      {j.error ?? 'Kode n’a pas pu lire cette photo.'}
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

/** Une pièce repérée : son dessin (ou son détourage qui se joue), son nom, où en est Kode. */
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
              {job.error ?? 'Kode n’a pas pu finir cette pièce.'}
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
          <KodeThinking phrases={['Kode enlève le fond', 'Kode la pose sur ton portant']} step="store" size={18} every={1400} style={{ minHeight: 24, gap: 8 }} />
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
