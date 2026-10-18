/**
 * Le bilan du dimanche (09/10) : ta semaine en tenues, sur le modèle d'une
 * page de magazine. Le titre dit combien de jours tu t'es habillée avec ton
 * dressing ; la bande des sept jours montre les couleurs portées ; puis tes
 * chiffres, ta pièce de la semaine, ce qui dort, ce que Kode a retenu de tes
 * « Pas pour moi » et la semaine qui vient. Une semaine vide se tourne vers
 * la suivante, sans reproche.
 */
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { DAYS_LETTER, MONTHS, type Piece } from '../data/wardrobe';
import { bilanDe, RETENU } from '../state/bilan';
import { dateOf, isoOf, offsetOf } from '../state/planning';
import { sleeping, useMeteo, useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { F } from '../theme/fonts';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { Card, Tag, WeatherIcon } from '../ui/bits';
import { Garment } from '../ui/Garment';
import { Ambient } from '../ui/Ambient';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import type { Nav } from '../navigation/types';

/** « du 6 au 12 octobre », « du 29 septembre au 5 octobre ». */
function span(debut: string, fin: string) {
  const a = dateOf(debut);
  const b = dateOf(fin);
  return a.getMonth() === b.getMonth() ? `du ${a.getDate()} au ${b.getDate()} ${MONTHS[b.getMonth()]}` : `du ${a.getDate()} ${MONTHS[a.getMonth()]} au ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

export function Bilan() {
  const { s } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const meteo = useMeteo();
  const b = bilanDe(s);
  const byId = new Map(s.pieces.map((p) => [p.id, p]));
  const fetiche = b.fetiche ? byId.get(b.fetiche.id) : undefined;
  const dorment = sleeping(s.pieces).slice(0, 3);
  const vide = b.habilles === 0;
  const today = isoOf(0);
  // La semaine qui vient, jour par jour : météo connue et rendez-vous.
  const suite = Array.from({ length: 7 }, (_, i) => i + 1).map((i) => ({ i, date: isoOf(i), w: meteo.jours[i] ?? null, rdv: s.events.filter((e) => e.date === isoOf(i)).length }));

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-bilan">
      <Ambient />
      <StackHeader title="Bilan" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top + 4, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <View style={{ gap: 8, paddingHorizontal: 4, paddingBottom: 6 }}>
          <T v="label" tone="ink2">{`Semaine ${span(b.debut, b.fin)}`}</T>
          <T v="hero" accessibilityRole="header" testID="bilan-title">
            {vide ? 'Ta semaine\nqui ' : 'Ta semaine,\nen '}
            <T v="hero" style={F.accent}>
              {vide ? 'vient' : `${b.habilles} tenue${b.habilles > 1 ? 's' : ''}`}
            </T>
            .
          </T>
          <T v="body" tone="ink2">
            {vide ? 'Pas de tenue notée cette semaine. Touche « Je la porte » le matin : Kode apprend de ce que tu portes vraiment.' : `${b.habilles} jour${b.habilles > 1 ? 's' : ''} sur 7 habillée avec ton dressing.`}
          </T>
        </View>

        {/* Les sept jours : les couleurs portées, de bas en haut ; aujourd'hui cerclé. */}
        <Card style={{ padding: 14, gap: 10 }} testID="bilan-week">
          <Tag label="Tes sept jours" />
          <View className="flex-row justify-between" accessibilityRole="summary">
            {b.jours.map((j) => {
              const d = dateOf(j.date);
              const tints = j.pieces.map((id) => byId.get(id)).filter(Boolean).map((p) => (p as Piece).tint ?? (p as Piece).swatch).slice(0, 5);
              const isToday = j.date === today;
              return (
                <View key={j.date} style={{ alignItems: 'center', gap: 6, width: 36 }} accessibilityLabel={`${DAYS_LETTER[d.getDay()]} ${d.getDate()} : ${j.pieces.length ? `${j.pieces.length} pièces portées` : j.futur ? 'à venir' : 'rien de noté'}`}>
                  <View style={{ width: 30, height: 74, borderRadius: 15, padding: 3, gap: 2, justifyContent: 'flex-end', backgroundColor: tints.length ? c.stage : 'transparent', borderWidth: 1, borderStyle: tints.length || j.futur ? 'solid' : 'dashed', borderColor: isToday ? c.ink : j.futur ? c['card-edge'] : c.rule, opacity: j.futur ? 0.5 : 1 }}>
                    {tints.map((t, k) => (
                      <View key={k} style={{ height: Math.max(8, 64 / Math.max(3, tints.length) - 2), borderRadius: 10, backgroundColor: t, borderWidth: 1, borderColor: c['card-edge'] }} />
                    ))}
                  </View>
                  <T v="small" tone={isToday ? 'ink' : 'ink2'} style={isToday ? F.s600 : undefined}>
                    {DAYS_LETTER[d.getDay()]}
                  </T>
                </View>
              );
            })}
          </View>
        </Card>

        {!vide && (
          <Card style={{ flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 6 }} testID="bilan-stats">
            {[
              { v: String(b.portees.length), l: b.portees.length > 1 ? 'pièces portées' : 'pièce portée' },
              { v: `${b.part} %`, l: 'du dressing' },
              { v: String(b.nouvelles), l: b.nouvelles > 1 ? 'nouvelles' : 'nouvelle' },
            ].map((x, i) => (
              <View key={x.l} className="items-center" style={{ flex: 1, gap: 2, borderLeftWidth: i ? 1 : 0, borderColor: c.rule }}>
                <T v="stat">{x.v}</T>
                <T v="small" tone="ink2">
                  {x.l}
                </T>
              </View>
            ))}
          </Card>
        )}

        {fetiche && b.fetiche && (
          <Tap testID="bilan-fetiche" onPress={() => nav.navigate('Piece', { id: fetiche.id })} scaleTo={0.99} accessibilityLabel={`Ta pièce de la semaine : ${fetiche.name}, portée ${b.fetiche.fois} fois`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 28, backgroundColor: c.card, borderWidth: 1, borderColor: c['card-edge'] }}>
            <View style={{ width: 84, height: 84, borderRadius: 20, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center' }}>
              <Garment kind={fetiche.kind} tint={fetiche.tint} image={fetiche.image} size={60} dark={scheme === 'dark'} label={fetiche.name} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Tag label="Ta pièce de la semaine" />
              <T v="body" style={[F.s600, { textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 13 }]} numberOfLines={2}>
                {fetiche.name}
              </T>
              <T v="caption" tone="ink2">{`Portée ${b.fetiche.fois} fois cette semaine`}</T>
            </View>
          </Tap>
        )}

        {/* Ce que Kode a retenu : la preuve que « Pas pour moi » sert à quelque chose. */}
        {b.ecartees > 0 && (
          <Card className="bg-butter" style={{ gap: 6 }} testID="bilan-kode">
            <T v="label" style={{ color: c['butter-ink'] }}>
              Kode a retenu
            </T>
            <T v="body" style={{ color: c['butter-ink'] }}>
              {`Tu as écarté ${b.ecartees} tenue${b.ecartees > 1 ? 's' : ''} cette semaine. ${b.raison && b.raison !== 'sans' ? `Kode te proposera ${RETENU[b.raison]}.` : 'Il ne te les proposera plus.'}`}
            </T>
          </Card>
        )}

        {dorment.length > 0 && (
          <Card style={{ padding: 14, gap: 12 }} testID="bilan-dorment">
            <View className="flex-row items-center justify-between">
              <Tag label="À ressortir" />
              <T v="small" tone="ink2">
                Elles dorment
              </T>
            </View>
            <View className="flex-row" style={{ gap: 8 }}>
              {dorment.map((p) => (
                <Tap key={p.id} testID={`bilan-dort-${p.id}`} onPress={() => nav.navigate('Piece', { id: p.id })} accessibilityLabel={`${p.name}, ${p.lastWorn === null ? 'jamais portée' : `portée il y a ${p.lastWorn} jours`}`} outerStyle={{ flex: 1 }} style={{ gap: 6 }}>
                  <View style={{ height: 96, borderRadius: 18, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center' }}>
                    <Garment kind={p.kind} tint={p.tint} image={p.image} size={60} dark={scheme === 'dark'} label={p.name} />
                  </View>
                  <T v="small" numberOfLines={1} style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 11 }}>
                    {p.name}
                  </T>
                  <T v="small" tone="ink2" numberOfLines={1}>
                    {p.lastWorn === null ? 'Jamais portée' : `Il y a ${p.lastWorn} j`}
                  </T>
                </Tap>
              ))}
            </View>
          </Card>
        )}

        {/* La semaine qui vient : la météo connue, les rendez-vous, et Kode qui prépare tout. */}
        <Card style={{ gap: 12 }} testID="bilan-suite">
          <Tag label="La semaine qui vient" />
          <View className="flex-row justify-between">
            {suite.map((d) => {
              const day = dateOf(d.date);
              return (
                <View key={d.date} style={{ alignItems: 'center', gap: 6, width: 36 }} accessibilityLabel={`${DAYS_LETTER[day.getDay()]} ${day.getDate()}${d.w ? `, ${d.w.t}°` : ''}${d.rdv ? `, ${d.rdv} rendez-vous` : ''}`}>
                  <T v="small" tone="ink2">
                    {DAYS_LETTER[day.getDay()]}
                  </T>
                  <View style={{ height: 22, justifyContent: 'center' }}>{d.w ? <WeatherIcon w={d.w} size={18} color={c.ink} /> : <T v="small" tone="ink2">·</T>}</View>
                  <T v="small" style={{ fontVariant: ['tabular-nums'] }}>
                    {d.w ? `${d.w.t}°` : ' '}
                  </T>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: d.rdv ? c.ink : 'transparent' }} />
                </View>
              );
            })}
          </View>
          <T v="caption" tone="ink2">
            {[
              b.aVenir.rdv ? `${b.aVenir.rdv} rendez-vous` : 'Aucun rendez-vous noté',
              b.aVenir.prevues ? `${b.aVenir.prevues} tenue${b.aVenir.prevues > 1 ? 's' : ''} déjà prévue${b.aVenir.prevues > 1 ? 's' : ''}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </T>
          <Button testID="bilan-plan" label="Préparer ma semaine avec Kode" icon="kode" size="m" onPress={() => nav.navigate('Planning', { choisir: true, date: isoOf(Math.max(1, offsetOf(b.fin) + 1)) })} />
        </Card>
      </Animated.ScrollView>
    </View>
  );
}
