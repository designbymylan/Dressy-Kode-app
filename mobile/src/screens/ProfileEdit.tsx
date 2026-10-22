/**
 * Modifier le profil (07/10) : la photo, le prénom, le nom, le pseudonyme et
 * ce qui s'affiche ; puis ce que Kodi retient de toi (styles, couleurs,
 * tailles, ville), sur le modèle des grandes boutiques où chaque compte
 * se règle à sa main. La photo part tout de suite ; le reste à
 * « Enregistrer », pour qu'un pseudonyme déjà pris ne se perde pas.
 */
import { useState, type ReactNode } from 'react';
import { Platform, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { COLOR_CHOICES } from '../data/wardrobe';
import { CITIES, STYLE_CARDS, cleanUsername, displayName, sizeOptions, usernameOk, type NameDisplay } from '../state/profile';
import { useStore } from '../state/store';
import { CAMERA_BLOCKED, cameraAccess } from '../lib/camera';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { F } from '../theme/fonts';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Ambient } from '../ui/Ambient';
import { Chip } from '../ui/controls';
import { Avatar, Card, Group, Row, Tag } from '../ui/bits';
import { ColorChoice, type ColorState } from '../ui/onboarding';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import type { Nav } from '../navigation/types';

const DISPLAY: { id: NameDisplay; label: string }[] = [
  { id: 'prenom', label: 'Mon prénom' },
  { id: 'prenom_nom', label: 'Prénom et nom' },
  { id: 'pseudo', label: 'Mon pseudo' },
];

