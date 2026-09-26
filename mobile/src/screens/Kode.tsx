import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, TextInput, View, type ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WEATHER, lcFirst, type Piece } from '../data/wardrobe';
import { kodeStarters, type KodeMessage } from '../state/kode';
import { LIMITS, eventsOf, questionsLeft, useStore } from '../state/store';
import { canCompose } from '../state/outfits';
import { useTheme } from '../theme/ThemeProvider';
import { space, TAB_CLEARANCE } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button, IconButton } from '../ui/Button';
import { Masthead, Rule } from '../ui/layout';
import { Card } from '../ui/bits';
import { OutfitBoard, Legend } from '../ui/outfit';
import { Icon } from '../ui/Icon';
import { useScreen } from '../ui/screen';
import type { Nav, Route } from '../navigation/types';

export function Kode() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route<'Kode'>>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [text, setText] = useState('');
  const [keyboard, setKeyboard] = useState(false);
  const list = useRef<ScrollView>(null);
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

  const tomorrow = eventsOf(s.profile).find((e) => e.day === 1);
  const p = s.profile;
  const starters = kodeStarters(p, s.pieces);
  const ready = canCompose(s.pieces);
  const w = WEATHER[0];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} className="bg-paper" testID="screen-kode">
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: space.gutter, gap: 12 }}>
        <Masthead kicker="KODE" meta={quota === null ? 'Sans limite' : `${left} question${left === 1 ? '' : 's'} sur ${quota} ce mois-ci`} />
      </View>
      <Animated.ScrollView ref={list as never} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 16, paddingBottom: 24, gap: 18 }}>
        <View style={{ gap: 8 }}>
          <T v="title" accessibilityRole="header">
            Ton styliste,{'\n'}
            <T v="title" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }}>
              avec ce que tu as.
            </T>
          </T>
          <T v="body" tone="ink2">
            {s.pieces.length
              ? `Kode compose à partir de tes ${s.pieces.length} pièce${s.pieces.length > 1 ? 's' : ''}, de la météo et de ton agenda. Il te dit toujours pourquoi.`
              : 'Kode compose avec tes pièces à toi, la météo et ton agenda. Il te dit toujours pourquoi.'}
          </T>
        </View>

        {s.messages.length === 0 && (
          <Animated.View entering={FadeInUp.duration(300)} style={{ gap: 12 }}>
            <Card style={{ gap: 6 }}>
              <T v="kicker" tone="ink2" upper>
                Ce que Kode sait déjà
              </T>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Icon name="showers" size={18} color={c.ink2} />
                <T v="body">
                  Aujourd’hui{p.city ? ` à ${p.city}` : ''}, {w.t}° et {w.label}
                </T>
              </View>
              {tomorrow && (
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Icon name="calendar" size={18} color={c.ink2} />
                  <T v="body">
                    Demain, {lcFirst(tomorrow.title)} à {tomorrow.time}
                  </T>
                </View>
              )}
              {(p.silhouette && p.silhouette !== 'inconnue') || p.styles.length ? (
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Icon name="person" size={18} color={c.ink2} />
                  <T v="body" style={{ flex: 1 }}>
                    {[p.silhouette && p.silhouette !== 'inconnue' ? `Silhouette en ${p.silhouette}` : '', p.styles.length ? `style ${p.styles.join(', ').toLowerCase()}` : ''].filter(Boolean).join(', ')}
                  </T>
                </View>
              ) : null}
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Icon name="hanger" size={18} color={ready ? c.ink2 : c.caution} />
                <T v="body" tone={ready ? 'ink' : 'caution'} style={{ flex: 1 }}>
                  {s.pieces.length ? `${s.pieces.length} pièce${s.pieces.length > 1 ? 's' : ''} dans ton dressing${ready ? '' : ' : il en faut un peu plus'}` : 'Ton dressing est vide pour l’instant'}
                </T>
              </View>
                        </Card>
            {!ready && <Button testID="kode-add" label="Ajouter mes premières pièces" icon="plus" onPress={() => nav.navigate('AddPiece')} />}
            <T v="kicker" tone="ink2" upper>
              Pour commencer
            </T>
            {starters.map((q, i) => (
              <Tap key={q} testID={`starter-${i}`} onPress={() => send(q)} disabled={out} accessibilityLabel={q} scaleTo={0.99} style={{ minHeight: 52, borderBottomWidth: 1, borderColor: c.rule, gap: 12 }} className="flex-row items-center">
                <T v="numeral" tone="brass" style={{ fontSize: 17 }}>
                  {String(i + 1).padStart(2, '0')}
                </T>
                <T v="bodyL" style={{ flex: 1 }}>
                  {q}
                </T>
                <Icon name="chevron" size={18} color={c.ink2} />
              </Tap>
            ))}
          </Animated.View>
        )}

        {s.messages.map((m) => (m.from === 'me' ? <Mine key={m.id} m={m} /> : <FromKode key={m.id} m={m} />))}
        {s.kodeTyping && <Typing />}

        {out && (
          <Card testID="kode-quota" style={{ gap: 10 }}>
            <T v="cardTitle">Tes {quota} questions du mois sont posées.</T>
            <T v="body" tone="ink2">
              Elles reviennent le 1er du mois. Si tu veux continuer maintenant, Atelier rend Kode sans limite.
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
            placeholder={out ? 'Plus de questions ce mois-ci' : 'Demande une tenue, un conseil…'}
            placeholderTextColor={c.ink2}
            multiline
            onSubmitEditing={() => send(text)}
            blurOnSubmit
            returnKeyType="send"
            accessibilityLabel="Ta question à Kode"
            style={{ flex: 1, color: c.ink, fontFamily: 'HankenGrotesk_400Regular', fontSize: 16, lineHeight: 21, minHeight: 42, maxHeight: 120, paddingTop: 11, paddingBottom: 10 }}
          />
          <IconButton testID="kode-send" icon="send" label="Envoyer" variant="solid" size={44} onPress={() => send(text)} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Mine({ m }: { m: KodeMessage }) {
  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={{ alignSelf: 'flex-end', maxWidth: '82%' }}>
      <View className="bg-primary-bg" style={{ borderRadius: 22, borderBottomRightRadius: 6, paddingHorizontal: 16, paddingVertical: 11 }}>
        <T v="body" tone="primary-fg">
          {m.text}
        </T>
      </View>
    </Animated.View>
  );
}

function FromKode({ m }: { m: KodeMessage }) {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const { width } = useScreen();
  const byId = new Map(s.pieces.map((p) => [p.id, p]));
  const pieces = (m.outfit?.pieces ?? []).map((id) => byId.get(id)).filter(Boolean) as Piece[];
  const open = (p: Piece) => nav.navigate('Piece', { id: p.id });
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={{ gap: 10 }} accessibilityLiveRegion="polite">
      <T v="masthead" tone="ink2" style={{ letterSpacing: 2.4 }}>
        KODE
      </T>
      <T v="bodyL">{m.text}</T>
      {m.outfit && pieces.length > 0 && (
        <Card style={{ gap: 12, paddingTop: 18 }}>
          <OutfitBoard pieces={pieces} width={width - space.gutter * 2 - 32} onPiece={open} />
          <Legend pieces={pieces} onPiece={open} />
          <Rule />
          <T v="cardTitle">{m.outfit.title}</T>
          <T v="body" tone="ink2">
            {m.outfit.why}
          </T>
          <View className="flex-row" style={{ gap: 8 }}>
            <Button testID={`kode-plan-${m.id}`} label="Prévoir demain" size="m" grow onPress={() => { a.plan(1, { title: m.outfit!.title, pieces: m.outfit!.pieces }); a.toast('Prévue pour demain, dans ton agenda'); }} />
            <Button label="Ajuster" size="m" variant="secondary" icon="layers" grow onPress={() => nav.navigate('Compose', { pieces: m.outfit!.pieces })} />
          </View>
        </Card>
      )}
      {m.link && (
        <Button label={m.link.label} variant="secondary" size="m" iconRight="chevron" onPress={() => (nav.navigate as (route: string, params?: object) => void)(m.link!.route, m.link!.params)} />
      )}
    </Animated.View>
  );
}

function Typing() {
  return (
    <View className="flex-row items-center" style={{ gap: 10 }} accessibilityLabel="Kode compose une réponse" accessibilityLiveRegion="polite">
      <T v="masthead" tone="ink2" style={{ letterSpacing: 2.4 }}>
        KODE
      </T>
      <View className="flex-row" style={{ gap: 5 }}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} i={i} />
        ))}
      </View>
    </View>
  );
}

function Dot({ i }: { i: number }) {
  const o = useSharedValue(0.25);
  useEffect(() => {
    o.value = withDelay(i * 160, withRepeat(withSequence(withTiming(1, { duration: 380 }), withTiming(0.25, { duration: 380 })), -1));
  }, [o, i]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View className="bg-brass" style={[{ width: 7, height: 7, borderRadius: 4 }, style]} />;
}
