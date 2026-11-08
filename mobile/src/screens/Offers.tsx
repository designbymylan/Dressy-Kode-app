/**
 * Les offres (09/10), d'après la page d'abonnement envoyée par l'utilisateur :
 * le nom de la formule en grand, ce qui est inclus, le prix et le bouton noir
 * fixé en bas. Refonte du 08/11 sur ses trois modèles : l'annuel est revenu
 * avec 30 % de remise, choisi par un interrupteur (prix par mois barré,
 * total de l'année dit en toutes lettres) ; un seul dégradé, le bleu. Pas de
 * faux avis. Découverte, l'offre gratuite, se retrouve par un lien discret
 * en bas de page.
 */
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { CONDITIONS_URL } from '../data/legal';
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
import { BottomFade, CloseButton, PageGlow, PeriodSwitch, SlideChoice } from '../ui/shop';
import { Struck } from '../ui/bits';
import { Accord } from '../ui/Accord';
import { F } from '../theme/fonts';
import type { Nav } from '../navigation/types';

type Feature = { label: string; note: string; icon: IconName; soon?: boolean };

/**
 * Mêmes montants et mêmes limites que web/src/lib/plans.ts (brief v6, et
 * l'annuel du 08/11) : Fashion (`capsule`) et Sapologue (`atelier`). Couture
 * n'est plus vendue ; un abonnement qui l'aurait encore garde ses droits.
 */
export const PLANS: { id: PlanId; name: string; note: string; cents: { mois: number; an: number }; features: Feature[]; flagged?: boolean }[] = [
  { id: 'decouverte', name: 'Découverte', note: 'Pour essayer, sans carte', cents: { mois: 0, an: 0 }, features: [{ label: 'Jusqu’à 15 pièces', note: 'De quoi commencer ton dressing.', icon: 'hanger' }, { label: '4 générations offertes', note: 'Pour voir Kodi dessiner tes pièces.', icon: 'image' }, { label: '5 questions à Kodi par mois', note: 'Une tenue quand tu hésites.', icon: 'kode' }] },
  { id: 'capsule', name: 'Fashion', note: 'Ton dressing rangé, et enfin porté', cents: { mois: 899, an: 7500 }, features: [{ label: 'Jusqu’à 50 pièces', note: 'Ton quotidien, rangé et détouré.', icon: 'hanger' }, { label: '50 générations par mois', note: 'Des images propres, remises à zéro chaque mois.', icon: 'image' }, { label: '30 questions à Kodi par mois', note: 'Pour les jours où tu hésites.', icon: 'kode' }, { label: 'Tenue du jour et agenda', note: 'Kodi prépare ta semaine avec la météo.', icon: 'calendar' }] },
  { id: 'atelier', name: 'Sapologue', note: 'Kodi devient ton styliste personnel', cents: { mois: 1899, an: 15900 }, flagged: true, features: [{ label: 'Jusqu’à 100 pièces', note: 'Tout ton dressing, rangé et détouré par Kodi.', icon: 'hanger' }, { label: '100 générations par mois', note: 'Des images propres, remises à zéro chaque mois.', icon: 'image' }, { label: 'Kodi sans limite', note: 'Une tenue pour chaque jour, sans compter tes questions.', icon: 'kode' }, { label: 'Tenues d’occasion et valise de voyage', note: 'Kodi prépare la tenue et la valise.', icon: 'suitcase' }, { label: 'Audit de garde-robe chaque trimestre', note: 'Doublons, oublis et manques.', icon: 'layers', soon: true }] },
];

export const price = (cents: number) => euros(cents / 100);

/** La remise de l'année sur douze mois, arrondie vers le bas (899 et 7500 : 30 %). Même calcul que web/src/lib/plans.ts. */
export const annualOff = (p: { cents: { mois: number; an: number } }) => Math.floor((1 - p.cents.an / (p.cents.mois * 12)) * 100);
/** Le prix de l'année ramené au mois, au centime supérieur. */
export const perMonth = (cents: number) => Math.ceil(cents / 12);

