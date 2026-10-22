/**
 * Les offres : la page d'abonnement du 09/10 (la remise en grand, la phrase
 * forte, le choix au mois ou à l'année, les lignes à cocher avec le prix
 * barré, la réassurance, le bouton en bas), avec les deux offres du 21/10,
 * Fashion et Sapologue, comparées comme sur le web (« App design price »,
 * web/src/components/Pricing.tsx) : un tableau à deux colonnes, l'offre
 * choisie en bleu. Ni patch ni faux avis. Découverte, l'offre gratuite, se
 * retrouve par un lien discret en bas de page.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { euros } from '../data/wardrobe';
import { useStore, type Period, type PlanId } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { material, space } from '../theme/tokens';
import { T } from '../ui/T';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/controls';
import { Icon, type IconName } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Ambient } from '../ui/Ambient';
import { ScrollEdge, useHeaderScroll } from '../ui/layout';
import { BottomFade, CloseButton, Promise, RadioRow, Reassure, Scribble } from '../ui/shop';
import { Tap } from '../ui/Tap';
import { BlueGlass } from '../ui/Glass';
import { F } from '../theme/fonts';
import type { Nav } from '../navigation/types';

type Feature = { label: string; note: string; icon: IconName; soon?: boolean };

type Plan = { id: PlanId; name: string; note: string; cents: Record<Period, number>; features: Feature[]; flagged?: boolean };

/**
 * Mêmes montants et mêmes limites que web/src/lib/plans.ts (source unique
 * côté serveur, 21/10). Les identifiants vivent en base et chez Stripe :
 * `capsule` porte Fashion, `atelier` porte Sapologue.
 */
export const PLANS: Plan[] = [
  { id: 'decouverte', name: 'Découverte', note: 'Pour essayer, sans carte', cents: { mois: 0, an: 0 }, features: [{ label: 'Jusqu’à 30 pièces', note: 'De quoi commencer ton dressing.', icon: 'hanger' }, { label: '5 questions à Kodi par mois', note: 'Une tenue quand tu hésites.', icon: 'kode' }] },
  { id: 'capsule', name: 'Fashion', note: '120 pièces · 30 questions par mois', cents: { mois: 699, an: 5999 }, features: [{ label: 'Jusqu’à 120 pièces', note: 'Ton quotidien, rangé et détouré.', icon: 'hanger' }, { label: '30 questions à Kodi par mois', note: 'Pour les jours où tu hésites.', icon: 'kode' }, { label: 'Tenue du jour et agenda', note: 'Kodi prépare ta semaine avec la météo.', icon: 'calendar' }, { label: 'Suivi de ta garde-robe', note: 'Ce que tu portes vraiment, en un coup d’œil.', icon: 'chart' }] },
  { id: 'atelier', name: 'Sapologue', note: 'Pièces illimitées · Kodi sans limite', cents: { mois: 1499, an: 12999 }, flagged: true, features: [{ label: 'Pièces illimitées', note: 'Tout ton dressing, rangé et détouré par Kodi.', icon: 'hanger' }, { label: 'Kodi sans limite', note: 'Une tenue pour chaque jour, sans compter tes questions.', icon: 'kode' }, { label: 'Tenues d’occasion et valise de voyage', note: 'Kodi prépare la tenue et la valise.', icon: 'party' }, { label: 'Audit de garde-robe chaque trimestre', note: 'Doublons, oublis et manques.', icon: 'layers', soon: true }] },
];

/** L'offre d'un compte, y compris celle qui n'est plus vendue (un ancien abonnement Couture). */
export const planOf = (id: PlanId): Plan => PLANS.find((p) => p.id === id) ?? { id, name: id === 'couture' ? 'Couture' : 'Découverte', note: '', cents: { mois: 0, an: 0 }, features: [] };

/** Le tableau de comparaison (web : COMPARE), une ligne par promesse, cochée ou non pour chaque offre. */
const COMPARE: { icon: IconName; title: string; sub: string; capsule: boolean; atelier: boolean; soon?: boolean }[] = [
  { icon: 'hanger', title: 'Dressing numérique', sub: '120 pièces avec Fashion', capsule: true, atelier: true },
  { icon: 'kode', title: 'Kodi, ton styliste', sub: '30 questions par mois avec Fashion', capsule: true, atelier: true },
  { icon: 'cloud', title: 'Tenue du jour', sub: 'Selon la météo et ton agenda', capsule: true, atelier: true },
  { icon: 'chart', title: 'Suivi de ta garde-robe', sub: 'Pièces portées, barre de progression', capsule: true, atelier: true },
  { icon: 'infinity', title: 'Sans limite', sub: 'Pièces et questions à Kodi', capsule: false, atelier: true },
  { icon: 'party', title: 'Occasions et voyages', sub: 'Kodi prépare la tenue et la valise', capsule: false, atelier: true },
  { icon: 'layers', title: 'Audit de garde-robe', sub: 'Doublons, oublis et manques, chaque trimestre', capsule: false, atelier: true, soon: true },
];