export function ProfileEdit() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const p = s.profile;

  const [name, setName] = useState(p.name);
  const [lastName, setLastName] = useState(p.lastName ?? '');
  const [username, setUsername] = useState(p.username ?? '');
  const [show, setShow] = useState<NameDisplay>(p.nameDisplay);
  const [styles, setStyles] = useState(p.styles);
  const [love, setLove] = useState(p.love);
  const [avoid, setAvoid] = useState(p.avoid);
  const [sizes, setSizes] = useState(p.sizes);
  const [city, setCity] = useState(p.city);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowW, setRowW] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pseudoBad = username.length > 0 && !usernameOk(username);
  const draft = { name: name.trim(), lastName: lastName.trim() || null, username: username || null, nameDisplay: show };
  // Un choix d'affichage sans ce qu'il montre retombe sur le prénom.
  const usable = (d: NameDisplay) => (d === 'prenom_nom' ? !!draft.lastName : d === 'pseudo' ? !!draft.username && !pseudoBad : true);
  const shown = usable(show) ? show : 'prenom';
  const ok = draft.name.length > 0 && !pseudoBad;
  const preview = displayName({ ...draft, nameDisplay: shown }) || 'Ton prénom';
  const sizeChoices = sizeOptions(p.rayon);

  const pickPhoto = async (camera: boolean) => {
    setPhotoOpen(false);
    try {
      if (camera && Platform.OS !== 'web' && (await cameraAccess()) === 'blocked') return a.toast(CAMERA_BLOCKED, true);
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
      const r = camera && Platform.OS !== 'web' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled || !r.assets.length) return;
      setPhotoBusy(true);
      const res = await a.setAvatar({ uri: r.assets[0].uri, mime: r.assets[0].mimeType });
      a.toast(res.ok ? 'Ta photo est en place' : res.message, !res.ok);
    } catch (e) {
      console.warn('[profil] photo :', e instanceof Error ? e.message : e);
      a.toast(camera ? 'L’appareil photo ne s’est pas ouvert. Réessaie, ou choisis une photo.' : 'La galerie ne s’est pas ouverte. Réessaie dans un instant.', true);
    } finally {
      setPhotoBusy(false);
    }
  };

  const cycle = (name: string) => {
    const st: ColorState = love.includes(name) ? 'aime' : avoid.includes(name) ? 'evite' : null;
    const l = love.filter((x) => x !== name);
    const v = avoid.filter((x) => x !== name);
    if (st === null) (setLove([...l, name]), setAvoid(v));
    else if (st === 'aime') (setLove(l), setAvoid([...v, name]));
    else (setLove(l), setAvoid(v));
  };

  const save = async () => {
    if (!ok || saving) return;
    setSaving(true);
    setError(null);
    const r = await a.saveIdentity({ ...draft, nameDisplay: shown });
    setSaving(false);
    if (!r.ok) return setError(r.message);
    a.setProfile({ styles, love, avoid, sizes, city });
    a.toast('Profil enregistré');
    nav.goBack();
  };

  const input = { flex: 1, height: 52, color: c.ink, ...F.s500, fontSize: 16 } as const;

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-profile-edit">
      <Ambient />
      <StackHeader title="Mon profil" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 110, gap: 14 }}>
        {/* La photo et le nom tel qu'il s'affichera. */}
        <View className="items-center" style={{ gap: 12, paddingBottom: 6 }}>
          <Tap testID="profile-photo" onPress={() => setPhotoOpen(true)} accessibilityLabel={p.avatar ? 'Changer la photo de profil' : 'Ajouter une photo de profil'} scaleTo={0.97}>
            <View style={{ padding: 4, borderRadius: 64, borderWidth: 1, borderColor: c['rule-strong'], opacity: photoBusy ? 0.5 : 1 }}>
              <Avatar name={draft.name || '?'} uri={p.avatar} size={112} on />
            </View>
            <View style={{ position: 'absolute', right: 2, bottom: 2, width: 38, height: 38, borderRadius: 19, backgroundColor: c['primary-bg'], alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.paper }}>
              <Icon name="camera" size={17} color={c['primary-fg']} strokeWidth={1.9} />
            </View>
          </Tap>
          <T v="hero" numberOfLines={1} adjustsFontSizeToFit style={{ textAlign: 'center', maxWidth: '100%', textTransform: shown === 'pseudo' ? 'none' : 'uppercase' }} testID="profile-preview">
            {preview}
          </T>
        </View>

        <Card style={{ gap: 14 }}>
          <Tag label="Ton nom" />
          <Field label="Prénom">
            <TextInput testID="profile-name" value={name} onChangeText={setName} maxLength={40} placeholder="Ton prénom" placeholderTextColor={c.ink2} autoComplete="given-name" textContentType="givenName" accessibilityLabel="Prénom" style={input} />
          </Field>
          <Field label="Nom">
            <TextInput testID="profile-lastname" value={lastName} onChangeText={setLastName} maxLength={60} placeholder="Facultatif" placeholderTextColor={c.ink2} autoComplete="family-name" textContentType="familyName" accessibilityLabel="Nom" style={input} />
          </Field>
          <Field label="Pseudo" hint={pseudoBad ? '3 signes au moins : lettres, chiffres, point ou tiret bas.' : error ?? undefined} bad={pseudoBad || !!error}>
            <T v="body" tone="ink2" style={F.s500}>
              @
            </T>
            <TextInput
              testID="profile-username"
              value={username}
              onChangeText={(v) => {
                setError(null);
                setUsername(cleanUsername(v));
              }}
              maxLength={24}
              placeholder="ton.pseudo"
              placeholderTextColor={c.ink2}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              accessibilityLabel="Pseudo"
              style={input}
            />
            {username.length > 0 && !pseudoBad && <Icon name="check" size={18} color={c.positive} strokeWidth={2.2} />}
          </Field>
        </Card>

        <Card style={{ gap: 12 }}>
          <Tag label="Ce qui s’affiche" />
          <View accessibilityRole="radiogroup" accessibilityLabel="Ce qui s’affiche" style={{ gap: 0 }}>
            {DISPLAY.map((d, i) => {
              const can = usable(d.id);
              const on = shown === d.id;
              const sample = displayName({ ...draft, nameDisplay: d.id });
              return (
                <Tap
                  key={d.id}
                  testID={`display-${d.id}`}
                  onPress={() => (can ? setShow(d.id) : a.toast(d.id === 'pseudo' ? 'Choisis d’abord un pseudo' : 'Ajoute d’abord ton nom'))}
                  feedback="select"
                  scaleTo={0.99}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, disabled: !can }}
                  accessibilityLabel={`${d.label}${can ? `, ${sample}` : ''}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, borderBottomWidth: i === DISPLAY.length - 1 ? 0 : 1, borderColor: c.rule, opacity: can ? 1 : 0.5 }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: on ? 7 : 1.5, borderColor: on ? c.ink : c.control }} />
                  <T v="body" style={[F.s500, { flex: 1 }]}>
                    {d.label}
                  </T>
                  <T v="kicker" tone="ink2" numberOfLines={1} style={{ maxWidth: '45%' }}>
                    {can ? sample : d.id === 'pseudo' ? 'pas de pseudo' : 'pas de nom'}
                  </T>
                </Tap>
              );
            })}
          </View>
        </Card>

        <Card style={{ gap: 12 }}>
          <Tag label="Ton style" />
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {STYLE_CARDS.map((x) => (
              <Chip key={x.name} testID={`profile-style-${x.name}`} label={x.name} on={styles.includes(x.name)} onPress={() => setStyles(styles.includes(x.name) ? styles.filter((v) => v !== x.name) : [...styles, x.name])} />
            ))}
          </View>
        </Card>

        <Card style={{ gap: 12 }}>
          <Tag label="Tes couleurs" />
          <T v="kicker" tone="ink2">
            Une touche : aimée · deux : évitée
          </T>
          <View className="flex-row flex-wrap" style={{ rowGap: 12 }} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
            {rowW > 0 &&
              COLOR_CHOICES.map((x) => (
                <ColorChoice key={x.name} name={x.name} hex={x.hex} state={love.includes(x.name) ? 'aime' : avoid.includes(x.name) ? 'evite' : null} onPress={() => cycle(x.name)} width={rowW / 4} size={46} />
              ))}
          </View>
        </Card>

        <Card style={{ gap: 14 }}>
          <Tag label="Tes tailles" />
          {(
            [
              ['haut', 'Haut'],
              ['bas', 'Bas'],
              ['pointure', 'Pointure'],
            ] as const
          ).map(([k, label]) => (
            <View key={k} style={{ gap: 8 }}>
              <T v="kicker" tone="ink2">
                {label}
              </T>
              <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {sizeChoices[k].map((v) => (
                  <Chip key={v} testID={`size-${k}-${v}`} label={v} on={sizes[k] === v} onPress={() => setSizes({ ...sizes, [k]: sizes[k] === v ? undefined : v })} />
                ))}
              </Animated.ScrollView>
            </View>
          ))}
        </Card>

        <Card style={{ gap: 12 }}>
          <Tag label="Ta ville" />
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {[...new Set([...(city && !CITIES.includes(city) ? [city] : []), ...CITIES])].map((v) => (
              <Chip key={v} label={v} on={city === v} onPress={() => setCity(city === v ? null : v)} />
            ))}
          </View>
        </Card>

        <Group>
          <Row icon="ruler" title="Ma silhouette et mes mesures" onPress={() => nav.navigate('Silhouette')} last testID="profile-silhouette" />
        </Group>
      </Animated.ScrollView>

      <View style={{ position: 'absolute', left: space.gutter, right: space.gutter, bottom: insets.bottom + 16 }}>
        <Button testID="profile-save" label="Enregistrer" onPress={save} disabled={!ok} loading={saving} />
      </View>

      <Sheet visible={photoOpen} onClose={() => setPhotoOpen(false)} title="Photo de profil" testID="photo-sheet">
        <View style={{ gap: 0 }}>
          {Platform.OS !== 'web' && <Row icon="camera" title="Prendre une photo" onPress={() => pickPhoto(true)} testID="photo-camera" />}
          <Row icon="image" title="Choisir dans la galerie" onPress={() => pickPhoto(false)} testID="photo-library" last={!p.avatar} />
          {p.avatar && (
            <Row
              icon="trash"
              title="Retirer la photo"
              onPress={async () => {
                setPhotoOpen(false);
                await a.setAvatar(null);
              }}
              testID="photo-remove"
              last
            />
          )}
        </View>
      </Sheet>
    </View>
  );
}

function Field({ label, hint, bad, children }: { label: string; hint?: string; bad?: boolean; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T v="kicker" tone="ink2">
        {label}
      </T>
      <View className="flex-row items-center" style={{ height: 52, borderRadius: 26, paddingHorizontal: 18, gap: 6, backgroundColor: c.sunk, borderWidth: bad ? 1.5 : 0, borderColor: c.caution }}>
        {children}
      </View>
      {hint ? (
        <T v="small" tone={bad ? 'caution' : 'ink2'}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}