const PAID = PLANS.filter((p) => p.cents.mois > 0);

export function Offers() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { y, onScroll } = useHeaderScroll();
  const { c, scheme } = useTheme();
  const [choice, setChoice] = useState<PlanId | null>(null);
  const [confirm, setConfirm] = useState(false);
  // La case du début immédiat (08/11) : sans elle, pas de paiement d'un abonnement.
  const [accept, setAccept] = useState(false);
  // Un abonné retrouve sa formule ; les autres arrivent sur l'annuel, le moins cher des deux.
  const subscribed = s.plan !== 'decouverte' && !s.creator;
  const [period, setPeriod] = useState<Period>(subscribed ? s.period : 'an');
  const annual = period === 'an';
  // Couture, qui n'est plus vendue, compte comme l'offre du dessus.
  const rank = (id: PlanId) => (id === 'couture' ? PLANS.length : PLANS.findIndex((p) => p.id === id));
  const flagged = PLANS.find((p) => p.flagged)!;
  // Sans choix : l'offre recommandée pour qui est en dessous, sinon l'offre du dessus.
  const fallback = rank(s.plan) < rank(flagged.id) ? flagged.id : PAID.find((p) => rank(p.id) > rank(s.plan))?.id ?? null;
  const pick = fallback;
  const picked = PLANS.find((p) => p.id === (choice ?? pick));

  // Ce que montre la page : l'offre payante choisie (Revenir à Découverte ne change pas la vue).
  const view = PAID.find((p) => p.id === (choice && choice !== 'decouverte' ? choice : pick)) ?? flagged;
  // Sa formule exacte : même offre et même période. Même offre, autre période : on peut changer.
  const sameOffer = view.id === s.plan;
  const mine = sameOffer && period === s.period;
  const off = annualOff(view);
  const shown = annual ? perMonth(view.cents.an) : view.cents.mois;
  const ctaLabel = sameOffer ? (annual ? 'Passer à l’annuel' : 'Passer au mensuel') : `${rank(view.id) > rank(s.plan) ? 'Choisir' : 'Revenir à'} ${view.name}`;

  // Le paiement d'une offre gratuite ne dépend pas de la période.
  const free = picked?.cents.mois === 0;
  const amount = picked ? (free ? 0 : picked.cents[period]) : 0;

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-offers">
      <Ambient />
      <PageGlow height={insets.top + 380} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: insets.top + 56, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 150, gap: 16 }}>
        <View style={{ alignItems: 'center', gap: 6, paddingHorizontal: 24 }}>
          <T v="label" tone="ink2">
            Passe à
          </T>
          <T v="title" accessibilityRole="header" accessibilityLabel={`Passe à ${view.name}`} testID="offers-title" style={{ fontSize: 40, lineHeight: 44, letterSpacing: -0.8, textAlign: 'center' }}>
            {view.name}
          </T>
          <T v="small" tone="ink2" style={{ textAlign: 'center' }}>
            {view.note}
          </T>
        </View>

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

        <View testID="offers-price" style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 28, backgroundColor: c.card, borderWidth: 1, borderColor: c['card-edge'] }}>
          <PeriodSwitch testID="offers-period" annual={annual} onChange={(on) => setPeriod(on ? 'an' : 'mois')} off={off} />
          <View style={{ height: 1, backgroundColor: c.rule }} />
          <Animated.View
            key={`${view.id}-${period}`}
            entering={FadeIn.duration(220)}
            accessible
            accessibilityLabel={annual ? `${price(shown)} par mois, facturé ${price(view.cents.an)} par an, au lieu de ${price(view.cents.mois)} par mois` : `${price(view.cents.mois)} par mois, facturé chaque mois`}
            style={{ paddingVertical: 14, gap: 4 }}
          >
            <View className="flex-row items-end" style={{ gap: 8 }}>
              <T v="stat" style={{ fontSize: 34, lineHeight: 38 }}>
                {price(shown)}
              </T>
              <T v="body" tone="ink2" style={{ paddingBottom: 5 }}>
                par mois
              </T>
              {annual && (
                <View style={{ paddingBottom: 7 }}>
                  <Struck label={price(view.cents.mois)} />
                </View>
              )}
            </View>
            <T v="small" tone="ink2">
              {annual ? `Facturé ${price(view.cents.an)} par an, soit ${off} % de moins que douze mois.` : 'Facturé chaque mois.'}
            </T>
          </Animated.View>
          <T v="small" tone="ink2" style={{ paddingBottom: 12 }}>
            Sans engagement : tu résilies depuis Réglages, Mon abonnement. Prix TTC, paiement sécurisé.
          </T>
        </View>

        <Animated.View key={view.id} entering={FadeIn.duration(280)} testID="offers-included" style={{ paddingHorizontal: 16, paddingVertical: 4, borderRadius: 28, backgroundColor: c.card, borderWidth: 1, borderColor: c['card-edge'] }}>
          {view.features.map((f, i) => (
            <View key={f.label} className="flex-row items-center" style={{ gap: 14, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderColor: c.rule }}>
              <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.stage }}>
                <Icon name={f.icon} size={24} color={c.ink} strokeWidth={1.8} />
              </View>
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

      {/* Le bouton reste en bas : on s'abonne sans chercher, la page passe dessous. */}
      <BottomFade height={Math.round((insets.bottom + 72) / 0.45)} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 12, alignItems: 'stretch' }}>
        {mine ? (
          <Button testID="offers-mine" variant="secondary" icon="check" label="C’est ton offre" disabled onPress={() => undefined} />
        ) : (
          <Button
            testID="offers-cta"
            variant={scheme === 'dark' ? 'primary' : 'dark'}
            label={ctaLabel}
            onPress={() => {
              setChoice(view.id);
              setConfirm(true);
            }}
          />
        )}
      </View>

      <ScrollEdge y={y} />
      <CloseButton />

      <Sheet
        visible={confirm && !!picked}
        onClose={() => {
          setConfirm(false);
          setAccept(false);
          if (choice === 'decouverte') setChoice(null);
        }}
        kicker={picked && (rank(picked.id) > rank(s.plan) || picked.id === s.plan) ? 'Passer à' : 'Revenir à'}
        title={picked?.name ?? ''}
        testID="plan-confirm"
        footer={
          <Button
            testID="plan-pay"
            label={free ? 'Confirmer' : `S’abonner · ${price(amount)}`}
            icon={free ? undefined : 'lock'}
            disabled={!!picked && !free && !accept}
            onPress={() => {
              if (picked) a.setPlan(picked.id, free ? 'mois' : period);
              setConfirm(false);
              setAccept(false);
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
              <T v="bodyStrong">{free ? 'Chaque mois' : annual ? 'Chaque année' : 'Chaque mois'}</T>
              <T v="bodyStrong">{free ? '0 €' : `${price(amount)} TTC`}</T>
            </View>
            <T v="small" tone="ink2">
              {free
                ? 'Tes pièces au-delà de 15 restent visibles, mais tu ne pourras plus en ajouter.'
                : s.account === 'connecte'
                  ? `${annual ? 'Prélevé une fois par an, renouvelé chaque année. ' : ''}Paiement sécurisé, dans ton navigateur. Résiliable à tout moment, 14 jours pour te rétracter.`
                  : 'Résiliable à tout moment. Aperçu : le paiement est simulé, rien n’est prélevé.'}
            </T>
            {!free && (
              <>
                <Accord testID="plan-accept" checked={accept} onChange={setAccept}>
                  Je demande que mon offre commence tout de suite. Si je me rétracte dans les 14 jours, je ne paie que le temps déjà écoulé.
                </Accord>
                <T testID="offers-conditions" v="small" tone="ink2" onPress={() => Linking.openURL(CONDITIONS_URL)} accessibilityRole="link" suppressHighlighting style={{ textDecorationLine: 'underline', paddingVertical: 6 }}>
                  Conditions générales
                </T>
              </>
            )}
          </View>
        )}
      </Sheet>
    </View>
  );
}
