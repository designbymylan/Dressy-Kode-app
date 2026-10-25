/**
 * Tes données (09/10, RGPD) : ce que Dresskode garde, tes accords, et tes
 * droits en un geste (télécharger, corriger, effacer ta silhouette,
 * supprimer ton compte). Ouvert depuis Réglages. Sans compte, tout est sur
 * le téléphone : l'écran le dit, et « Effacer ce téléphone » remplace la
 * suppression du compte.
 */
import { useState } from 'react';
import { Linking, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { DUREES, EDITEUR } from '../data/legal';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { F } from '../theme/fonts';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Toggle } from '../ui/controls';
import { Card, Group, Row, Tag } from '../ui/bits';
import { NOTIF_LABEL, NotifChoices } from '../ui/rappels';
import { Ambient } from '../ui/Ambient';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import type { Nav } from '../navigation/types';

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function TesDonnees() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const [withdraw, setWithdraw] = useState(false);
  const [remove, setRemove] = useState(false);
  const [sure, setSure] = useState(false);
  const [notifs, setNotifs] = useState(false);
  const [busy, setBusy] = useState<'export' | 'delete' | 'consent' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const p = s.profile;
  const compte = s.account === 'connecte';
  const demo = s.account === 'demo';
  const hasBody = !!(p.height || p.weight || (p.silhouette && p.silhouette !== 'inconnue') || Object.values(p.measures).some(Boolean));
  const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

  const kept: { icon: 'person' | 'hanger' | 'ruler' | 'calendar' | 'kode' | 'close'; title: string; detail: string }[] = [
    { icon: 'person', title: 'Ton compte', detail: compte ? `${p.email ?? 'E-mail'} · prénom, pseudo, photo si tu les as donnés` : demo ? 'Compte de démonstration : rien n’est à toi ici' : 'Sans compte : tout reste sur ce téléphone' },
    { icon: 'hanger', title: 'Ton dressing', detail: `${plural(s.pieces.length, 'pièce', 'pièces')} · photos confiées à Kodi effacées ${DUREES.photos}` },
    { icon: 'ruler', title: 'Ta silhouette', detail: p.bodyConsent ? `Accord donné le ${date(p.bodyConsent)}` : hasBody ? 'Des valeurs sans accord : décide ci-dessous' : 'Rien d’enregistré' },
    { icon: 'calendar', title: 'Ton agenda', detail: `${plural(s.events.length, 'rendez-vous', 'rendez-vous')} · ${plural(s.trips.length, 'voyage', 'voyages')}` },
    { icon: 'kode', title: 'Tes échanges avec Kodi', detail: `${plural(s.messages.length, 'message', 'messages')} · gardés ${DUREES.conversations}` },
    { icon: 'close', title: 'Tes « Pas pour moi »', detail: `${plural(s.ecarts.length, 'tenue écartée', 'tenues écartées')} · gardées ${DUREES.ecarts}` },
  ];

  const consent = async (on: boolean) => {
    if (!on) return setWithdraw(true);
    setBusy('consent');
    await a.setBodyConsent(true);
    setBusy(null);
  };

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-donnees">
      <Ambient />
      <StackHeader title="Tes données" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top + 4, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <View style={{ gap: 8, paddingHorizontal: 4, paddingBottom: 4 }}>
          <T v="label" tone="ink2">
            Vie privée
          </T>
          <T v="hero" accessibilityRole="header">
            {'Tes données\n'}
            <T v="hero" style={F.accent}>
              t’appartiennent
            </T>
            .
          </T>
          <T v="body" tone="ink2">
            Ce que Dresskode garde, pourquoi, et comment tout reprendre. Rien n’est vendu, rien ne sert à de la publicité.
          </T>
        </View>

        <Card style={{ gap: 12 }} testID="donnees-gardees">
          <Tag label="Ce que nous gardons" />
          {kept.map((k, i) => (
            <View key={k.title} className="flex-row items-center" style={{ gap: 12, paddingTop: i ? 12 : 0, borderTopWidth: i ? 1 : 0, borderColor: c.rule }}>
              <Icon name={k.icon} size={18} color={c.ink} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="body" style={F.s500}>
                  {k.title}
                </T>
                <T v="small" tone="ink2">
                  {k.detail}
                </T>
              </View>
            </View>
          ))}
        </Card>

        <Card style={{ gap: 4 }} testID="donnees-accords">
          <Tag label="Tes accords" />
          <View className="flex-row items-center" style={{ gap: 12, paddingVertical: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="body" style={F.s500}>
                Silhouette et mesures
              </T>
              <T v="small" tone="ink2">
                Taille, silhouette et mesures, pour tes coupes. Kodi reçoit ta silhouette et ta taille, sans ton nom.
              </T>
            </View>
            <Toggle testID="consent-silhouette" value={!!p.bodyConsent} onChange={(v) => void consent(v)} label="Accord pour la silhouette et les mesures" />
          </View>
          {hasBody && !p.bodyConsent && (
            <View style={{ gap: 8, paddingBottom: 6 }}>
              <T v="caption" tone="ink2">
                Tu nous as donné ces informations avant qu’on te demande ton accord. Garde-les en donnant ton accord, ou efface-les.
              </T>
              <Button testID="erase-body" label="Effacer ma silhouette" variant="secondary" size="m" onPress={() => setWithdraw(true)} />
            </View>
          )}
          <Tap testID="donnees-notifs" onPress={() => setNotifs(true)} accessibilityRole="button" accessibilityLabel="Notifications" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderColor: c.rule }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="body" style={F.s500}>
                Rappels
              </T>
              <T v="small" tone="ink2">
                {s.notifs ? NOTIF_LABEL[s.notifs] : 'Pas encore choisi'} · posés par ton téléphone, jamais envoyés par nos serveurs
              </T>
            </View>
            <Icon name="chevron" size={18} color={c.ink2} />
          </Tap>
        </Card>

        <T v="label" tone="ink2" style={{ paddingHorizontal: 6, paddingTop: 6 }} accessibilityRole="header">
          Tes droits
        </T>
        <Group testID="donnees-droits">
          {compte && (
            <Row
              testID="export-data"
              icon="share"
              title={busy === 'export' ? 'Préparation de ton fichier…' : 'Télécharger mes données'}
              detail="Tout ce que nous gardons, dans un fichier"
              onPress={async () => {
                if (busy) return;
                setBusy('export');
                const r = await a.exportData();
                setBusy(null);
                if (!r.ok) a.toast(r.message, true);
              }}
            />
          )}
          <Row testID="donnees-profil" icon="edit" title="Corriger mon profil" detail="Prénom, nom, pseudo, photo, goûts" onPress={() => nav.navigate('ProfileEdit')} />
          <Row testID="donnees-politique" icon="eye" title="Politique de confidentialité" detail="Ce que nous faisons de tes données, en clair" onPress={() => nav.navigate('Confidentialite')} />
          {EDITEUR.contact && <Row testID="donnees-contact" icon="mail" title="Nous écrire" detail={EDITEUR.contact} onPress={() => void Linking.openURL(`mailto:${EDITEUR.contact}`)} />}
          {!demo && <Row testID="delete-account" icon="trash" title={compte ? 'Supprimer mon compte' : 'Effacer ce téléphone'} detail={compte ? 'Ton dressing, tes photos, tout, pour de bon' : 'Tout ce que tu as rempli ici'} onPress={() => { setSure(false); setError(null); setRemove(true); }} last />}
        </Group>

        <T v="small" tone="ink2" style={{ paddingHorizontal: 6 }}>
          Un désaccord sur l’usage de tes données ? Tu peux saisir la CNIL, sur cnil.fr.
        </T>
      </Animated.ScrollView>

      <Sheet
        visible={withdraw}
        onClose={() => setWithdraw(false)}
        kicker="Silhouette et mesures"
        title={p.bodyConsent ? 'Retirer ton accord ?' : 'Effacer ta silhouette ?'}
        testID="withdraw-sheet"
        footer={
          <Button
            testID="withdraw-confirm"
            label="Retirer et effacer"
            loading={busy === 'consent'}
            onPress={async () => {
              setBusy('consent');
              const ok = await a.setBodyConsent(false);
              setBusy(null);
              if (ok) setWithdraw(false);
            }}
          />
        }
      >
        <T v="body" tone="ink2">
          Ta taille, ta silhouette et tes mesures sont effacées aussitôt, sur ce téléphone et dans ton compte. Kodi ne s’en servira plus. Tu pourras les redonner quand tu veux.
        </T>
      </Sheet>

      <Sheet
        visible={remove}
        onClose={() => setRemove(false)}
        kicker={compte ? 'Ton compte' : 'Ce téléphone'}
        title={compte ? 'Supprimer ton compte ?' : 'Effacer ce téléphone ?'}
        testID="delete-sheet"
        footer={
          <Button
            testID="delete-confirm"
            label={busy === 'delete' ? 'Suppression…' : compte ? 'Supprimer définitivement' : 'Tout effacer'}
            icon="trash"
            disabled={!sure}
            loading={busy === 'delete'}
            onPress={async () => {
              setBusy('delete');
              setError(null);
              const r = await a.deleteAccount();
              setBusy(null);
              if (!r.ok) return setError(r.message);
              setRemove(false);
            }}
          />
        }
      >
        <View style={{ gap: 12 }}>
          {(compte
            ? [
                'Ton dressing, tes photos, tes tenues, ton agenda, tes échanges avec Kodi et ta silhouette sont effacés.',
                'Ton abonnement s’arrête aussitôt : plus aucun prélèvement.',
                'Tes factures restent chez notre prestataire de paiement, comme la loi l’exige (10 ans).',
              ]
            : ['Ton dressing, ton profil et tout ce que tu as rempli sur ce téléphone sont effacés. Rien n’était chez nous.']
          ).map((x) => (
            <View key={x} className="flex-row" style={{ gap: 10 }}>
              <Icon name="check" size={16} color={c.ink2} flat />
              <T v="body" style={{ flex: 1 }}>
                {x}
              </T>
            </View>
          ))}
          {compte && (
            <T v="caption" tone="ink2">
              Envie de garder une copie ? Télécharge tes données avant.
            </T>
          )}
          <Tap testID="delete-sure" onPress={() => setSure(!sure)} feedback="select" scaleTo={1} accessibilityRole="checkbox" accessibilityState={{ checked: sure }} accessibilityLabel="Je comprends que c’est définitif" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
            <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: sure ? c.ink : c.control, backgroundColor: sure ? c['primary-bg'] : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {sure && <Icon name="check" size={15} color={c['primary-fg']} strokeWidth={2.4} flat />}
            </View>
            <T v="body" style={F.s500}>
              Je comprends que c’est définitif
            </T>
          </Tap>
          {error && (
            <T v="caption" tone="caution" accessibilityLiveRegion="polite">
              {error}
            </T>
          )}
        </View>
      </Sheet>

      <Sheet visible={notifs} onClose={() => setNotifs(false)} title="Rappels" testID="donnees-notifs-sheet">
        <NotifChoices value={s.notifs} testID="donnees-notif" onDone={() => setNotifs(false)} />
      </Sheet>
    </View>
  );
}
