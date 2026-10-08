/**
 * Les offres (refaites le 07/10), sur le modèle des pages d'abonnement
 * envoyées par l'utilisatrice : la remise en très grand, ce qui est inclus
 * en quatre tuiles, le choix mois ou année, des cartes à cocher avec le prix
 * barré et des patchs (« -29 % », « Recommandée », « 1 mois offert »), puis
 * l'action en bas, toujours visible. Pas de faux avis : l'app n'en a pas
 * encore. Les couleurs restent celles de la galerie.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { euros } from '../data/wardrobe';
import { LIMITS, pieceLimit, questionsLeft, useStore, type Period, type PlanId } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { F } from '../theme/fonts';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { SegmentedPill } from '../ui/controls';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { Card, DotChip, Tag } from '../ui/bits';
import { Icon, type IconName } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Ambient } from '../ui/Ambient';
import { Patch, Seal, Struck } from '../ui/Patch';
import type { Nav } from '../navigation/types';

type Feature = { label: string; icon: IconName; soon?: boolean };

/** Mêmes montants que web/src/lib/plans.ts (source unique côté serveur). */
export const PLANS: { id: PlanId; name: string; note: string; cents: Record<Period, number>; features: Feature[]; flagged?: boolean }[] = [
  { id: 'decouverte', name: 'Découverte', note: 'Pour essayer, sans carte', cents: { mois: 0, an: 0 }, features: [{ label: 'Jusqu’à 30 pièces', icon: 'hanger' }, { label: '5 questions à Kode par mois', icon: 'kode' }] },
  { id: 'capsule', name: 'Capsule', note: 'Pour commencer sans se presser', cents: { mois: 699, an: 5999 }, features: [{ label: 'Jusqu’à 60 pièces', icon: 'hanger' }, { label: '20 questions à Kode par mois', icon: 'kode' }, { label: 'Tenue du jour et agenda', icon: 'calendar' }] },
  { id: 'atelier', name: 'Atelier', note: 'Le dressing complet, Kode sans limite', cents: { mois: 1299, an: 10999 }, flagged: true, features: [{ label: 'Jusqu’à 200 pièces', icon: 'hanger' }, { label: 'Kode sans limite', icon: 'kode' }, { label: 'Tenue du jour et agenda', icon: 'calendar' }, { label: 'Les cinq packs inclus', icon: 'gift', soon: true }] },
  { id: 'couture', name: 'Couture', note: 'Pour les garde-robes sans fin', cents: { mois: 2499, an: 21999 }, features: [{ label: 'Pièces illimitées', icon: 'hanger' }, { label: 'Kode sans limite', icon: 'kode' }, { label: 'Audit de garde-robe chaque trimestre', icon: 'chart', soon: true }, { label: 'Prêts entre amies illimités', icon: 'share', soon: true }] },
];

export const price = (cents: number) => euros(cents / 100);

/** Ce que l'année fait gagner sur douze mois, arrondi vers le bas pour ne jamais promettre plus. */
export const saving = (p: (typeof PLANS)[number]) => (p.cents.mois ? Math.floor(((p.cents.mois * 12 - p.cents.an) / (p.cents.mois * 12)) * 100) : 0);
export const bestSaving = () => Math.max(...PLANS.map(saving));
/** Le plus petit prix à la semaine, sur l'année, arrondi vers le haut. */
const fromWeekly = () => Math.min(...PLANS.filter((p) => p.cents.an > 0).map((p) => Math.ceil(p.cents.an / 52)));

