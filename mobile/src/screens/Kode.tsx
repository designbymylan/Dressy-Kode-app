import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, TextInput, View, type ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { lcFirst, type Piece } from '../data/wardrobe';
import { kodeStarters, type KodeMessage } from '../state/kode';
import { LIMITS, eventsOn, questionsLeft, useMeteo, useStore } from '../state/store';
import { isoOf } from '../state/planning';
import { dateLongue, jourIso, periode } from '../state/contexte';
import { Credit } from '../ui/Credit';
import { canCompose } from '../state/outfits';
import { useTheme } from '../theme/ThemeProvider';
import { motion, space, TAB_CLEARANCE } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button, IconButton } from '../ui/Button';
import { TabHeader, useHeaderScroll, useTabTop } from '../ui/layout';
import { Card, DotChip, Tag } from '../ui/bits';
import { OutfitBoard, assembleDelay } from '../ui/outfit';
import { Icon } from '../ui/Icon';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import { KodeThinking } from '../ui/KodeThinking';
import { Kodi } from '../ui/Kodi';
import type { Nav, Route } from '../navigation/types';
import { F } from '../theme/fonts';

const ucFirst = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

export function Kode() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route<'Kode'>>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [text, setText] = useState('');
  const [keyboard, setKeyboard] = useState(false);
  const list = useRef<ScrollView>(null);
  // Les réponses déjà là à l'ouverture se relisent ; seules les nouvelles tenues s'assemblent.
  const known_ = useRef(new Set(s.messages.map((m) => m.id)));
  const left = questionsLeft(s);
  const quota = LIMITS[s.plan].questions;
  const out = left === 0;

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Une question arrive d'ailleurs (accueil, agenda) : on la pose une seule fois.
  const asked = useRef<number | undefined>(undefined);
  useEffect(() => {
    const p = route.params;
    if (p?.ask && p.nonce !== asked.current) {
      asked.current = p.nonce;
      a.askKode(p.ask);
    }
  }, [route.params, a]);

  // Défile vers la dernière réponse, jamais à l'ouverture (on garde le titre et les suggestions en vue).
  useEffect(() => {
    if (!s.messages.length) return;
    const t = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [s.messages.length, s.kodeTyping]);

  const send = (q: string) => {
    const v = q.trim();
    if (!v || s.kodeTyping) return;
    if (a.askKode(v)) setText('');
  };

  const tomorrow = eventsOn(s.events, isoOf(1))[0];
  const p = s.profile;
  const starters = kodeStarters(p, s.pieces);
  const ready = canCompose(s.pieces);
  const meteo = useMeteo();
  const w = meteo.jours[0];
  const ctx = meteo.reelle ? s.contexte : null;
  // La prochaine date qui change les tenues : vacances scolaires ou jour férié, dans le mois.
  const dansUnMois = jourIso(31);
  const vac = ctx?.vacances.valeur?.find((v) => v.debut <= dansUnMois);
  const ferie = ctx?.feries.valeur?.find((f) => f.date <= dansUnMois);
  const prochain = vac && (!ferie || vac.debut <= ferie.date)
    ? { text: `${vac.nom} ${periode(vac.debut, vac.fin)}`, bloc: ctx?.vacances }
    : ferie
      ? { text: `Férié : ${ferie.nom}, le ${dateLongue(ferie.date)}`, bloc: ctx?.feries }
      : null;

  const top = useTabTop();
  const { y: scrollY, onScroll } = useHeaderScroll();
  // Ce que Kodi sait déjà, en puces : la météo, la prochaine date qui compte, demain, le dressing.
  const known: { label: string; swatch?: string }[] = [
    w ? { label: `${p.city ? `${p.city} · ` : ''}${w.low}° à ${w.t}°, ${w.label}` } : null,
    prochain ? { label: prochain.text } : null,
    tomorrow ? { label: `Demain, ${lcFirst(tomorrow.title)} à ${tomorrow.time}` } : null,
    p.styles.length ? { label: `Style ${p.styles.join(', ').toLowerCase()}` } : null,
    { label: s.pieces.length ? `${s.pieces.length} pièce${s.pieces.length > 1 ? 's' : ''}` : 'Dressing vide' },
  ].filter(Boolean) as { label: string }[];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} className="bg-paper" testID="screen-kode">
      <Ambient />
      <TabHeader title="Kodi" y={scrollY} meta={quota === null ? 'sans limite' : `${left} / ${quota}`} />
      <Animated.ScrollView ref={list as never} onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: top, paddingBottom: 24, gap: 14 }}>
        {s.messages.length === 0 && (
          <Animated.View entering={FadeInUp.duration(300)} style={{ gap: 12 }}>
            {/* Kodi en personne, qui salue (refonte du 21/10). */}
            <View className="items-center" style={{ paddingTop: 4 }}>
              <Kodi mood="wave" size={104} track shadow enter testID="kode-mascot" />
            </View>
            <Card style={{ padding: 16, gap: 12 }}>
              <Tag label="Kodi" icon="kode" />
              <T v="cardTitle" style={{ fontSize: 22, lineHeight: 27 }} accessibilityRole="header">
                Une question, une tenue.
              </T>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {starters.map((q, i) => (
                  <DotChip key={q} testID={`starter-${i}`} label={q} onPress={() => send(q)} disabled={out} />
                ))}
              </View>
            </Card>
            <View style={{ gap: 8, paddingHorizontal: 4 }}>
              <T v="kicker" tone="ink2">
                Ce que Kodi sait
              </T>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {known.map((k) => (
                  <DotChip key={k.label} label={k.label} />
                ))}
              </View>
              {meteo.reelle && <Credit blocs={[s.contexte?.meteo, prochain?.bloc]} />}
            </View>
            {/* Transparence (09/10, règlement européen sur l'IA, art. 50) : on sait qu'on parle à une IA. */}
            <T v="small" tone="ink2" style={{ paddingHorizontal: 4 }} testID="kode-ai">
              Kodi est une intelligence artificielle : ses tenues sont des idées, il peut se tromper. Il reçoit ton dressing, ton style et ton agenda, jamais ton nom.
            </T>
            {!ready && <Button testID="kode-add" label="Ajouter mes premières pièces" icon="plus" onPress={() => nav.navigate('AddPiece')} />}
          </Animated.View>
        )}

        {s.messages.map((m) => (m.from === 'me' ? <Mine key={m.id} m={m} /> : <FromKode key={m.id} m={m} fresh={!known_.current.has(m.id)} />))}
        {s.kodeTyping && <Typing />}

        {out && (
          <Card testID="kode-quota" style={{ gap: 10, padding: 14 }}>
            <Tag label={`${quota} questions posées`} />
            <T v="body" tone="ink2">
              Elles reviennent le 1er du mois. Sapologue rend Kodi sans limite.
            </T>
            <Button label="Voir les offres" variant="secondary" size="m" onPress={() => nav.navigate('Offers')} />
          </Card>
        )}
      </Animated.ScrollView>

      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: keyboard ? 10 : TAB_CLEARANCE - 14 + insets.bottom }}>
        <View className="flex-row items-end bg-sunk" style={{ borderRadius: 26, paddingLeft: 18, paddingRight: 4, paddingVertical: 4, gap: 8, opacity: out ? 0.5 : 1 }}>
          <TextInput
            testID="kode-input"
            value={text}
            onChangeText={setText}
            editable={!out}
            placeholder={out ? 'Plus de questions ce mois-ci' : 'Pose ta question'}
            placeholderTextColor={c.ink2}
            multiline
            onSubmitEditing={() => send(text)}
            blurOnSubmit
            returnKeyType="send"
            accessibilityLabel="Ta question à Kodi"
            style={{ flex: 1, color: c.ink, ...F.s400, fontSize: 16, lineHeight: 21, minHeight: 42, maxHeight: 120, paddingTop: 11, paddingBottom: 10 }}
          />
          <IconButton testID="kode-send" icon="send" label="Envoyer" variant="solid" size={44} onPress={() => send(text)} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Mine({ m }: { m: KodeMessage }) {
  return (
    <Animated.View entering={FadeInDown.duration(motion.duration.base).easing(motion.easing)} style={{ alignSelf: 'flex-end', maxWidth: '82%' }}>
      <View className="bg-primary-bg" style={{ borderRadius: 22, borderBottomRightRadius: 6, paddingHorizontal: 16, paddingVertical: 11 }}>
        <T v="body" tone="primary-fg">
          {m.text}
        </T>
      </View>
    </Animated.View>
  );
}

