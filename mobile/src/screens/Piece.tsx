import { useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CATEGORIES, MONTHS_SHORT, addedLabel, costPerWear, dayDate, forms, isNew, sinceLabel, type Piece as PieceT } from '../data/wardrobe';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { Glass } from '../ui/Glass';
import { motion, space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { IconButton } from '../ui/Button';
import { Button } from '../ui/Button';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { Bars, Card, DotChip, EmptyState, Row, Tag } from '../ui/bits';
import { Garment, hangOf } from '../ui/Garment';
import { Sheet } from '../ui/Sheet';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import { LabelEditor } from '../ui/LabelEditor';
import { FicheCard } from '../ui/FicheCard';
import { FieldSheet } from '../ui/FicheEditor';
import type { FieldId } from '../data/fiche';
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
  const [editing, setEditing] = useState(false);
  // La fiche : un champ seul, ou le pas à pas sur plusieurs champs.
  const [open, setOpen] = useState<{ ids: FieldId[]; i: number } | null>(null);
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
  // Seule une pièce découpée d'une photo du compte peut être reprise, deux fois au plus.
  const reportable = s.account === 'connecte' && !!piece.image && (piece.reports ?? 0) < 2;

  const stageH = Math.min(440, Math.round(width * 1.1));
  const art = Math.min(220, width * 0.56);
  const tag = wornToday ? `Porté${f.e} aujourd’hui` : piece.wears === 0 ? (isNew(piece) ? 'Nouveau' : `Jamais porté${f.e}`) : cat.short;
  const usage = [`${piece.wears} port${piece.wears > 1 ? 's' : ''}`, cpw ? `${cpw} par port` : null].filter(Boolean).join(' · ');

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-piece">
      <Ambient />
      <StackHeader title={piece.name} brand y={y} right={[{ icon: 'share', label: 'Partager à une amie', onPress: () => nav.navigate('Share', { id: piece.id }), testID: 'piece-share' }, { icon: 'more', label: 'Plus d’actions', onPress: () => setMenu(true), testID: 'piece-more' }]} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 18 }}>
        {/* La scène : la pièce sur gris studio, un panneau de verre posé dessus (05/10). */}
        <View style={{ height: stageH, borderRadius: 28, backgroundColor: c.stage, overflow: 'hidden', alignItems: 'center' }}>
          {hangOf(piece.kind) !== 'none' && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 22, height: 1.5, backgroundColor: c.rod }} />}
          <Animated.View ref={grow.ref} onLayout={grow.onLayout} style={[{ marginTop: 22 }, grow.style]}>
            <Garment kind={piece.kind} tint={piece.tint} image={piece.image} size={art} hanger={hangOf(piece.kind) !== 'none'} hangerColor={c.rod} dark={scheme === 'dark'} label={piece.name} />
          </Animated.View>
          <View style={{ position: 'absolute', left: 10, right: 10, bottom: 10 }}>
            <Glass radius={22} shadow={false}>
              <View className="flex-row items-end" style={{ padding: 16, gap: 12 }}>
                <View style={{ flex: 1, gap: 8 }}>
                  <Tag label={tag} tone="glass" />
                  <T v="title" accessibilityRole="header">
                    {piece.name}
                  </T>
                  <T v="kicker" tone={piece.wears === 0 && !isNew(piece) ? 'caution' : 'ink2'}>
                    {usage}
                  </T>
                </View>
                <IconButton testID="piece-compose" icon="chevron" label="Composer une tenue avec cette pièce" variant="solid" size={48} onPress={() => nav.navigate('Compose', { with: piece.id })} />
              </View>
            </Glass>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row flex-wrap" style={{ flex: 1, gap: 8 }}>
              <DotChip label={piece.color} swatch={piece.swatch} />
              <DotChip label={cat.short} />
              <DotChip label={cap(addedLabel(piece.addedDaysAgo))} />
            </View>
            <T testID="label-edit" v="label" tone="ink2" onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Modifier le nom, la catégorie, la couleur" suppressHighlighting style={{ paddingVertical: 12, paddingLeft: 16 }}>
              Modifier
            </T>
          </View>
        </View>

        <FicheCard piece={piece} onEdit={(id) => setOpen({ ids: [id], i: 0 })} onGuide={(ids) => setOpen({ ids, i: 0 })} />

        <Button
          testID="piece-coeur"
          label={s.coeurs.includes(piece.id) ? 'Dans mes choix' : 'Ajouter à mes choix'}
          icon="heart"
          variant={s.coeurs.includes(piece.id) ? 'primary' : 'secondary'}
          size="m"
          onPress={() => a.coeur(piece.id)}
        />
        <Button testID="piece-wear" label={wornToday ? `Porté${f.e} aujourd’hui` : `Je ${f.le} porte`} hint="Note un port aujourd’hui" disabled={wornToday} icon={wornToday ? 'check' : undefined} onPress={() => a.wear([piece.id], `C’est noté : ${piece.name.toLowerCase()} aujourd’hui`)} />

        {dormant && (
          <Card className="bg-butter" style={{ gap: 12, padding: 14 }}>
            <Tag label={piece.lastWorn === null ? `Jamais porté${f.e}` : `${f.il} ${f.v('dort', 'dorment')} depuis ${sinceLabel(piece).replace('il y a ', '')}`} tone="butter" />
            <View className="flex-row" style={{ gap: 8 }}>
              <Button testID="dormant-plan" label="Prévoir demain" size="m" grow onPress={() => nav.navigate('Compose', { with: piece.id, day: 1 })} />
              <Button label="À une amie" size="m" variant="secondary" grow onPress={() => nav.navigate('Share', { id: piece.id })} />
            </View>
          </Card>
        )}

        <Card style={{ gap: 12, padding: 14 }}>
          <Tag label="L’usage" />
          <View className="flex-row" style={{ gap: 10 }}>
            {[
              { v: String(piece.wears), l: piece.wears > 1 ? 'ports' : 'port' },
              { v: cpw ?? 'À venir', l: 'par port' },
              { v: piece.lastWorn === null ? 'Jamais' : piece.lastWorn === 0 ? 'Auj.' : `${piece.lastWorn} j`, l: 'depuis le dernier' },
            ].map((x) => (
              <View key={x.l} style={{ flex: 1, gap: 2 }}>
                <T v="stat" style={{ fontSize: 26, lineHeight: 30 }} numberOfLines={1} adjustsFontSizeToFit>
                  {x.v}
                </T>
                <T v="kicker" tone="ink2">
                  {x.l}
                </T>
              </View>
            ))}
          </View>
          <Bars values={values} labels={labels} />
        </Card>

        {goes.length > 0 && (
          <Card style={{ gap: 12, padding: 14 }}>
            <View className="flex-row items-center justify-between">
              <Tag label={`${f.il} ${f.v('va', 'vont')} avec`} />
              <T v="kicker" tone="ink2">
                {`${matches(piece, s.pieces).length} pièces`}
              </T>
            </View>
            <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -14 }} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
              {goes.map((g) => (
                <Tap key={g.id} testID={`goes-${g.id}`} onPress={() => nav.navigate('Compose', { pieces: [piece.id, g.id] })} accessibilityLabel={`Composer avec ${g.name}`} style={{ width: 96 }}>
                  <View className="bg-stage items-center justify-center" style={{ height: 112, borderRadius: 22 }}>
                    <Garment kind={g.kind} tint={g.tint} image={g.image} size={64} dark={scheme === 'dark'} label={g.name} />
                  </View>
                  <T v="small" style={{ marginTop: 5 }} numberOfLines={1}>
                    {g.name}
                  </T>
                </Tap>
              ))}
            </Animated.ScrollView>
          </Card>
        )}
      </Animated.ScrollView>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Cette pièce" testID="piece-menu">
        {/* La feuille du menu se referme d'abord : sur iPhone, deux modales ne s'ouvrent pas l'une sur l'autre. */}
        <Row icon="edit" title="Modifier le nom, la couleur" detail="Nom, catégorie, couleur" testID="piece-edit" onPress={() => { setMenu(false); setTimeout(() => setEditing(true), 380); }} />
        {reportable && (
          <Row icon="edit" title="Rendu incorrect" detail="Kodi reprend la découpe de cette pièce" testID="piece-report" onPress={() => { setMenu(false); void a.reportPiece(piece.id); }} />
        )}
        <Row icon="share" title="Prêter ou donner à une amie" onPress={() => { setMenu(false); nav.navigate('Share', { id: piece.id }); }} />
        <Row icon="trash" title="Retirer du dressing" detail="Tu pourras annuler juste après" last onPress={() => { setMenu(false); nav.goBack(); a.removePiece(piece.id); }} testID="piece-remove" />
      </Sheet>

      <FieldSheet
        piece={piece}
        field={open ? open.ids[open.i] : null}
        step={open && open.ids.length > 1 ? { n: open.i + 1, total: open.ids.length } : undefined}
        onClose={() => setOpen(null)}
        onSave={(p, next) => {
          a.updatePiece(p, true);
          // Pas à pas : le champ suivant s'ouvre tout de suite ; sinon la feuille se referme.
          setOpen((o) => (o && next && o.i + 1 < o.ids.length ? { ...o, i: o.i + 1 } : null));
        }}
        onSkip={() => setOpen((o) => (o && o.i + 1 < o.ids.length ? { ...o, i: o.i + 1 } : null))}
      />

      <LabelEditor piece={piece} visible={editing} onClose={() => setEditing(false)} onSave={(p) => { setEditing(false); a.updatePiece(p); }} />
    </View>
  );
}