export const price = (cents: number) => euros(cents / 100);

/** Ce que l'année fait gagner sur douze mois, arrondi vers le bas pour ne jamais promettre plus. */
export const saving = (p: Plan) => (p.cents.mois ? Math.floor(((p.cents.mois * 12 - p.cents.an) / (p.cents.mois * 12)) * 100) : 0);
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
  const rank = (id: PlanId) => PLANS.findIndex((p) => p.id === id);
  const flagged = PLANS.find((p) => p.flagged)!;
  // Sans choix : l'offre recommandée pour qui est en dessous, sinon l'offre du dessus.
  const fallback = rank(s.plan) < rank(flagged.id) ? flagged.id : PAID.find((p) => rank(p.id) > rank(s.plan))?.id ?? null;
  const pick = choice ?? fallback;
  const picked = PLANS.find((p) => p.id === pick);
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

        <Compare pick={pick} onPick={setChoice} all={all} onMore={() => setAll(!all)} />

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
            { icon: 'bag', text: 'Plutôt à l’unité ? Les packs commencent à 0,99 €.' },
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

const COLS = { width: 76, alignItems: 'center' as const, justifyContent: 'center' as const };

/**
 * Fashion ou Sapologue, côte à côte (21/10) : les deux noms en tête de
 * colonne se touchent, la colonne choisie passe en bleu.
 */
function Compare({ pick, onPick, all, onMore }: { pick: PlanId | null; onPick: (id: PlanId) => void; all: boolean; onMore: () => void }) {
  const { c, scheme } = useTheme();
  const paid = PLANS.filter((p) => p.cents.mois > 0);
  const rows = all ? COMPARE : COMPARE.slice(0, 5);
  return (
    <View testID="offers-compare" style={{ borderRadius: 28, padding: 14, gap: 14, backgroundColor: c['blue-soft'], borderWidth: 1, borderColor: c['card-edge'] }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Choisis ton offre" className="flex-row items-center">
        <T v="small" tone="ink2" style={{ flex: 1 }}>
          Choisis ton offre
        </T>
        {paid.map((p) => {
          const on = p.id === pick;
          return (
            <View key={p.id} style={COLS}>
              <Tap
                testID={`compare-${p.id}`}
                onPress={() => onPick(p.id)}
                feedback="select"
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={p.name}
                hitSlop={6}
                style={[{ height: 32, paddingHorizontal: 10, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, on ? { backgroundColor: c.blue, borderColor: 'transparent', ...material.blue[scheme] } : { backgroundColor: c['glass-strong'], borderColor: c['glass-border'] }]}
              >
                {on && <BlueGlass radius={16} />}
                <T v="small" tone={on ? 'on-blue' : 'ink'} style={[on ? F.s600 : F.s500, { fontSize: 12.5 }]} numberOfLines={1}>
                  {p.name}
                </T>
              </Tap>
            </View>
          );
        })}
      </View>
      {rows.map((f) => (
        <View key={f.title} className="flex-row items-center">
          <View className="flex-row items-center" style={{ flex: 1, gap: 10, minWidth: 0 }}>
            <Icon name={f.icon} size={20} color={c.ink} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="caption" style={F.s600}>
                {f.title}
                {f.soon ? <T v="caption" tone="ink2"> · bientôt</T> : null}
              </T>
              <T v="small" tone="ink2">
                {f.sub}
              </T>
            </View>
          </View>
          {paid.map((p) => {
            const has = f[p.id as 'capsule' | 'atelier'];
            const lit = p.id === pick;
            return (
              <View key={p.id} style={COLS} accessible accessibilityLabel={`${has ? 'Inclus' : 'Pas'} dans ${p.name}`}>
                <Icon name={has ? 'checkCircle' : 'xCircle'} size={22} color={has ? (lit ? c['blue-ink'] : c.ink2) : c.rule} />
              </View>
            );
          })}
        </View>
      ))}
      <T testID="offers-more" v="label" tone="ink2" onPress={onMore} accessibilityRole="button" suppressHighlighting style={{ alignSelf: 'center', paddingVertical: 4 }}>
        {all ? 'Moins' : 'Tout comparer'}
      </T>
    </View>
  );
}
