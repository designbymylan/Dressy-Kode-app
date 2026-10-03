import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, TextInput, View, type ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { lcFirst, type Piece } from '../data/wardrobe';
import { kodeStarters, type KodeMessage } from '../state/kode';
import { LIMITS, eventsOf, questionsLeft, useMeteo, useStore } from '../state/store';
import { dateLongue, jourIso, periode } from '../state/contexte';
import { Credit } from '../ui/Credit';
import { canCompose } from '../state/outfits';
import { useTheme } from '../theme/ThemeProvider';
import { space, TAB_CLEARANCE } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button, IconButton } from '../ui/Button';
import { Masthead, Rule } from '../ui/layout';
import { Card, WeatherIcon } from '../ui/bits';
import { OutfitBoard, Legend, assembleDelay } from '../ui/outfit';
import { Icon } from '../ui/Icon';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import { KodeThinking } from '../ui/KodeThinking';
import type { Nav, Route } from '../navigation/types';
import { F } from '../theme/fonts';

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
  const known = useRef(new Set(s.messages.map((m) => m.id)));
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} className="bg-paper" testID="screen-kode">
      <Ambient />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: space.gutter, gap: 12 }}>
        <Masthead kicker="KODE" meta={quota === null ? 'Sans limite' : `${left} question${left === 1 ? '' : 's'} sur ${quota} ce mois-ci`} />
      </View>
      <Animated.ScrollView ref={list as never} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 16, paddingBottom: 24, gap: 18 }}>
        <View style={{ gap: 8 }}>
          <T v="title" accessibilityRole="header">
            Ton styliste,{'\n'}
            <T v="title" style={{ ...F.accent }}>
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
              {w ? (
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <WeatherIcon w={w} size={18} color={c.ink2} />
                  <T v="body" style={{ flex: 1 }}>
                    Aujourd’hui{p.city ? ` à ${p.city}` : ''}, {w.low}° à {w.t}°, {w.label}
                  </T>
                </View>
              ) : null}
              {prochain && (
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Icon name="calendar" size={18} color={c.ink2} />
                  <T v="body" style={{ flex: 1 }}>
                    {prochain.text}
                  </T>
                </View>
              )}
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
              {meteo.reelle && <Credit blocs={[s.contexte?.meteo, prochain?.bloc]} style={{ marginTop: 4 }} />}
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

        {s.messages.map((m) => (m.from === 'me' ? <Mine key={m.id} m={m} /> : <FromKode key={m.id} m={m} fresh={!known.current.has(m.id)} />))}
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
        <View className="flex-row items-end bg-sunk" style={{ borderRadius: 0, paddingLeft: 18, paddingRight: 4, paddingVertical: 4, gap: 8, opacity: out ? 0.5 : 1 }}>
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
    <Animated.View entering={FadeInDown.springify().damping(18)} style={{ alignSelf: 'flex-end', maxWidth: '82%' }}>
      <View className="bg-primary-bg" style={{ paddingHorizontal: 16, paddingVertical: 11 }}>
        <T v="body" tone="primary-fg">
          {m.text}
        </T>
      </View>
    </Animated.View>
  );
}

function FromKode({ m, fresh }: { m: KodeMessage; fresh: boolean }) {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const { width } = useScreen();
  const byId = new Map(s.pieces.map((p) => [p.id, p]));
  const pieces = (m.outfit?.pieces ?? []).map((id) => byId.get(id)).filter(Boolean) as Piece[];
  const open = (p: Piece) => nav.navigate('Piece', { id: p.id });
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={{ gap: 10 }} accessibilityLiveRegion="polite">
      <T v="masthead" tone="ink2">
        KODE
      </T>
      <T v="bodyL">{m.text}</T>
      {m.outfit && pieces.length > 0 && (
        <Card style={{ gap: 12, paddingTop: 18 }}>
          <OutfitBoard pieces={pieces} width={width - space.gutter * 2 - 32} onPiece={open} assemble={fresh} />
          <Legend pieces={pieces} onPiece={open} />
          <Rule />
          <Animated.View entering={fresh ? FadeInDown.delay(assembleDelay(pieces.length)).duration(520) : undefined} style={{ gap: 12 }}>
            <T v="cardTitle">{m.outfit.title}</T>
            <T v="body" tone="ink2">
              {m.outfit.why}
            </T>
          </Animated.View>
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

/** Ce que Kode dit pendant qu'il compose (web : lib/thinking.ts, `chat`). */
const COMPOSING = ['Kode fouille ton dressing', 'Kode assemble les couleurs', 'Kode pense à la météo', 'Kode essaie une association', 'Kode peaufine la tenue'];

function Typing() {
  return (
    <View style={{ gap: 8 }}>
      <T v="masthead" tone="ink2">
        KODE
      </T>
      <KodeThinking phrases={COMPOSING} every={2000} />
    </View>
  );
}
