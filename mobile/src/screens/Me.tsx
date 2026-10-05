import { useState } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { FRIENDS, euros } from '../data/wardrobe';
import { LIMITS, pieceLimit, precision, questionsLeft, usageRate, useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { Garment } from '../ui/Garment';
import { Tap } from '../ui/Tap';
import { space, TAB_CLEARANCE } from '../theme/tokens';
import { T } from '../ui/T';
import { ScrollEdge, TabHeader, useTabScroll, useTabTop } from '../ui/layout';
import { Avatar, Card, EmptyState, Gauge, Group, Row, Tag } from '../ui/bits';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { PLANS } from './Offers';
import { AccountSheet } from '../ui/account';
import { online } from '../state/remote';
import { Ambient } from '../ui/Ambient';
import type { Nav } from '../navigation/types';

export function Me() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const edge = useSharedValue(0);
  const onScroll = useTabScroll(edge);
  const plan = PLANS.find((p) => p.id === s.plan)!;
  const limit = pieceLimit(s);
  const left = questionsLeft(s);
  const worn30 = s.pieces.filter((p) => p.lastWorn !== null && p.lastWorn <= 30).length;
  const loans = s.shares.filter((x) => x.mode === 'preter');
  const [account, setAccount] = useState(false);
  const who =
    s.account === 'connecte' ? s.profile.email : s.pendingEmail ? `${s.pendingEmail} · e-mail à confirmer` : s.account === 'demo' ? s.profile.email : 'Sans compte : tout reste sur ce téléphone';
  const [sharesOpen, setSharesOpen] = useState(false);
  const MODE = { montrer: 'Partage avec', preter: 'Prêt à', donner: 'Don proposé à' } as const;

  const top = useTabTop();
  const { c, scheme } = useTheme();
  // Le coût moyen d'un port, sur les pièces dont on connaît le prix.
  const priced = s.pieces.filter((p) => p.price && p.wears > 0);
  const cpw = priced.length ? priced.reduce((n, p) => n + (p.price ?? 0), 0) / priced.reduce((n, p) => n + p.wears, 0) : null;
  const most = [...s.pieces].filter((p) => p.wears > 0).sort((x, z) => z.wears - x.wears).slice(0, 3);

  return (
    <View style={{ flex: 1 }} className="bg-paper">
      <Ambient />
    <ScrollEdge y={edge} />
    <TabHeader
      title={s.profile.name || 'Moi'}
      lead={<Avatar name={s.profile.name || '?'} size={44} on />}
      meta={plan.name}
      actions={[{ icon: 'sliders', label: 'Personnaliser', onPress: () => nav.navigate('Customize'), testID: 'me-customize' }]}
    />
    <Animated.ScrollView testID="screen-me" onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: TAB_CLEARANCE + insets.bottom, gap: 12 }}>
      <T v="kicker" tone="ink2" style={{ textAlign: 'center' }} numberOfLines={1}>
        {`${who} · depuis ${s.profile.since}`}
      </T>

      {/* Les grands chiffres : ce que tu portes vraiment, et ce que coûte un port. */}
      <View className="flex-row" style={{ gap: 8 }}>
        {[
          s.pieces.some((p) => p.wears > 0) ? { v: `${usageRate(s.pieces)} %`, l: 'du dressing porté' } : { v: String(s.pieces.length), l: s.pieces.length > 1 ? 'pièces' : 'pièce' },
          cpw !== null ? { v: euros(cpw), l: 'par port' } : { v: String(worn30), l: 'sorties ce mois' },
        ].map((x) => (
          <Card key={x.l} style={{ flex: 1, gap: 6, padding: 16 }}>
            <T v="stat" style={{ fontSize: 40, lineHeight: 42 }} numberOfLines={1} adjustsFontSizeToFit>
              {x.v}
            </T>
            <T v="kicker" tone="ink2">
              {x.l}
            </T>
          </Card>
        ))}
      </View>

      {most.length > 0 && (
        <Card style={{ padding: 14, gap: 12 }}>
          <Tag label="Le plus porté" />
          <View className="flex-row" style={{ gap: 8 }}>
            {most.map((p) => (
              <Tap key={p.id} testID={`most-${p.id}`} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={`${p.name}, ${p.wears} ports`} outerStyle={{ flex: 1 }} style={{ height: 112, borderRadius: 22, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center' }}>
                <Garment kind={p.kind} tint={p.tint} image={p.image} size={62} dark={scheme === 'dark'} label={p.name} />
                <View style={{ position: 'absolute', top: 8, left: 8 }}>
                  <Tag label={`${p.wears}×`} tone="glass" dot={false} />
                </View>
              </Tap>
            ))}
          </View>
        </Card>
      )}

      <Card style={{ padding: 16, gap: 10 }}>
        <View className="flex-row items-center justify-between">
          <T v="kicker" tone="ink2">
            {limit === null ? 'Places sans limite' : `${s.pieces.length} / ${limit} places`}
          </T>
          <T testID="me-offer" v="caption" tone="ink2" onPress={() => nav.navigate('Offers')} accessibilityRole="link" suppressHighlighting style={{ paddingVertical: 10, paddingLeft: 12 }}>
            Les offres
          </T>
        </View>
        {limit !== null && <Gauge value={s.pieces.length} max={limit} label="Places du dressing" />}
        <T v="kicker" tone="ink2">
          {left === null ? 'Kode sans limite' : `${left} / ${LIMITS[s.plan].questions} questions ce mois`}
        </T>
      </Card>

      {online && s.account === 'nouveau' && (
        <Group>
        <Row
          testID="me-account"
          icon="lock"
          title={s.pendingEmail ? 'J’ai confirmé mon e-mail : me connecter' : 'Créer mon compte ou me connecter'}
          onPress={() => setAccount(true)}
          last
        />
        </Group>
      )}

      <Group>
        <Row testID="me-silhouette" icon="ruler" title="Ma silhouette" detail={`Précision de Kode : ${precision(s.profile)} %`} onPress={() => nav.navigate('Silhouette')} />
        <Row testID="me-shop" icon="bag" title="La boutique" onPress={() => nav.navigate('Shop')} />
        <Row
          testID="me-loans"
          icon="share"
          title="Prêts et partages"
          detail={loans.length ? `${loans.length} prêt${loans.length > 1 ? 's' : ''} en cours` : s.account === 'demo' ? `Avec ${FRIENDS.slice(0, 3).map((f) => f.name).join(', ')}…` : undefined}
          onPress={() => setSharesOpen(true)}
        />
        <Row testID="me-states" icon="eye" title="Aperçu du design" onPress={() => nav.navigate('States')} />
        <Row icon="help" title="Aide" onPress={() => a.toast('L’aide arrive bientôt')} last={s.account === 'nouveau'} />
        {s.account === 'connecte' && <Row testID="me-logout" icon="logout" title="Se déconnecter" detail={s.profile.email ?? undefined} onPress={a.logout} last />}
        {s.account === 'demo' && <Row testID="me-logout" icon="logout" title="Quitter la démonstration" onPress={a.restart} last />}
      </Group>
      <AccountSheet visible={account} onClose={() => setAccount(false)} onDone={() => setAccount(false)} initial={s.pendingEmail ? 'login' : 'signup'} />
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
