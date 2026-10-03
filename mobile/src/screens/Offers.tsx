import { useState } from 'react';
import { View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { euros } from '../data/wardrobe';
import { LIMITS, pieceLimit, questionsLeft, useStore, type Period, type PlanId } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { SegmentedPill } from '../ui/controls';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { Badge, Card, Gauge } from '../ui/bits';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Ambient } from '../ui/Ambient';
import type { Nav } from '../navigation/types';
import { F } from '../theme/fonts';

/** Mêmes montants que web/src/lib/plans.ts (source unique côté serveur). */
export const PLANS: { id: PlanId; name: string; note: string; cents: Record<Period, number>; features: { label: string; soon?: boolean }[]; flagged?: boolean }[] = [
  { id: 'decouverte', name: 'Découverte', note: 'Pour essayer, sans carte', cents: { mois: 0, an: 0 }, features: [{ label: 'Jusqu’à 30 pièces' }, { label: '5 questions à Kode par mois' }] },
  { id: 'capsule', name: 'Capsule', note: 'Pour commencer sans se presser', cents: { mois: 699, an: 5999 }, features: [{ label: 'Jusqu’à 60 pièces' }, { label: '20 questions à Kode par mois' }, { label: 'Tenue du jour et agenda' }] },
  { id: 'atelier', name: 'Atelier', note: 'Le dressing complet, Kode sans limite', cents: { mois: 1299, an: 10999 }, flagged: true, features: [{ label: 'Jusqu’à 200 pièces' }, { label: 'Kode sans limite' }, { label: 'Les cinq packs inclus', soon: true }] },
  { id: 'couture', name: 'Couture', note: 'Pour les garde-robes sans fin', cents: { mois: 2499, an: 21999 }, features: [{ label: 'Pièces illimitées' }, { label: 'Kode sans limite' }, { label: 'Audit de garde-robe chaque trimestre', soon: true }, { label: 'Prêts entre amies illimités', soon: true }] },
];

const price = (cents: number) => euros(cents / 100);