function FromKode({ m, fresh }: { m: KodeMessage; fresh: boolean }) {
  const { c } = useTheme();
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const { width } = useScreen();
  const byId = new Map(s.pieces.map((p) => [p.id, p]));
  const pieces = (m.outfit?.pieces ?? []).map((id) => byId.get(id)).filter(Boolean) as Piece[];
  const open = (p: Piece) => nav.navigate('Piece', { id: p.id });
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={{ alignSelf: 'flex-start', width: '94%' }} accessibilityLiveRegion="polite">
      {/* La réponse de Kodi : un bandeau de service beurre (21/10), texte noir en clair comme en sombre. */}
      <Card className="bg-butter" style={{ padding: 14, gap: 12, borderBottomLeftRadius: 8 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Kodi mood={fresh ? 'talking' : 'idle'} size={30} tap={false} decorative />
          <T v="label" style={{ color: c['butter-ink'] }}>
            Kodi
          </T>
        </View>
        <T v="body" style={{ color: c['butter-ink'] }}>{m.text}</T>
        {m.outfit && pieces.length > 0 && (
          <>
            <View className="bg-paper" style={{ borderRadius: 18, padding: 10 }}>
              <OutfitBoard pieces={pieces} width={width * 0.94 - space.gutter * 2 - 28 - 20} onPiece={open} assemble={fresh} numbered={false} />
            </View>
            <Animated.View entering={fresh ? FadeInDown.delay(assembleDelay(pieces.length)).duration(520) : undefined} style={{ gap: 4 }}>
              <T v="cardTitle" style={{ color: c['butter-ink'] }}>{m.outfit.title}</T>
              <T v="caption" style={{ color: c['butter-ink'] }}>
                {m.outfit.why}
              </T>
            </Animated.View>
            <View className="flex-row" style={{ gap: 8 }}>
              <Button testID={`kode-plan-${m.id}`} label="Prévoir demain" size="m" grow onPress={() => { a.plan(isoOf(1), { title: m.outfit!.title, pieces: m.outfit!.pieces }); a.toast('Prévue pour demain, dans ton agenda'); }} />
              <Button label="Ajuster" size="m" variant="secondary" icon="layers" grow onPress={() => nav.navigate('Compose', { pieces: m.outfit!.pieces })} />
            </View>
          </>
        )}
        {m.link && (
          <Button label={m.link.label} variant="secondary" size="m" iconRight="chevron" onPress={() => (nav.navigate as (route: string, params?: object) => void)(m.link!.route, m.link!.params)} />
        )}
      </Card>
    </Animated.View>
  );
}

/** Ce que Kodi dit pendant qu'il compose (web : lib/thinking.ts, `chat`). */
const COMPOSING = ['Kodi fouille ton dressing', 'Kodi assemble les couleurs', 'Kodi pense à la météo', 'Kodi essaie une association', 'Kodi peaufine la tenue'];

function Typing() {
  return (
    <View style={{ gap: 8 }}>
      <T v="kicker" tone="ink2">
        Kodi
      </T>
      <KodeThinking phrases={COMPOSING} every={2000} />
    </View>
  );
}
