/**
 * Moi (refait le 07/10) : une page à toi, sur le modèle des grandes boutiques
 * et des applis de banque envoyées en exemple. En haut, ta photo et le nom
 * que tu as choisi ; puis tes chiffres, quatre raccourcis, ta carte de
 * membre (l'offre, les places, les questions ; seulement après la première
 * tenue, depuis le 09/10), ton style tel que Kode le retient, et tes pièces
 * les plus portées. Les réglages sont derrière la
 * roue de l'en-tête ; l'icône Personnaliser reste à l'accueil.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLOR_CHOICES, euros } from '../data/wardrobe';
import { displayName, nextBestAnswer } from '../state/profile';
import { LIMITS, pieceLimit, precision, questionsLeft, usageRate, useStore } from '../state/store';
import { online } from '../state/remote';
import { canCompose } from '../state/outfits';
import { useTheme } from '../theme/ThemeProvider';
import { space, TAB_CLEARANCE } from '../theme/tokens';
import { F } from '../theme/fonts';
import { T } from '../ui/T';
import { BrandMark } from '../ui/Logo';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Garment } from '../ui/Garment';
import { Icon, type IconName } from '../ui/Icon';
import { Ambient } from '../ui/Ambient';
import { AccountSheet } from '../ui/account';
import { Avatar, Card, DotChip, Ring, Tag } from '../ui/bits';
import { ScrollEdge, TabHeader, useTabScroll, useTabTop } from '../ui/layout';
import { PLANS, price } from './Offers';
import type { Nav } from '../navigation/types';

export function Me() {
  const { s } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const edge = useSharedValue(0);
  const onScroll = useTabScroll(edge);
  const top = useTabTop();
  const { c, scheme } = useTheme();
  const [account, setAccount] = useState(false);
  const p = s.profile;
  const name = displayName(p);
  const handle = p.username && p.nameDisplay !== 'pseudo' ? `@${p.username}` : null;
  const plan = PLANS.find((x) => x.id === s.plan)!;
  const limit = pieceLimit(s);
  const left = questionsLeft(s);
  const quota = LIMITS[s.plan].questions;
  const worn30 = s.pieces.filter((x) => x.lastWorn !== null && x.lastWorn <= 30).length;
  // Le coût moyen d'un port, sur les pièces dont on connaît le prix.
  const priced = s.pieces.filter((x) => x.price && x.wears > 0);
  const cpw = priced.length ? priced.reduce((n, x) => n + (x.price ?? 0), 0) / priced.reduce((n, x) => n + x.wears, 0) : null;
  const most = [...s.pieces].filter((x) => x.wears > 0).sort((x, z) => z.wears - x.wears).slice(0, 3);
  const knows = precision(p);
  const next = nextBestAnswer(p);
  const hex = (n: string) => COLOR_CHOICES.find((x) => x.name === n)?.hex;
  const hasStyle = p.styles.length > 0 || p.love.length > 0 || p.avoid.length > 0;
  // L'offre attend la première tenue (09/10) : on ne vend rien à qui n'a pas encore vu Kode à l'œuvre.
  const ready = canCompose(s.pieces);
  const showOffer = ready || s.plan !== 'decouverte';
  const sizes = [p.sizes.haut && `Haut ${p.sizes.haut}`, p.sizes.bas && `Bas ${p.sizes.bas}`, p.sizes.pointure && `Pointure ${p.sizes.pointure}`].filter(Boolean) as string[];

  const stats = [
    { v: String(s.pieces.length), l: s.pieces.length > 1 ? 'pièces' : 'pièce' },
    s.pieces.some((x) => x.wears > 0) ? { v: `${usageRate(s.pieces)} %`, l: 'porté' } : { v: String(worn30), l: 'sorties' },
    cpw !== null ? { v: euros(cpw).replace(' €', ''), l: '€ par port' } : { v: `${knows} %`, l: 'précision' },
  ];

  const shortcuts: { icon: IconName; label: string; onPress: () => void; testID: string; solid?: boolean }[] = [
    { icon: 'plus', label: 'Ajouter', onPress: () => nav.navigate('AddPiece'), testID: 'me-add', solid: true },
    { icon: 'hanger', label: 'Habille-moi', onPress: () => nav.navigate('Compose'), testID: 'me-compose' },
    { icon: 'calendar', label: 'Planning', onPress: () => nav.navigate('Planning'), testID: 'me-planning' },
    showOffer ? { icon: 'bag', label: 'Boutique', onPress: () => nav.navigate('Shop'), testID: 'me-shop-tile' } : { icon: 'palette', label: 'Ton style', onPress: () => nav.navigate('Affiner'), testID: 'me-affiner-tile' },
  ];

  return (
    <View style={{ flex: 1 }} className="bg-paper">
      <Ambient />
      <ScrollEdge y={edge} />
      <TabHeader title="Moi" y={edge} actions={[{ icon: 'gear', label: 'Réglages', onPress: () => nav.navigate('Settings'), testID: 'me-settings' }]} />
      <Animated.ScrollView testID="screen-me" onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top + 4, paddingHorizontal: space.gutter, paddingBottom: TAB_CLEARANCE + insets.bottom, gap: 14 }}>
        {/* Toi (09/10) : la photo à gauche, le nom choisi en fin, le pseudo dessous. */}
        <Tap testID="me-avatar" onPress={() => nav.navigate('ProfileEdit')} accessibilityLabel="Modifier mon profil" scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 }}>
          <View>
            <Avatar name={p.name || '?'} uri={p.avatar} size={72} on />
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c['card-edge'] }}>
              <Icon name={p.avatar ? 'edit' : 'camera'} size={13} color={c.ink} strokeWidth={2} />
            </View>
          </View>
          <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
            <T v="title" style={{ fontSize: 26, lineHeight: 30 }} numberOfLines={2} accessibilityRole="header" testID="me-name">
              {name || 'Bienvenue'}
            </T>
            <T v="small" tone="ink2" numberOfLines={1}>
              {s.account === 'nouveau' ? 'Sans compte · tout reste sur ce téléphone' : [handle, `membre depuis ${p.since}`].filter(Boolean).join(' · ')}
            </T>
          </View>
        </Tap>

        {/* Une débutante (09/10) : pas de chiffres à zéro, le chemin vers sa première tenue. */}
        {s.pieces.length < 3 ? (
          <Card style={{ gap: 12, padding: 16 }} testID="me-first">
            <View className="flex-row items-center justify-between">
              <Tag label="Ta première tenue" />
              <T v="kicker" tone="ink2">{`${s.pieces.length}/3 pièces`}</T>
            </View>
            <View style={{ height: 3, borderRadius: 2, backgroundColor: c.rule, overflow: 'hidden' }}>
              <View style={{ height: 3, width: `${Math.round((s.pieces.length / 3) * 100)}%`, backgroundColor: c.ink }} />
            </View>
            <T v="caption" tone="ink2">
              Un haut, un bas, des chaussures : Kode compose ta première tenue.
            </T>
            <Button testID="me-first-add" label="Ajouter une pièce" icon="plus" size="m" onPress={() => nav.navigate('AddPiece')} />
          </Card>
        ) : (
        <Tap testID="me-stats" onPress={() => nav.navigate('Bilan')} scaleTo={0.99} accessibilityLabel="Tes chiffres. Voir le bilan de la semaine">
        <Card style={{ flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 6 }}>
          {stats.map((x, i) => (
            <View key={x.l} className="items-center" style={{ flex: 1, gap: 2, borderLeftWidth: i ? 1 : 0, borderColor: c.rule }}>
              <T v="stat" numberOfLines={1} adjustsFontSizeToFit>
                {x.v}
              </T>
              <T v="small" tone="ink2">
                {x.l}
              </T>
            </View>
          ))}
        </Card>
        </Tap>
        )}

        {/* Quatre raccourcis, comme les actions rapides d'une banque. */}
        <View className="flex-row justify-between" style={{ paddingHorizontal: 4 }}>
          {shortcuts.map((x) => (
            <Tap key={x.testID} testID={x.testID} onPress={x.onPress} accessibilityLabel={x.label} scaleTo={0.95} style={{ alignItems: 'center', gap: 6, width: 76 }}>
              <View style={[{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, x.solid ? { backgroundColor: c['primary-bg'] } : { backgroundColor: c['glass-strong'], borderWidth: 1, borderColor: c['card-edge'] }]}>
                <Icon name={x.icon} size={20} color={x.solid ? c['primary-fg'] : c.ink} strokeWidth={1.8} />
              </View>
              <T v="small" numberOfLines={1}>
                {x.label}
              </T>
            </Tap>
          ))}
        </View>

        {/* La carte de membre : l'offre, les places, les questions ; elle ouvre les offres. Seulement après la première tenue. */}
        {showOffer && (
        <Tap testID="me-offer" onPress={() => nav.navigate('Offers')} scaleTo={0.99} accessibilityLabel={`Ton offre ${plan.name}. Voir les offres`} style={{ borderRadius: 28, padding: 18, gap: 14, backgroundColor: c['primary-bg'] }}>
          <View className="flex-row items-center justify-between">
            <BrandMark tone="primary-fg" size={18} textStyle={{ fontSize: 11, letterSpacing: 3.3 }} />
            <T v="label" tone="primary-fg" style={{ opacity: 0.75 }}>
              Carte de membre
            </T>
          </View>
          <View style={{ gap: 2 }}>
            <T v="title" tone="primary-fg" style={{ fontSize: 30, lineHeight: 34 }}>
              {plan.name}
            </T>
            <T v="caption" tone="primary-fg" style={{ opacity: 0.8 }}>
              {plan.cents.mois === 0 ? 'Gratuit, sans carte' : `${price(plan.cents[s.period])} par ${s.period}`}
            </T>
          </View>
          <View className="flex-row" style={{ gap: 14 }}>
            <Meter label="Places" value={s.pieces.length} max={limit} />
            <Meter label="Questions" value={quota === null ? null : quota - (left ?? 0)} max={quota} />
          </View>
          <View className="flex-row items-center justify-between">
            <T v="caption" tone="primary-fg" style={F.s600}>
              {s.plan === 'couture' ? 'Voir mon offre' : 'Voir les offres'}
            </T>
            <Icon name="arrow" size={16} color={c['primary-fg']} />
          </View>
        </Tap>
        )}

        {/* Ton style, tel que Kode le retient : il se modifie dans le profil. */}
        <Card style={{ gap: 14 }} testID="me-style">
          <View className="flex-row items-center justify-between">
            <Tag label="Ton style" />
            <T testID="me-style-edit" v="label" tone="ink2" onPress={() => nav.navigate('ProfileEdit')} accessibilityRole="link" suppressHighlighting style={{ paddingVertical: 10, paddingLeft: 12 }}>
              Modifier
            </T>
          </View>
          {hasStyle ? (
            <View style={{ gap: 12 }}>
              {p.styles.length > 0 && (
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {p.styles.map((x) => (
                    <DotChip key={x} label={x} />
                  ))}
                </View>
              )}
              {(p.love.length > 0 || p.avoid.length > 0) && (
                <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
                  {p.love.map((x) => (
                    <DotChip key={x} label={x} swatch={hex(x)} />
                  ))}
                  {p.avoid.map((x) => (
                    <DotChip key={x} label={`Pas de ${x.toLowerCase()}`} swatch={hex(x)} />
                  ))}
                </View>
              )}
              {sizes.length > 0 && (
                <T v="kicker" tone="ink2">
                  {sizes.join(' · ')}
                </T>
              )}
            </View>
          ) : (
            <T v="body" tone="ink2">
              Dis à Kode ce que tu aimes : tes tenues lui ressembleront davantage.
            </T>
          )}
          <Tap testID="me-precision" onPress={() => nav.navigate(knows < 50 ? 'Affiner' : 'Silhouette')} scaleTo={0.99} accessibilityLabel={`Kode te connaît à ${knows} %`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1, borderColor: c.rule }}>
            <Ring value={knows} size={40} stroke={3}>
              <T v="kicker">{`${knows}`}</T>
            </Ring>
            <View style={{ flex: 1 }}>
              <T v="body" style={F.s500}>
                Kode te connaît à {knows} %
              </T>
              {next && (
                <T v="caption" tone="ink2">
                  {`Ajoute ${next.label} : +${next.gain} %`}
                </T>
              )}
            </View>
            <Icon name="chevron" size={18} color={c.ink2} />
          </Tap>
        </Card>

        {most.length > 0 && (
          <Card style={{ padding: 14, gap: 12 }}>
            <Tag label="Le plus porté" />
            <View className="flex-row" style={{ gap: 8 }}>
              {most.map((x) => (
                <Tap key={x.id} testID={`most-${x.id}`} onPress={() => nav.navigate('Piece', { id: x.id })} accessibilityLabel={`${x.name}, ${x.wears} ports`} outerStyle={{ flex: 1 }} style={{ height: 96, borderRadius: 18, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center' }}>
                  <Garment kind={x.kind} tint={x.tint} image={x.image} size={56} dark={scheme === 'dark'} label={x.name} />
                  <View style={{ position: 'absolute', top: 8, left: 8 }}>
                    <Tag label={`${x.wears}×`} tone="glass" dot={false} />
                  </View>
                </Tap>
              ))}
            </View>
          </Card>
        )}

        {online && s.account === 'nouveau' && (
          <Card className="bg-butter" style={{ gap: 12 }}>
            <T v="cardTitle">Garde ton dressing partout</T>
            <T v="body">Un compte, et tes pièces te suivent sur tous tes appareils.</T>
            <Button testID="me-account" label={s.pendingEmail ? 'J’ai confirmé : me connecter' : 'Créer mon compte'} size="m" onPress={() => setAccount(true)} />
          </Card>
        )}
      </Animated.ScrollView>
      <AccountSheet visible={account} onClose={() => setAccount(false)} onDone={() => setAccount(false)} initial={s.pendingEmail ? 'login' : 'signup'} />
    </View>
  );
}

/** Une jauge de la carte de membre : « 19 / 30 », ou « sans limite ». */
function Meter({ label, value, max }: { label: string; value: number | null; max: number | null }) {
  const { c } = useTheme();
  const pct = max === null || value === null ? 100 : Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={{ flex: 1, gap: 6 }} accessibilityLabel={max === null ? `${label} sans limite` : `${label} : ${value} sur ${max}`}>
      <View className="flex-row items-baseline justify-between">
        <T v="kicker" tone="primary-fg" style={{ opacity: 0.75 }} numberOfLines={1}>
          {label}
        </T>
        <T v="kicker" tone="primary-fg">
          {max === null ? '∞' : `${value}/${max}`}
        </T>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c['primary-fg'], opacity: 0.25 }} />
      <View style={{ position: 'absolute', left: 0, bottom: 0, height: 4, borderRadius: 2, width: `${pct}%`, backgroundColor: c['primary-fg'] }} />
    </View>
  );
}
