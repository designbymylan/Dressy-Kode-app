import { useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CATEGORIES, MONTHS_SHORT, costPerWear, dayDate, forms, isNew, sinceLabel, wornLabel, type Piece as PieceT } from '../data/wardrobe';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { motion, space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Button } from '../ui/Button';
import { StackHeader, useHeaderScroll, useStackTop, Rule } from '../ui/layout';
import { Bars, Card, EmptyState, Row } from '../ui/bits';
import { Garment, hangOf } from '../ui/Garment';
import { Sheet } from '../ui/Sheet';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import type { Nav, Route } from '../navigation/types';

/** Ce qui va avec une pièce : une règle simple et lisible, pas une boîte noire. */
function matches(p: PieceT, all: PieceT[]) {
  const complement: Record<string, string[]> = {
    manteaux: ['hauts', 'bas', 'robes'],
    hauts: ['bas', 'manteaux'],
    bas: ['hauts', 'manteaux', 'chaussures'],
    robes: ['manteaux', 'chaussures', 'accessoires'],
    chaussures: ['bas', 'robes'],
    accessoires: ['robes', 'manteaux'],
  };
  return all.filter((q) => q.id !== p.id && complement[p.category].includes(q.category));
}

/** Ports des six derniers mois, dérivés des compteurs (données de démonstration). */
function history(p: PieceT) {
  const now = dayDate(0);
  const labels = Array.from({ length: 6 }, (_, i) => MONTHS_SHORT[(now.getMonth() - 5 + i + 12) % 12].replace('.', ''));
  const seed = p.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const per = p.wears / 12;
  const values = labels.map((_, i) => {
    const monthAgo = 5 - i;
    if (p.lastWorn === null || p.lastWorn > (monthAgo + 1) * 30 + 30) return 0;
    return Math.max(0, Math.round(per * (0.6 + ((seed * (i + 3)) % 9) / 10)));
  });
  if (p.lastWorn !== null && p.lastWorn <= 30) values[5] = Math.max(1, values[5]);
  return { labels, values };
}

/**
 * La vignette qui s'ouvre : la pièce de la fiche part de la place et de la
 * taille de la vignette touchée, puis grandit jusqu'à la sienne. L'œil ne
 * perd jamais la pièce. Sans vignette d'origine (lien, tenue), rien ne bouge.
 */