export function Offers() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const [period, setPeriod] = useState<Period>('an');
  const [choice, setChoice] = useState<PlanId | null>(null);
  const current = PLANS.find((p) => p.id === s.plan)!;
  const limit = pieceLimit(s);
  const left = questionsLeft(s);
  const target = PLANS.find((p) => p.id === choice);
  const rank = (id: PlanId) => PLANS.findIndex((p) => p.id === id);

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-offers">
      <Ambient />
      <StackHeader title="Les offres" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 20 }}>
        <View style={{ gap: 8 }}>
          <T v="kicker" tone="ink2" upper>
            Les offres
          </T>
          <T v="title" accessibilityRole="header">
            Porte mieux,{'\n'}
            <T v="title" style={{ ...F.accent }}>
              paie juste.
            </T>
          </T>
          <T v="body" tone="ink2">
            Sans publicité, sans engagement. Tu changes ou tu arrêtes quand tu veux, depuis Moi.
          </T>
        </View>

        <Card style={{ gap: 10 }}>
          <View className="flex-row items-center justify-between">
            <T v="kicker" tone="ink2" upper>
              Aujourd’hui
            </T>
            <Badge label={current.name} tone="neutral" />
          </View>
          {limit !== null && (
            <>
              <View className="flex-row justify-between">
                <T v="caption">Places du dressing</T>
                <T v="caption" tone="ink2">
                  {s.pieces.length} sur {limit}
                </T>
              </View>
              <Gauge value={s.pieces.length} max={limit} label="Places du dressing" />
            </>
          )}
          <View className="flex-row justify-between">
            <T v="caption">Questions à Kode ce mois-ci</T>
            <T v="caption" tone="ink2">
              {left === null ? 'sans limite' : `${left} restantes sur ${LIMITS[s.plan].questions}`}
            </T>
          </View>
        </Card>

        <SegmentedPill
          label="Période de paiement"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'mois', label: 'Mensuel' },
            { value: 'an', label: 'Annuel · 1 mois offert' },
          ]}
        />

        <View style={{ gap: 12 }}>
          {PLANS.map((p) => {
            const mine = p.id === s.plan;
            const free = p.cents.mois === 0;
            return (
              <Animated.View key={p.id} layout={LinearTransition}>
                <Tap
                  testID={`plan-${p.id}`}
                  onPress={() => (mine ? undefined : setChoice(p.id))}
                  disabled={mine}
                  scaleTo={0.99}
                  accessibilityLabel={`${p.name}, ${free ? 'gratuit' : `${price(p.cents[period])} par ${period}`}${mine ? ', ton offre actuelle' : ''}`}
                  style={{ borderRadius: 0, padding: 18, gap: 10, borderWidth: mine || p.flagged ? 1.5 : 1, borderColor: mine ? c.ink : p.flagged ? c.brass : c.rule }}
                >
                  <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View className="flex-row items-center" style={{ gap: 8 }}>
                        <T v="cardTitle">{p.name}</T>
                        {mine ? <Badge label="Ton offre" tone="positive" /> : p.flagged ? <Badge label="La plus choisie" tone="neutral" /> : null}
                      </View>
                      <T v="caption" tone="ink2">
                        {p.note}
                      </T>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T v="cardTitle">{free ? '0 €' : price(p.cents[period])}</T>
                      <T v="small" tone="ink2">
                        {free ? 'pour toujours' : period === 'mois' ? 'par mois' : `par an, soit ${price(Math.round(p.cents.an / 12))}/mois`}
                      </T>
                    </View>
                  </View>
                  <View style={{ gap: 6 }}>
                    {p.features.map((f) => (
                      <View key={f.label} className="flex-row items-center" style={{ gap: 8 }}>
                        <Icon name="check" size={16} color={f.soon ? c.ink2 : c.ink} strokeWidth={2} />
                        <T v="caption" tone={f.soon ? 'ink2' : 'ink'} style={{ flex: 1 }}>
                          {f.label}
                          {f.soon ? ' · bientôt' : ''}
                        </T>
                      </View>
                    ))}
                  </View>
                  {!mine && (
                    <T v="bodyStrong" style={{ marginTop: 2 }}>
                      {rank(p.id) > rank(s.plan) ? `Passer à ${p.name}` : `Revenir à ${p.name}`} →
                    </T>
                  )}
                </Tap>
              </Animated.View>
            );
          })}
        </View>

        <Button testID="offers-shop" label="Achats à l’unité : la boutique" variant="secondary" iconRight="chevron" onPress={() => nav.navigate('Shop')} />
        <T v="small" tone="ink2" style={{ textAlign: 'center' }}>
          Prix TTC. L’essai d’un mois s’applique à la première souscription annuelle.
        </T>
      </Animated.ScrollView>

      <Sheet
        visible={!!target}
        onClose={() => setChoice(null)}
        kicker={target && rank(target.id) > rank(s.plan) ? 'Passer à' : 'Revenir à'}
        title={target?.name ?? ''}
        testID="plan-confirm"
        footer={
          <Button
            testID="plan-pay"
            label={target?.cents.mois === 0 ? 'Confirmer' : period === 'an' && s.plan === 'decouverte' ? 'Commencer le mois offert' : `S’abonner · ${target ? price(target.cents[period]) : ''}`}
            icon={target?.cents.mois === 0 ? undefined : 'lock'}
            onPress={() => {
              if (target) a.setPlan(target.id, period);
              setChoice(null);
            }}
          />
        }
      >
        {target && (
          <View style={{ gap: 12 }}>
            {target.features.map((f) => (
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
              <T v="bodyStrong">{target.cents.mois === 0 ? '0 €' : `${price(target.cents[period])} TTC`}</T>
            </View>
            <T v="small" tone="ink2">
              {target.cents.mois === 0 ? 'Tes pièces au-delà de 30 restent visibles, mais tu ne pourras plus en ajouter.' : s.account === 'connecte' ? 'Paiement sécurisé par Stripe, dans ton navigateur. Résiliable à tout moment.' : 'Résiliable à tout moment. Aperçu : le paiement est simulé, rien n’est prélevé.'}
            </T>
          </View>
        )}
      </Sheet>
    </View>
  );
}
