import { useState } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { FRIENDS } from '../data/wardrobe';
import { LIMITS, pieceLimit, precision, questionsLeft, usageRate, useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space, TAB_CLEARANCE } from '../theme/tokens';
import { T } from '../ui/T';
import { Masthead, ScrollEdge, useTabScroll } from '../ui/layout';
import { Avatar, Card, EmptyState, Row } from '../ui/bits';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { PLANS } from './Offers';
import type { Nav } from '../navigation/types';

export function Me() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { pref } = useTheme();
  const edge = useSharedValue(0);
  const onScroll = useTabScroll(edge);
  const plan = PLANS.find((p) => p.id === s.plan)!;
  const limit = pieceLimit(s);
  const left = questionsLeft(s);
  const worn30 = s.pieces.filter((p) => p.lastWorn !== null && p.lastWorn <= 30).length;
  const loans = s.shares.filter((x) => x.mode === 'preter');
  const [sharesOpen, setSharesOpen] = useState(false);
  const MODE = { montrer: 'Partage avec', preter: 'Prêt à', donner: 'Don proposé à' } as const;

  return (
    <View style={{ flex: 1 }} className="bg-paper">
    <ScrollEdge y={edge} />
    <Animated.ScrollView testID="screen-me" onScroll={onScroll} scrollEventThrottle={16} className="bg-paper" contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: space.gutter, paddingBottom: TAB_CLEARANCE + insets.bottom, gap: 22 }}>
      <Masthead kicker="MOI" meta={`${plan.name}${limit !== null ? ` · ${limit - s.pieces.length} places libres` : ''}`} />

      <View className="flex-row items-center" style={{ gap: 16 }}>
        <Avatar name={s.profile.name || '?'} size={64} />
        <View style={{ flex: 1 }}>
          <T v="title" accessibilityRole="header">
            {s.profile.name}
          </T>
          <T v="caption" tone="ink2">
            {s.profile.email ?? 'Sans compte : tout reste sur ce téléphone'} · depuis {s.profile.since}
          </T>
        </View>
      </View>

      <View className="flex-row" style={{ gap: 10 }}>
        {[
          { v: String(s.pieces.length), l: 'pièces' },
          s.pieces.some((p) => p.wears > 0) ? { v: `${usageRate(s.pieces)} %`, l: 'portées en 3 mois' } : { v: '—', l: 'portées : ça commence' },
          { v: String(worn30), l: 'sorties ce mois' },
        ].map((x) => (
          <Card key={x.l} style={{ flex: 1, gap: 2, padding: 14 }}>
            <T v="cardTitle" style={{ fontSize: 28, lineHeight: 32 }}>
              {x.v}
            </T>
            <T v="small" tone="ink2">
              {x.l}
            </T>
          </Card>
        ))}
      </View>

      <View>
        <T v="kicker" tone="ink2" upper style={{ marginBottom: 2 }}>
          Ton offre
        </T>
        <Row
          testID="me-offer"
          icon="layers"
          title={plan.name}
          detail={left === null ? 'Kode sans limite' : `${left} questions à Kode sur ${LIMITS[s.plan].questions} ce mois-ci`}
          onPress={() => nav.navigate('Offers')}
        />
        <Row testID="me-shop" icon="bag" title="La boutique" detail="Packs à l’unité, places en plus" onPress={() => nav.navigate('Shop')} last />
      </View>

      <View>
        <T v="kicker" tone="ink2" upper style={{ marginBottom: 2 }}>
          Toi
        </T>
        <Row testID="me-silhouette" icon="ruler" title="Ma silhouette" detail={`Précision de Kode : ${precision(s.profile)} %`} onPress={() => nav.navigate('Silhouette')} />
        <Row testID="me-customize" icon="sliders" title="Personnaliser" detail={`Accueil, thème ${pref === 'auto' ? 'automatique' : pref === 'light' ? 'clair' : 'sombre'}, densité`} onPress={() => nav.navigate('Customize')} />
        <Row
          testID="me-loans"
          icon="share"
          title="Prêts et partages"
          detail={loans.length ? `${loans.length} prêt${loans.length > 1 ? 's' : ''} en cours` : s.account === 'demo' ? `Avec ${FRIENDS.slice(0, 3).map((f) => f.name).join(', ')}…` : 'Montrer, prêter, donner à tes amies'}
          onPress={() => setSharesOpen(true)}
          last
        />
      </View>

      <View>
        <T v="kicker" tone="ink2" upper style={{ marginBottom: 2 }}>
          Aperçu design
        </T>
        <Row testID="me-states" icon="eye" title="Feuilles, états vides et chargements" detail="Pour la revue du design" onPress={() => nav.navigate('States')} />
        <Row icon="help" title="Aide" detail="Questions fréquentes et contact" onPress={() => a.toast('L’aide arrive bientôt')} />
        <Row testID="me-logout" icon="logout" title="Se déconnecter" onPress={a.restart} last />
      </View>
      <Sheet visible={sharesOpen} onClose={() => setSharesOpen(false)} title="Prêts et partages" testID="shares-sheet">
        {s.shares.length === 0 ? (
          <EmptyState
            title="Rien en cours"
            body="Depuis la fiche d’une pièce, touche Partager pour la montrer, la prêter ou la donner à une amie."
            action={<Button label="Ouvrir le dressing" variant="secondary" size="m" onPress={() => { setSharesOpen(false); nav.navigate('Tabs', { screen: 'Dressing' }); }} />}
          />
        ) : (
          s.shares.map((x, i) => {
            const piece = s.pieces.find((p) => p.id === x.pieceId);
            return <Row key={x.id} icon="share" title={piece?.name ?? 'Pièce'} detail={`${MODE[x.mode]} ${x.friend}`} last={i === s.shares.length - 1} />;
          })
        )}
      </Sheet>
    </Animated.ScrollView>
    </View>
  );
}
