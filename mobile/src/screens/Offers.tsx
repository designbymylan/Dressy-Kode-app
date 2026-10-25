/**
 * Les offres (09/10), copie de la maquette validée, elle-même tirée de la
 * page d'abonnement envoyée par l'utilisatrice : la remise en grand, la
 * phrase forte, ce qui est inclus en deux cartes, le choix au mois ou à
 * l'année, trois lignes à cocher avec le prix barré, la réassurance qui
 * défile et le bouton noir en bas. Ni patch ni faux avis. Découverte, l'offre
 * gratuite, se retrouve par un lien discret en bas de page.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { euros } from '../data/wardrobe';
import { useStore, type Period, type PlanId } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/controls';
import { Icon, type IconName } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Ambient } from '../ui/Ambient';
import { ScrollEdge, useHeaderScroll } from '../ui/layout';
import { BottomFade, CloseButton, FeatureCard, Fold, Promise, RadioRow, Reassure, Scribble } from '../ui/shop';
import type { Nav } from '../navigation/types';

type Feature = { label: string; note: string; icon: IconName; soon?: boolean };

/**
 * Mêmes montants et mêmes limites que web/src/lib/plans.ts (offres du
 * 21/10) : Fashion (`capsule`) et Sapologue (`atelier`). Couture n'est plus
 * vendue ; un abonnement qui l'aurait encore garde ses droits.
 */
export const PLANS: { id: PlanId; name: string; note: string; cents: Record<Period, number>; features: Feature[]; flagged?: boolean }[] = [
  { id: 'decouverte', name: 'Découverte', note: 'Pour essayer, sans carte', cents: { mois: 0, an: 0 }, features: [{ label: 'Jusqu’à 30 pièces', note: 'De quoi commencer ton dressing.', icon: 'hanger' }, { label: '5 questions à Kodi par mois', note: 'Une tenue quand tu hésites.', icon: 'kode' }] },
  { id: 'capsule', name: 'Fashion', note: 'Ton dressing rangé, et enfin porté', cents: { mois: 699, an: 5999 }, features: [{ label: 'Jusqu’à 120 pièces', note: 'Ton quotidien, rangé et détouré.', icon: 'hanger' }, { label: '30 questions à Kodi par mois', note: 'Pour les jours où tu hésites.', icon: 'kode' }, { label: 'Tenue du jour et agenda', note: 'Kodi prépare ta semaine avec la météo.', icon: 'calendar' }, { label: 'Suivi de ta garde-robe', note: 'Ce que tu portes vraiment, pièce par pièce.', icon: 'chart' }] },
  { id: 'atelier', name: 'Sapologue', note: 'Kodi devient ton styliste personnel', cents: { mois: 1499, an: 12999 }, flagged: true, features: [{ label: 'Pièces illimitées', note: 'Tout ton dressing, rangé et détouré par Kodi.', icon: 'hanger' }, { label: 'Kodi sans limite', note: 'Une tenue pour chaque jour, sans compter tes questions.', icon: 'kode' }, { label: 'Tenues d’occasion et valise de voyage', note: 'Kodi prépare la tenue et la valise.', icon: 'suitcase' }, { label: 'Audit de garde-robe chaque trimestre', note: 'Doublons, oublis et manques.', icon: 'layers', soon: true }] },
];

export const price = (cents: number) => euros(cents / 100);

/** Ce que l'année fait gagner sur douze mois, arrondi vers le bas pour ne jamais promettre plus. */
export const saving = (p: (typeof PLANS)[number]) => (p.cents.mois ? Math.floor(((p.cents.mois * 12 - p.cents.an) / (p.cents.mois * 12)) * 100) : 0);
export const bestSaving = () => Math.max(...PLANS.map(saving));
/** Le plus petit prix à la semaine, sur l'année, arrondi vers le haut. */
const fromWeekly = () => Math.min(...PLANS.filter((p) => p.cents.an > 0).map((p) => Math.ceil(p.cents.an / 52)));

const PAID = PLANS.filter((p) => p.cents.mois > 0);

