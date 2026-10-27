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
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { euros } from '../data/wardrobe';
import { useStore, type Period, type PlanId } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Button } from '../ui/Button';
import { Icon, type IconName } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Ambient } from '../ui/Ambient';
import { ScrollEdge, useHeaderScroll } from '../ui/layout';
import { CloseButton, SlideChoice } from '../ui/shop';
import { Tag } from '../ui/bits';
import { F } from '../theme/fonts';
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
  const { c, scheme } = useTheme();
  const [period, setPeriod] = useState<Period>('an');
  const [choice, setChoice] = useState<PlanId | null>(null);
  const [confirm, setConfirm] = useState(false);
  // Couture, qui n'est plus vendue, compte comme l'offre du dessus.
  const rank = (id: PlanId) => (id === 'couture' ? PLANS.length : PLANS.findIndex((p) => p.id === id));
  const flagged = PLANS.find((p) => p.flagged)!;
  // Sans choix : l'offre recommandée pour qui est en dessous, sinon l'offre du dessus.
  const fallback = rank(s.plan) < rank(flagged.id) ? flagged.id : PAID.find((p) => rank(p.id) > rank(s.plan))?.id ?? null;
  const pick = fallback;
  const picked = PLANS.find((p) => p.id === (choice ?? pick));
  const year = period === 'an';
  // Le mois offert vaut pour une première souscription annuelle (web/src/lib/plans.ts).
  const firstYear = s.plan === 'decouverte';

  // Ce que montre la page : l'offre payante choisie (Revenir à Découverte ne change pas la vue).
  const view = PAID.find((p) => p.id === (choice && choice !== 'decouverte' ? choice : pick)) ?? flagged;
  const mine = view.id === s.plan;
  const perMonth = year ? Math.round(view.cents.an / 12) : view.cents.mois;

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-offers">
      <Ambient />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: insets.top + 56, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 120, gap: 18 }}>
        <T v="title" accessibilityRole="header" testID="offers-title" style={{ textAlign: 'center', paddingHorizontal: 40 }}>
          {`Passe à ${view.name}`}
        </T>

        <SlideChoice
          testID="offers-plans"
          label="Offre"
          value={view.id}
          onChange={setChoice}
          options={PAID.map((p) => ({
            value: p.id,
            a11y: `${p.name}${p.id === s.plan ? ', ton offre actuelle' : ''}`,
            testID: `plan-${p.id}`,
            node: (on) => (
              <T v="body" style={{ ...F.s600, color: on ? c.ink : c.ink2 }}>
                {p.name}
              </T>
            ),
          }))}
        />

        <Animated.View key={view.id} entering={FadeIn.duration(280)} testID="offers-included" style={{ paddingHorizontal: 16, paddingVertical: 4, borderRadius: 28, backgroundColor: c.card, borderWidth: 1, borderColor: c['card-edge'] }}>
          {view.features.map((f, i) => (
            <View key={f.label} className="flex-row items-center" style={{ gap: 14, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderColor: c.rule }}>
              <Icon name={f.icon} size={22} color={c.ink} strokeWidth={1.7} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="body" style={{ ...F.s600, fontSize: 14, lineHeight: 18 }}>
                  {f.label}
                  {f.soon ? ' · bientôt' : ''}
                </T>
                <T v="small" tone="ink2">
                  {f.note}
                </T>
              </View>
              <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.ink }}>
                <Icon name="check" size={13} color={c.paper} strokeWidth={2.6} flat />
              </View>
            </View>
          ))}
        </Animated.View>

        <SlideChoice
          tray
          testID="offers-period"
          label="Durée"
          value={period}
          onChange={setPeriod}
          options={(['an', 'mois'] as const).map((p) => ({
            value: p,
            a11y: `${p === 'an' ? 'Annuel' : 'Mensuel'}, ${price(view.cents[p])}`,
            testID: `period-${p}`,
            node: (on) => (
              <>
                <T v="small" style={{ color: on ? c.ink : c.ink2 }}>
                  {p === 'an' ? 'Annuel' : 'Mensuel'}
                </T>
                <Animated.View key={`${view.id}${p}`} entering={FadeIn.duration(260)}>
                  <T v="stat" style={{ color: on ? c.ink : c.ink2 }}>
                    {price(view.cents[p])}
                  </T>
                </Animated.View>
                <T v="small" style={{ color: on ? c.ink : c.ink2 }}>
                  {`${price(p === 'an' ? Math.round(view.cents.an / 12) : view.cents.mois)} par mois`}
                </T>
              </>
            ),
          }))}
        />

        <T v="body" style={{ textAlign: 'center' }}>
          <T v="bodyStrong">{`${price(perMonth)} par mois`}</T>
          {year ? ', facturé une fois par an.' : ', facturé chaque mois.'}
        </T>
        <T v="small" tone="ink2" style={{ textAlign: 'center', marginTop: -8 }}>
          {`${year && firstYear ? 'Premier mois offert. ' : ''}Sans engagement, tu arrêtes en un geste depuis Réglages. Prix TTC, paiement sécurisé.`}
        </T>

        {mine ? (
          <View className="items-center">
            <Tag label="C’est ton offre" />
          </View>
        ) : (
          <Button
            testID="offers-cta"
            variant={scheme === 'dark' ? 'primary' : 'dark'}
            label={`${rank(view.id) > rank(s.plan) ? 'Choisir' : 'Revenir à'} ${view.name} ${year ? 'Annuel' : 'Mensuel'}`}
            onPress={() => {
              setChoice(view.id);
              setConfirm(true);
            }}
          />
        )}

        <View className="flex-row justify-center" style={{ gap: 18 }}>
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
      </Animated.ScrollView>

      <ScrollEdge y={y} />
      <CloseButton />

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