function useGrowFrom(from?: { x: number; y: number; w: number; h: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<View>(null);
  const armed = useRef(Boolean(from) && !reduced);
  const k = useSharedValue(armed.current ? 0 : 1);
  // Cachée tant qu'elle n'est pas mesurée : pas d'éclair à sa place finale.
  const shown = useSharedValue(armed.current ? 0 : 1);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const sc = useSharedValue(1);
  const onLayout = () => {
    if (!armed.current || !from) return;
    armed.current = false;
    ref.current?.measureInWindow((x, y, w, h) => {
      shown.value = 1;
      if (!w || !h) {
        k.value = 1;
        return;
      }
      dx.value = from.x + from.w / 2 - (x + w / 2);
      dy.value = from.y + from.h / 2 - (y + h / 2);
      sc.value = Math.min(from.w / w, from.h / h);
      k.value = withSpring(1, motion.gentle);
    });
  };
  const style = useAnimatedStyle(() => {
    const t = k.value;
    return {
      opacity: shown.value,
      transform: [{ translateX: dx.value * (1 - t) }, { translateY: dy.value * (1 - t) }, { scale: sc.value + (1 - sc.value) * t }],
    };
  });
  return { ref, onLayout, style };
}

export function PieceScreen() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route<'Piece'>>();
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useScreen();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const [menu, setMenu] = useState(false);
  const piece = s.pieces.find((p) => p.id === params.id);
  const grow = useGrowFrom(params.from);

  if (!piece) {
    return (
      <View className="bg-paper" style={{ flex: 1, paddingTop: top }}>
      <Ambient />
        <StackHeader title="Pièce" />
        <EmptyState title="Cette pièce n’est plus là" body="Elle a été retirée du dressing." action={<Button label="Retour au dressing" variant="secondary" onPress={() => nav.goBack()} />} />
      </View>
    );
  }

  const cat = CATEGORIES.find((x) => x.id === piece.category)!;
  const cpw = costPerWear(piece);
  const f = forms(piece);
  const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
  const dormant = !isNew(piece) && (piece.lastWorn === null || piece.lastWorn > 60);
  const goes = matches(piece, s.pieces).sort((x, z) => z.wears - x.wears).slice(0, 6);
  const { labels, values } = history(piece);
  const wornToday = piece.lastWorn === 0;

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-piece">
      <Ambient />
      <StackHeader title={piece.name} y={y} right={[{ icon: 'share', label: 'Partager à une amie', onPress: () => nav.navigate('Share', { id: piece.id }), testID: 'piece-share' }, { icon: 'more', label: 'Plus d’actions', onPress: () => setMenu(true), testID: 'piece-more' }]} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View className="bg-stage items-center justify-end" style={{ height: top + 300, paddingBottom: 18 }}>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: top + 6, height: 1.5, backgroundColor: hangOf(piece.kind) === 'none' ? 'transparent' : c.rod }} />
          <Animated.View ref={grow.ref} onLayout={grow.onLayout} style={grow.style}>
            <Garment kind={piece.kind} tint={piece.tint} image={piece.image} size={Math.min(236, width * 0.6)} hanger={hangOf(piece.kind) !== 'none'} hangerColor={c.rod} dark={scheme === 'dark'} label={piece.name} />
          </Animated.View>
        </View>

        <View style={{ paddingHorizontal: space.gutter, paddingTop: 20, gap: 22 }}>
          <View style={{ gap: 6 }}>
            <T v="kicker" tone="ink2" upper>
              {cat.title}
            </T>
            <T v="title" accessibilityRole="header">
              {piece.name}
            </T>
            <T v="body" tone={piece.wears === 0 && !isNew(piece) ? 'caution' : 'ink2'}>
              {wornLabel(piece)}
              {piece.lastWorn !== null && piece.lastWorn > 0 ? ` · dernière fois ${sinceLabel(piece)}` : ''}
            </T>
          </View>

          <View className="flex-row" style={{ gap: 8 }}>
            <Button testID="piece-wear" label={wornToday ? `Porté${f.e} aujourd’hui` : `${cap(f.le)} porter aujourd’hui`} grow disabled={wornToday} icon={wornToday ? 'check' : undefined} onPress={() => a.wear([piece.id], `C’est noté : ${piece.name.toLowerCase()} aujourd’hui`)} />
            <Button testID="piece-compose" label="Composer avec" variant="secondary" icon="layers" grow onPress={() => nav.navigate('Compose', { with: piece.id })} />
          </View>

          {dormant && (
            <Card className="bg-butter" style={{ gap: 10 }}>
              <T v="cardTitle">
                {piece.lastWorn === null ? `Jamais porté${f.e}, pour l’instant.` : `${f.il} ${f.v('dort', 'dorment')} depuis ${sinceLabel(piece).replace('il y a ', '')}.`}
              </T>
              <T v="body" tone="ink2">
                {`Tu pourrais ${f.le} remettre en jeu demain, ou ${f.le} proposer à une amie qui ${f.le} portera.`}
              </T>
              <View className="flex-row" style={{ gap: 8 }}>
                <Button testID="dormant-plan" label="Prévoir demain" size="m" grow onPress={() => nav.navigate('Compose', { with: piece.id, day: 1 })} />
                <Button label="À une amie" size="m" variant="secondary" grow onPress={() => nav.navigate('Share', { id: piece.id })} />
              </View>
            </Card>
          )}

          <View style={{ gap: 12 }}>
            <T v="kicker" tone="ink2" upper>
              L’étiquette
            </T>
            {/* Une fiche de galerie : des rangées entre deux filets. */}
            <View>
              <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.rule }}>
                {[
                  ['Couleur', piece.color],
                  ['Matière', piece.material],
                  ['Saison', piece.season[0].toUpperCase() + piece.season.slice(1)],
                  ['Prix', piece.price ? `${piece.price} €` : 'Non indiqué'],
                  ['Dans ton dressing', `depuis ${Math.max(1, Math.round(piece.addedDaysAgo / 30))} mois`],
                ].map(([k, v], i, arr) => (
                  <View key={k} className="flex-row items-center justify-between" style={{ minHeight: 46, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderColor: c.rule, gap: 12 }}>
                    <T v="caption" tone="ink2">
                      {k}
                    </T>
                    <View className="flex-row items-center" style={{ gap: 8, flexShrink: 1 }}>
                      {k === 'Couleur' && <View style={{ width: 14, height: 14, borderRadius: 0, backgroundColor: piece.swatch, borderWidth: 1, borderColor: c.rule }} />}
                      <T v="bodyStrong" numberOfLines={1}>
                        {v}
                      </T>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <T v="kicker" tone="ink2" upper>
              L’usage
            </T>
            <View className="flex-row" style={{ gap: 10 }}>
              {[
                { v: String(piece.wears), l: piece.wears > 1 ? 'ports' : 'port' },
                { v: cpw ?? 'À venir', l: 'par port' },
                { v: piece.lastWorn === null ? 'Jamais' : piece.lastWorn === 0 ? 'Auj.' : `${piece.lastWorn} j`, l: 'depuis le dernier' },
              ].map((x) => (
                <View key={x.l} style={{ flex: 1, gap: 2 }}>
                  <T v="cardTitle" style={{ fontSize: 26, lineHeight: 30 }} numberOfLines={1} adjustsFontSizeToFit>
                    {x.v}
                  </T>
                  <T v="small" tone="ink2">
                    {x.l}
                  </T>
                </View>
              ))}
            </View>
            <Bars values={values} labels={labels} />
            {cpw && piece.price && (
              <T v="caption" tone="ink2">
                Chaque port fait baisser son coût : à {piece.wears + 5} ports, {f.il.toLowerCase()} ne te {f.v('coûtera', 'coûteront')} plus que {(piece.price / (piece.wears + 5)).toFixed(2).replace('.', ',')} € la sortie.
              </T>
            )}
          </View>

          <View style={{ gap: 12 }}>
            <Rule />
            <View className="flex-row items-baseline justify-between">
              <T v="section">{`${f.il} ${f.v('va', 'vont')} avec`}</T>
              <T v="caption" tone="ink2">
                {matches(piece, s.pieces).length} pièces
              </T>
            </View>
            <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
              {goes.map((g) => (
                <Tap key={g.id} testID={`goes-${g.id}`} onPress={() => nav.navigate('Compose', { pieces: [piece.id, g.id] })} accessibilityLabel={`Composer avec ${g.name}`} style={{ width: 96 }}>
                  <View className="bg-stage items-center justify-center" style={{ height: 112, borderRadius: 0 }}>
                    <Garment kind={g.kind} tint={g.tint} image={g.image} size={64} dark={scheme === 'dark'} label={g.name} />
                  </View>
                  <T v="small" style={{ marginTop: 5 }} numberOfLines={1}>
                    {g.name}
                  </T>
                </Tap>
              ))}
            </Animated.ScrollView>
          </View>
        </View>
      </Animated.ScrollView>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Cette pièce" testID="piece-menu">
        <Row icon="edit" title="Modifier l’étiquette" detail="Nom, couleur, matière, prix" onPress={() => { setMenu(false); a.toast('La modification arrive bientôt'); }} />
        <Row icon="share" title="Prêter ou donner à une amie" onPress={() => { setMenu(false); nav.navigate('Share', { id: piece.id }); }} />
        <Row icon="trash" title="Retirer du dressing" detail="Tu pourras annuler juste après" last onPress={() => { setMenu(false); nav.goBack(); a.removePiece(piece.id); }} testID="piece-remove" />
      </Sheet>
    </View>
  );
}