export function Offers() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { y, onScroll } = useHeaderScroll();
  const { c } = useTheme();
  const [period, setPeriod] = useState<Period>('an');
  const [choice, setChoice] = useState<PlanId | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [all, setAll] = useState(false);
  // Couture, qui n'est plus vendue, compte comme l'offre du dessus.
  const rank = (id: PlanId) => (id === 'couture' ? PLANS.length : PLANS.findIndex((p) => p.id === id));
  const flagged = PLANS.find((p) => p.flagged)!;
  // Sans choix : l'offre recommandée pour qui est en dessous, sinon l'offre du dessus.
  const fallback = rank(s.plan) < rank(flagged.id) ? flagged.id : PAID.find((p) => rank(p.id) > rank(s.plan))?.id ?? null;
  const pick = choice ?? fallback;
  const picked = PLANS.find((p) => p.id === pick);
  const shown = picked ?? PLANS.find((p) => p.id === s.plan) ?? flagged;
  const year = period === 'an';
  // Le mois offert vaut pour une première souscription annuelle (web/src/lib/plans.ts).
  const firstYear = s.plan === 'decouverte';

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-offers">
      <Ambient />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: insets.top + 50, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 120, gap: 12 }}>
        <Scribble />
        <Promise
          testID="offers-discount"
          title={`−${bestSaving()} %\nsur l’année`}
          lead={`Dès ${price(fromWeekly())} par semaine`}
          note={firstYear ? 'L’année au meilleur prix, et le premier mois offert.' : 'L’année au meilleur prix, et tu arrêtes quand tu veux.'}
        />

        <Fold label="Ce qui est inclus" open={all} onPress={() => setAll(!all)} />
        <View className="flex-row flex-wrap" style={{ gap: 10 }} testID="offers-included">
          {(all ? shown.features : shown.features.slice(0, 2)).map((f) => (
            <FeatureCard key={f.label} icon={f.icon} title={f.label} note={f.soon ? `${f.note} Bientôt.` : f.note} />
          ))}
        </View>

        <View className="items-center" style={{ paddingTop: 4 }}>
          <Segmented
            label="Période de paiement"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'mois', label: 'Au mois' },
              { value: 'an', label: 'À l’année' },
            ]}
          />
        </View>

        <View accessibilityRole="radiogroup" accessibilityLabel="Offres" style={{ gap: 8 }}>
          {PAID.map((p) => (
            <RadioRow
              key={p.id}
              testID={`plan-${p.id}`}
              name={p.name}
              note={p.note}
              price={year ? `${price(p.cents.an)} /an` : `${price(p.cents.mois)} /mois`}
              struck={year ? price(p.cents.mois * 12) : undefined}
              on={p.id === pick}
              mine={p.id === s.plan}
              onPress={() => setChoice(p.id)}
            />
          ))}
        </View>

        <Reassure
          items={[
            { icon: 'check', text: 'Sans engagement. Tu arrêtes en un geste, depuis Réglages.' },
            { icon: 'lock', text: firstYear ? 'Paiement sécurisé, et ton premier mois offert sur l’année.' : 'Paiement sécurisé, dans ton navigateur.' },
          ]}
        />

        <View className="flex-row justify-center" style={{ gap: 18, paddingTop: 4 }}>
          <T testID="offers-shop" v="label" tone="ink2" onPress={() => nav.navigate('Shop')} accessibilityRole="link" suppressHighlighting style={{ paddingVertical: 12 }}>
            La boutique
          </T>
          {s.plan !== 'decouverte' && (
            <T
              testID="plan-decouverte"
              v="label"
              tone="ink2"
              onPress={() => {
                setChoice('decouverte');
                setConfirm(true);
              }}
              accessibilityRole="link"
              suppressHighlighting
              style={{ paddingVertical: 12 }}
            >
              Revenir à Découverte
            </T>
          )}
        </View>
        <T v="small" tone="ink2" style={{ textAlign: 'center' }}>
          Prix TTC. Le mois offert vaut pour la première souscription annuelle.
        </T>
      </Animated.ScrollView>

      <ScrollEdge y={y} />
      <CloseButton />
      <BottomFade />
      {picked && picked.cents.mois > 0 && (
        <View style={{ position: 'absolute', left: space.gutter, right: space.gutter, bottom: insets.bottom + 16 }}>
          <Button testID="offers-cta" label={`${rank(picked.id) > rank(s.plan) ? 'Passer à' : 'Revenir à'} ${picked.name} · ${price(picked.cents[period])}`} onPress={() => setConfirm(true)} />
        </View>
      )}

      <Sheet
        visible={confirm && !!picked}
        onClose={() => {
          setConfirm(false);
          if (choice === 'decouverte') setChoice(null);
        }}
        kicker={picked && rank(picked.id) > rank(s.plan) ? 'Passer à' : 'Revenir à'}
        title={picked?.name ?? ''}
        testID="plan-confirm"
        footer={
          <Button
            testID="plan-pay"
            label={picked?.cents.mois === 0 ? 'Confirmer' : year && firstYear ? 'Commencer le mois offert' : `S’abonner · ${picked ? price(picked.cents[period]) : ''}`}
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
              {picked.cents.mois === 0 ? 'Tes pièces au-delà de 30 restent visibles, mais tu ne pourras plus en ajouter.' : s.account === 'connecte' ? 'Paiement sécurisé, dans ton navigateur. Résiliable à tout moment.' : 'Résiliable à tout moment. Aperçu : le paiement est simulé, rien n’est prélevé.'}
            </T>
          </View>
        )}
      </Sheet>
    </View>
  );
}