export function Offers() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const [period, setPeriod] = useState<Period>('an');
  const [choice, setChoice] = useState<PlanId | null>(null);
  const [confirm, setConfirm] = useState(false);
  const limit = pieceLimit(s);
  const left = questionsLeft(s);
  const rank = (id: PlanId) => PLANS.findIndex((p) => p.id === id);
  const flagged = PLANS.find((p) => p.flagged)!;
  // Sans choix, on propose l'offre recommandée à qui est en dessous.
  const pick = choice ?? (rank(s.plan) < rank(flagged.id) ? flagged.id : null);
  const picked = PLANS.find((p) => p.id === pick);
  const best = bestSaving();
  // Le mois offert vaut pour une première souscription annuelle (web/src/lib/plans.ts).
  const firstYear = s.plan === 'decouverte';
  const shown = picked ?? PLANS.find((p) => p.id === s.plan)!;

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-offers">
      <Ambient />
      <StackHeader title="Les offres" brand y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 120, gap: 18 }}>
        {/* La remise en très grand, et le sceau du mois offert. */}
        <View style={{ paddingTop: 6, paddingBottom: 4 }}>
          <T v="kicker" tone="ink2">
            Sur l’abonnement annuel
          </T>
          <T v="hero" style={{ fontSize: 76, lineHeight: 80, letterSpacing: -1 }} accessibilityRole="header" testID="offers-discount">
            {`-${best} %`}
          </T>
          <T v="body" style={{ fontSize: 17 }}>
            Dès{' '}
            <T v="body" style={[F.s600, { fontSize: 17 }]}>
              {price(fromWeekly())}
            </T>{' '}
            par semaine
          </T>
          {firstYear && <Seal big="1 mois" small="offert sur l’année" size={112} tilt={10} style={{ position: 'absolute', right: 0, top: 4 }} />}
        </View>

        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {limit !== null && <DotChip label={`${s.pieces.length} / ${limit} places`} />}
          <DotChip label={left === null ? 'Kode sans limite' : `${left} / ${LIMITS[s.plan].questions} questions`} />
        </View>

        {/* Ce qui est inclus dans l'offre choisie, en quatre tuiles. */}
        <View style={{ gap: 10 }}>
          <View className="flex-row items-center justify-between">
            <Tag label={`Dans ${shown.name}`} />
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 10 }} testID="offers-included">
            {shown.features.map((f) => (
              <Card key={f.label} style={{ width: '48%', flexGrow: 1, padding: 14, gap: 10, borderRadius: 22 }}>
                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.pill }}>
                  <Icon name={f.icon} size={20} color={c.ink} />
                </View>
                <T v="body" style={[F.s500, { fontSize: 14.5, lineHeight: 19 }]} numberOfLines={3}>
                  {f.label}
                </T>
                {f.soon && <Tag label="bientôt" />}
              </Card>
            ))}
          </View>
        </View>

        {/* Mois ou année : la remise est collée sur l'année. */}
        <View style={{ paddingTop: 8 }}>
          <SegmentedPill
            label="Période de paiement"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'mois', label: 'Au mois' },
              { value: 'an', label: 'À l’année' },
            ]}
          />
          <Patch label={`-${best} %`} tilt={6} style={{ position: 'absolute', right: 10, top: -6 }} />
        </View>

        <View accessibilityRole="radiogroup" accessibilityLabel="Offres" style={{ gap: 14 }}>
          {PLANS.map((p) => {
            const mine = p.id === s.plan;
            const on = p.id === pick;
            const free = p.cents.mois === 0;
            const off = saving(p);
            return (
              <Animated.View key={p.id} layout={LinearTransition}>
                <Tap
                  testID={`plan-${p.id}`}
                  onPress={() => (mine ? undefined : setChoice(p.id))}
                  disabled={mine}
                  scaleTo={0.99}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, disabled: mine }}
                  accessibilityLabel={`${p.name}, ${free ? 'gratuit' : `${price(p.cents[period])} par ${period}`}${mine ? ', ton offre actuelle' : ''}`}
                  style={{ backgroundColor: c.card, borderRadius: 24, paddingVertical: 18, paddingHorizontal: 16, borderWidth: on ? 2 : 1, borderColor: on ? c.ink : c['card-edge'], flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 7 : 1.5, borderColor: on ? c.ink : mine ? c.faint : c.control }} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
                      <T v="body" style={[F.s600, { fontSize: 17 }]}>
                        {p.name}
                      </T>
                      {mine && <Tag label="La tienne" />}
                    </View>
                    <T v="kicker" tone="ink2" numberOfLines={2}>
                      {p.features.filter((f) => !f.soon).slice(0, 2).map((f) => f.label.replace('Jusqu’à ', '').replace(' à Kode par mois', '')).join(' · ')}
                    </T>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 1 }}>
                    {!free && period === 'an' && <Struck label={price(p.cents.mois * 12)} />}
                    <T v="stat" style={{ fontSize: 26, lineHeight: 28 }}>
                      {free ? '0 €' : price(p.cents[period])}
                    </T>
                    <T v="kicker" tone="ink2">
                      {free ? 'pour toujours' : period === 'mois' ? 'par mois' : `soit ${price(Math.round(p.cents.an / 12))}/mois`}
                    </T>
                  </View>
                </Tap>
                {p.flagged && <Patch label="Recommandée" tone="ink" tilt={-3} style={{ position: 'absolute', top: -11, left: 18 }} />}
                {!free && period === 'an' && off > 0 && <Patch label={`-${off} %`} tilt={4} style={{ position: 'absolute', top: -11, right: 18 }} />}
              </Animated.View>
            );
          })}
        </View>

        {/* Les trois réponses aux trois questions qu'on se pose avant de payer. */}
        <View className="flex-row" style={{ gap: 8 }}>
          {(
            [
              ['check', 'Sans engagement'],
              ['refresh', 'Résiliable en un geste'],
              ['lock', 'Paiement sécurisé'],
            ] as const
          ).map(([icon, label]) => (
            <View key={label} className="items-center" style={{ flex: 1, gap: 6 }}>
              <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.pill }}>
                <Icon name={icon} size={17} color={c.ink} strokeWidth={1.9} />
              </View>
              <T v="kicker" tone="ink2" style={{ textAlign: 'center' }}>
                {label}
              </T>
            </View>
          ))}
        </View>

        {/* La boutique, en bandeau d'offre. */}
        <Tap testID="offers-shop" onPress={() => nav.navigate('Shop')} scaleTo={0.99} accessibilityLabel="Achats à l’unité : la boutique" style={{ borderRadius: 28, padding: 18, backgroundColor: c.butter, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View className="items-center justify-center" style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c['butter-field'] }}>
            <Icon name="bag" size={22} color={c['butter-ink']} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="body" style={[F.s600, { color: c['butter-ink'] }]}>
              Plutôt à l’unité ?
            </T>
            <T v="caption" style={{ color: c['butter-ink'] }}>
              Packs dès 0,99 €, à toi pour toujours
            </T>
          </View>
          <Icon name="chevron" size={18} color={c['butter-ink']} />
        </Tap>

        <T v="small" tone="ink2" style={{ textAlign: 'center' }}>
          Prix TTC. Le mois offert vaut pour la première souscription annuelle.
        </T>
      </Animated.ScrollView>

      {picked && (
        <View style={{ position: 'absolute', left: space.gutter, right: space.gutter, bottom: insets.bottom + 16 }}>
          <Button testID="offers-cta" label={picked.cents.mois === 0 ? `Revenir à ${picked.name}` : `${rank(picked.id) > rank(s.plan) ? 'Passer à' : 'Revenir à'} ${picked.name} · ${price(picked.cents[period])}`} onPress={() => setConfirm(true)} />
        </View>
      )}

      <Sheet
        visible={confirm && !!picked}
        onClose={() => setConfirm(false)}
        kicker={picked && rank(picked.id) > rank(s.plan) ? 'Passer à' : 'Revenir à'}
        title={picked?.name ?? ''}
        testID="plan-confirm"
        footer={
          <Button
            testID="plan-pay"
            label={picked?.cents.mois === 0 ? 'Confirmer' : period === 'an' && firstYear ? 'Commencer le mois offert' : `S’abonner · ${picked ? price(picked.cents[period]) : ''}`}
            icon={picked?.cents.mois === 0 ? undefined : 'lock'}
            onPress={() => {
              if (picked) a.setPlan(picked.id, period);
              setConfirm(false);
              setChoice(null);
            }}
          />
        }
      >
        {picked && (
          <View style={{ gap: 12 }}>
            {picked.features.map((f) => (
              <View key={f.label} className="flex-row items-center" style={{ gap: 10 }}>
                <Icon name="check" size={18} color={c.positive} strokeWidth={2} />
                <T v="body" style={{ flex: 1 }}>
                  {f.label}
                  {f.soon ? ' (bientôt)' : ''}
                </T>
              </View>
            ))}
            <View className="flex-row justify-between" style={{ paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.rule }}>
              <T v="bodyStrong">{period === 'mois' ? 'Chaque mois' : 'Chaque année'}</T>
              <T v="bodyStrong">{picked.cents.mois === 0 ? '0 €' : `${price(picked.cents[period])} TTC`}</T>
            </View>
            <T v="small" tone="ink2">
              {picked.cents.mois === 0 ? 'Tes pièces au-delà de 30 restent visibles, mais tu ne pourras plus en ajouter.' : s.account === 'connecte' ? 'Paiement sécurisé par Stripe, dans ton navigateur. Résiliable à tout moment.' : 'Résiliable à tout moment. Aperçu : le paiement est simulé, rien n’est prélevé.'}
            </T>
          </View>
        )}
      </Sheet>
    </View>
  );
}
