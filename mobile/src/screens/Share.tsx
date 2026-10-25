import { useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FRIENDS, forms } from '../data/wardrobe';
import { useStore, type Share as ShareT } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { motion, space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Chip, SegmentedPill } from '../ui/controls';
import { StackHeader, useStackTop } from '../ui/layout';
import { Avatar, Card } from '../ui/bits';
import { Garment } from '../ui/Garment';
import { Icon } from '../ui/Icon';
import { Ambient } from '../ui/Ambient';
import type { Nav, Route } from '../navigation/types';
import { F } from '../theme/fonts';

type Mode = ShareT['mode'];

export function ShareScreen() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route<'Share'>>();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const top = useStackTop(true);
  const piece = s.pieces.find((p) => p.id === params.id) ?? s.pieces[0];
  const f = forms(piece);
  const [mode, setMode] = useState<Mode>('preter');
  const [friend, setFriend] = useState<string | null>(null);
  const [back, setBack] = useState('1 semaine');
  const defaults: Record<Mode, string> = {
    montrer: `Regarde, je pense à ${f.le} ressortir. Tu en dis quoi ?`,
    preter: `Je peux te ${f.le} prêter pour ton week-end, si tu veux.`,
    donner: `Je ne ${f.le} porte plus : ${f.il.toLowerCase()} ${f.v('te plairait', 'te plairaient')} ?`,
  };
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const text = message ?? defaults[mode];
  const name = FRIENDS.find((x) => x.id === friend)?.name;

  if (sent && name) {
    return (
      <View className="bg-paper items-center justify-center" style={{ flex: 1, padding: space.gutter, gap: 14 }} testID="share-sent">
      <Ambient />
        <Animated.View entering={ZoomIn.duration(motion.duration.base).easing(motion.easing)} style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: c['positive-soft'], alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={40} color={c.positive} strokeWidth={2.2} />
        </Animated.View>
        <T v="title" style={{ textAlign: 'center' }}>
          Envoyé à {name}.
        </T>
        <T v="body" tone="ink2" style={{ textAlign: 'center', maxWidth: 300 }}>
          {mode === 'preter' ? `Tu retrouveras le prêt dans Moi, avec la date de retour (${back}).` : mode === 'donner' ? 'Si elle accepte, la pièce quittera ton dressing.' : 'Tu verras sa réponse dans tes notifications.'}
        </T>
        <View style={{ marginTop: 10, alignSelf: 'stretch' }}>
          <Button testID="share-done" label="Terminé" onPress={() => nav.goBack()} />
        </View>
      </View>
    );
  }

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-share">
      <Ambient />
      <StackHeader title="Partager" close />
      <Animated.ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 20 }}>
        <T v="title" accessibilityRole="header">
          À une amie
        </T>

        {/* L'aperçu de ce que l'amie recevra : la pièce, pas une photo, et aucun logo. */}
        <Card className="items-center" style={{ gap: 10, paddingVertical: 22 }}>
          <View className="bg-stage items-center justify-center" style={{ width: 150, height: 170, borderRadius: 22 }}>
            <Garment kind={piece.kind} tint={piece.tint} image={piece.image} size={110} dark={scheme === 'dark'} label={piece.name} />
          </View>
          <T v="cardTitle">{piece.name}</T>
          <T v="caption" tone="ink2">
            {piece.color} · {piece.material.toLowerCase()}
          </T>
        </Card>

        <SegmentedPill
          label="Ce que tu proposes"
          value={mode}
          onChange={(v) => {
            setMode(v);
            setMessage(null);
          }}
          options={[
            { value: 'montrer', label: 'Montrer' },
            { value: 'preter', label: 'Prêter' },
            { value: 'donner', label: 'Donner' },
          ]}
        />

        {mode === 'preter' && (
          <Animated.View entering={FadeIn.duration(180)} style={{ gap: 8 }}>
            <T v="kicker" tone="ink2">
              Retour prévu
            </T>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {['1 semaine', '2 semaines', '1 mois'].map((x) => (
                <Chip key={x} label={x} on={back === x} onPress={() => setBack(x)} />
              ))}
            </View>
          </Animated.View>
        )}

        <View style={{ gap: 10 }}>
          <T v="kicker" tone="ink2">
            À qui ?
          </T>
          <View className="flex-row" style={{ gap: 12 }}>
            {FRIENDS.map((x) => (
              <Tap key={x.id} testID={`friend-${x.id}`} onPress={() => setFriend(x.id)} feedback="select" accessibilityRole="radio" accessibilityState={{ checked: friend === x.id }} accessibilityLabel={x.name} style={{ alignItems: 'center', gap: 6 }}>
                <Avatar name={x.name} size={52} on={friend === x.id} />
                <T v="small" tone={friend === x.id ? 'ink' : 'ink2'}>
                  {x.name}
                </T>
              </Tap>
            ))}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <T v="kicker" tone="ink2">
            Ton message
          </T>
          <TextInput
            testID="share-message"
            value={text}
            onChangeText={setMessage}
            multiline
            accessibilityLabel="Ton message"
            className="bg-sunk"
            style={{ minHeight: 88, borderRadius: 20, padding: 16, paddingTop: 14, color: c.ink, ...F.s400, fontSize: 16, lineHeight: 22, textAlignVertical: 'top' }}
          />
        </View>

        <Button
          testID="share-send"
          label={name ? `Envoyer à ${name}` : 'Choisis une amie'}
          disabled={!name}
          icon="send"
          onPress={() => {
            a.share({ id: `s${Date.now()}`, pieceId: piece.id, friend: name!, mode });
            setSent(true);
          }}
        />
        <Button
          label="Copier le lien"
          variant="plain"
          icon="link"
          onPress={() => a.toast('Lien copié : il expire dans 7 jours')}
        />
      </Animated.ScrollView>
    </View>
  );
}
