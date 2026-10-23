/**
 * Réglages (07/10), sur le modèle envoyé par l'utilisatrice : la carte du
 * profil en haut, puis des groupes courts (notifications, apparence, compte,
 * vie privée depuis le 09/10, aide) et la sortie en capsule tout en bas. Ce qui était en vrac dans Moi
 * et dans Personnaliser y est rangé ; Personnaliser ne garde que l'accueil.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { FRIENDS } from '../data/wardrobe';
import { displayName } from '../state/profile';
import { precision, useStore } from '../state/store';
import { online } from '../state/remote';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { F } from '../theme/fonts';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Ambient } from '../ui/Ambient';
import { SegmentedPill, Toggle } from '../ui/controls';
import { Avatar, Badge, EmptyState, Group, Row } from '../ui/bits';
import { AccountSheet } from '../ui/account';
import { NOTIF_LABEL, NotifChoices } from '../ui/rappels';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { glassSurface } from '../ui/Glass';
import { PLANS } from './Offers';
import type { Nav } from '../navigation/types';

const MODE = { montrer: 'Partage avec', preter: 'Prêt à', donner: 'Don proposé à' } as const;

export function Settings() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c, scheme, pref, setPref, solidGlass, setSolidGlass } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [sharesOpen, setSharesOpen] = useState(false);
  const [account, setAccount] = useState(false);
  const p = s.profile;
  const plan = PLANS.find((x) => x.id === s.plan)!;
  const loans = s.shares.filter((x) => x.mode === 'preter');
  const who = [p.username ? `@${p.username}` : null, p.email ?? (s.account === 'nouveau' ? 'Sans compte' : null)].filter(Boolean).join(' · ');

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-settings">
      <Ambient />
      <StackHeader title="Réglages" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40, gap: 12 }}>
        {/* La carte du profil : on la touche pour tout modifier. */}
        <Tap testID="settings-profile" onPress={() => nav.navigate('ProfileEdit')} scaleTo={0.99} accessibilityLabel={`${displayName(p) || 'Mon profil'}, modifier le profil`} style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 28, padding: 14 }, glassSurface(c, scheme)]}>
          <Avatar name={p.name || '?'} uri={p.avatar} size={58} on />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="body" style={[F.s600, { fontSize: 17 }]} numberOfLines={1}>
              {displayName(p) || 'Mon profil'}
            </T>
            <T v="caption" tone="ink2" numberOfLines={1}>
              {who || 'Photo, nom, pseudo'}
            </T>
          </View>
          <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.pill }}>
            <Icon name="edit" size={17} color={c.ink} />
          </View>
        </Tap>

        <Group>
          <Row testID="settings-notifs" icon="bell" title="Notifications" detail={s.notifs ? NOTIF_LABEL[s.notifs] : 'Pas encore choisi'} onPress={() => setNotifsOpen(true)} last />
        </Group>

        <Label text="Apparence" />
        <Group>
          <View style={{ paddingVertical: 14, gap: 10, borderBottomWidth: 1, borderColor: c.rule }}>
            <T v="body" style={F.s500}>
              Thème
            </T>
            <SegmentedPill
              label="Thème"
              value={pref}
              onChange={setPref}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'light', label: 'Clair', icon: 'sun' },
                { value: 'dark', label: 'Sombre', icon: 'moon' },
              ]}
            />
          </View>
          <View style={{ paddingVertical: 14, gap: 10, borderBottomWidth: 1, borderColor: c.rule }}>
            <T v="body" style={F.s500}>
              Grille du dressing
            </T>
            <SegmentedPill
              label="Grille du dressing"
              value={s.density}
              onChange={a.setDensity}
              options={[
                { value: 'aeree', label: '2 colonnes' },
                { value: 'dense', label: '3 colonnes' },
              ]}
            />
          </View>
          <Row icon="layers" title="Verre plus opaque" detail="Barres et boutons pleins" right={<Toggle testID="solid-glass" value={solidGlass} onChange={setSolidGlass} label="Verre plus opaque" />} last />
        </Group>

        <Label text="Mon compte" />
        <Group>
          {online && s.account === 'nouveau' && <Row testID="me-account" icon="lock" title={s.pendingEmail ? 'J’ai confirmé mon e-mail : me connecter' : 'Créer mon compte'} onPress={() => setAccount(true)} />}
          <Row testID="settings-offer" icon="gift" title="Mon offre" onPress={() => nav.navigate('Offers')} right={<View className="flex-row items-center" style={{ gap: 8 }}><Badge label={plan.name} tone="neutral" /><Icon name="chevron" size={18} color={c.ink2} /></View>} />
          <Row testID="me-shop" icon="bag" title="La boutique" onPress={() => nav.navigate('Shop')} />
          <Row testID="me-silhouette" icon="ruler" title="Ma silhouette" detail={`Kodi te connaît à ${precision(p)} %`} onPress={() => nav.navigate('Silhouette')} />
          <Row
            testID="me-loans"
            icon="share"
            title="Prêts et partages"
            detail={loans.length ? `${loans.length} prêt${loans.length > 1 ? 's' : ''} en cours` : s.account === 'demo' ? `Avec ${FRIENDS.slice(0, 3).map((f) => f.name).join(', ')}…` : undefined}
            onPress={() => setSharesOpen(true)}
            last
          />
        </Group>

        <Label text="Vie privée" />
        <Group>
          <Row testID="settings-donnees" icon="lock" title="Tes données" detail="Ce que nous gardons, tes accords, tes droits" onPress={() => nav.navigate('TesDonnees')} />
          <Row testID="settings-choix" icon="heart" title="Mes choix" detail="Tes cœurs, et ce que Kodi retient de toi" onPress={() => nav.navigate('MesChoix')} />
          <Row testID="settings-politique" icon="eye" title="Politique de confidentialité" onPress={() => nav.navigate('Confidentialite')} last />
        </Group>

        <Label text="Aide" />
        <Group>
          <Row icon="help" title="Questions fréquentes" onPress={() => a.toast('L’aide arrive bientôt')} />
          <Row testID="me-states" icon="eye" title="Aperçu du design" onPress={() => nav.navigate('States')} last={s.account === 'connecte'} />
          {s.account !== 'connecte' && <Row testID="replay-welcome" icon="refresh" title="Revoir la bienvenue" detail="Remet l’aperçu à zéro" onPress={a.restart} last />}
        </Group>

        {s.account !== 'nouveau' && (
          <View style={{ paddingTop: 10 }}>
            <Button testID="me-logout" label={s.account === 'demo' ? 'Quitter la démonstration' : 'Se déconnecter'} variant="secondary" icon="logout" onPress={s.account === 'demo' ? a.restart : a.logout} />
          </View>
        )}
        <T v="kicker" tone="ink2" style={{ textAlign: 'center', paddingTop: 6 }}>
          {`Dresskode · membre depuis ${p.since}`}
        </T>
      </Animated.ScrollView>

      <AccountSheet visible={account} onClose={() => setAccount(false)} onDone={() => setAccount(false)} initial={s.pendingEmail ? 'login' : 'signup'} />
      <Sheet visible={notifsOpen} onClose={() => setNotifsOpen(false)} title="Notifications" testID="notifs-sheet">
        <NotifChoices value={s.notifs} testID="me-notif" onDone={() => setNotifsOpen(false)} />
      </Sheet>
      <Sheet visible={sharesOpen} onClose={() => setSharesOpen(false)} title="Prêts et partages" testID="shares-sheet">
        {s.shares.length === 0 ? (
          <EmptyState
            title="Rien en cours"
            body="Depuis la fiche d’une pièce, touche Partager pour la montrer, la prêter ou la donner à une amie."
            action={<Button label="Ouvrir le dressing" variant="secondary" size="m" onPress={() => { setSharesOpen(false); nav.navigate('Tabs', { screen: 'Dressing' }); }} />}
          />
        ) : (
          s.shares.map((x, i) => {
            const piece = s.pieces.find((q) => q.id === x.pieceId);
            return <Row key={x.id} icon="share" title={piece?.name ?? 'Pièce'} detail={`${MODE[x.mode]} ${x.friend}`} last={i === s.shares.length - 1} />;
          })
        )}
      </Sheet>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return (
    <T v="kicker" tone="ink2" style={{ paddingHorizontal: 6, paddingTop: 8 }} accessibilityRole="header">
      {text}
    </T>
  );
}
