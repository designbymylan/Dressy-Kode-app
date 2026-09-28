import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import Animated, { FadeIn, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CATEGORIES, COLOR_FAMILIES, familyOf, isNew, newLabel, wornLabel, type CategoryId, type Piece, type Season } from '../data/wardrobe';
import { pieceLimit, useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { motion, space, TAB_CLEARANCE } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap, haptic } from '../ui/Tap';
import { Button, IconButton } from '../ui/Button';
import { Chip, Segmented } from '../ui/controls';
import { Masthead, ScrollEdge, SectionHead, useTabScroll } from '../ui/layout';
import { EmptyState, PieceTile, measureOrigin, type Origin } from '../ui/bits';
import { Garment, hangOf } from '../ui/Garment';
import { FirstRail } from '../ui/onboarding';
import { Sheet } from '../ui/Sheet';
import { Icon } from '../ui/Icon';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import type { Nav, Route } from '../navigation/types';

type Usage = 'jamais' | 'oubliees' | null;
type Sort = 'recentes' | 'plus' | 'moins';
type Filters = { color: string | null; season: Season | null; usage: Usage; sort: Sort };
const NO_FILTERS: Filters = { color: null, season: null, usage: null, sort: 'recentes' };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function Dressing() {
  const { s } = useStore();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route<'Dressing'>>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const edge = useSharedValue(0);
  const onScroll = useTabScroll(edge);
  const { width } = useScreen();
  const [view, setView] = useState<'portants' | 'grille'>('portants');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const p = route.params;
    if (!p) return;
    if (p.view) setView(p.view);
    if (p.category !== undefined) setCategory(p.category);
  }, [route.params]);

  const limit = pieceLimit(s);
  const active = (filters.color ? 1 : 0) + (filters.season ? 1 : 0) + (filters.usage ? 1 : 0);

  const apply = (f: Filters, cat: CategoryId | null, q: string) => {
    let list = s.pieces.filter((p) => (!cat || p.category === cat) && (!f.color || familyOf(p.color) === f.color) && (!f.season || p.season === f.season));
    if (f.usage === 'jamais') list = list.filter((p) => p.wears === 0);
    if (f.usage === 'oubliees') list = list.filter((p) => p.lastWorn === null || p.lastWorn > 90);
    if (q.trim()) {
      const k = norm(q.trim());
      list = list.filter((p) => norm(`${p.name} ${p.color} ${p.material}`).includes(k));
    }
    if (f.sort === 'plus') list = [...list].sort((a, b) => b.wears - a.wears);
    if (f.sort === 'moins') list = [...list].sort((a, b) => a.wears - b.wears);
    if (f.sort === 'recentes') list = [...list].sort((a, b) => a.addedDaysAgo - b.addedDaysAgo);
    return list;
  };
  const list = useMemo(() => apply(filters, category, query), [s.pieces, filters, category, query]);
  const draftCount = useMemo(() => apply(draft, category, query).length, [s.pieces, draft, category, query]);
  // Les familles présentes dans le dressing, avec leur nombre de pièces.
  const colors = useMemo(
    () => COLOR_FAMILIES.map((f) => ({ ...f, count: s.pieces.filter((p) => familyOf(p.color) === f.name).length })).filter((f) => f.count > 0),
    [s.pieces],
  );

  const openFilters = () => {
    setDraft(filters);
    setSheet(true);
  };
  const reset = () => {
    setFilters(NO_FILTERS);
    setCategory(null);
    setQuery('');
  };

  const header = (
    <View style={{ gap: 12, paddingHorizontal: space.gutter }}>
      <Masthead kicker="LE DRESSING" meta={`${s.pieces.length} pièce${s.pieces.length > 1 ? 's' : ''}${limit === null ? '' : ` sur ${limit}`}`} />
      {searching ? (
        <Animated.View entering={FadeIn.duration(180)} className="flex-row items-center" style={{ gap: 10 }}>
          <View className="flex-row items-center bg-sunk" style={{ flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 14, gap: 8 }}>
            <Icon name="search" size={18} color={c.ink2} />
            <TextInput
              testID="search-input"
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Une pièce, une couleur, une matière"
              placeholderTextColor={c.ink2}
              returnKeyType="search"
              accessibilityLabel="Rechercher dans le dressing"
              style={{ flex: 1, color: c.ink, fontFamily: 'Sans400', fontSize: 16, height: 44 }}
            />
          </View>
          <T
            testID="search-cancel"
            v="bodyStrong"
            onPress={() => {
              setSearching(false);
              setQuery('');
            }}
            accessibilityRole="button"
            style={{ paddingVertical: 12 }}
          >
            Annuler
          </T>
        </Animated.View>
      ) : (
        <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
          <T v="title" accessibilityRole="header">
            {view === 'portants' ? 'Tes portants' : 'Toutes tes pièces'}
          </T>
          <View className="flex-row" style={{ gap: 8 }}>
            <IconButton
              testID="dressing-search"
              icon="search"
              label="Rechercher une pièce"
              onPress={() => {
                setSearching(true);
                setView('grille');
              }}
            />
            <IconButton testID="dressing-add" icon="plus" label="Ajouter une pièce" variant="solid" onPress={() => nav.navigate('AddPiece')} />
          </View>
        </View>
      )}
      <View className="flex-row items-center justify-between">
        <Segmented
          label="Vue du dressing"
          value={view}
          onChange={setView}
          options={[
            { value: 'portants', label: 'Portants' },
            { value: 'grille', label: 'Grille' },
          ]}
        />
        <Tap testID="open-filters" onPress={openFilters} accessibilityLabel={active ? `Filtres, ${active} actifs` : 'Filtres'} scaleTo={1} style={{ minHeight: 44, gap: 6 }} className="flex-row items-center">
          <Icon name="filter" size={18} color={c.ink} />
          <T v="bodyStrong" style={{ fontSize: 14.5, fontFamily: 'Sans500' }}>
            Filtres{active ? ` · ${active}` : ''}
          </T>
        </Tap>
      </View>
      {view === 'grille' && (
        <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
          <Chip label="Tout" on={!category} onPress={() => setCategory(null)} count={s.pieces.length} testID="cat-all" />
          {CATEGORIES.map((cat) => (
            <Chip key={cat.id} testID={`cat-${cat.id}`} label={cat.short} on={category === cat.id} onPress={() => setCategory(category === cat.id ? null : cat.id)} count={s.pieces.filter((p) => p.category === cat.id).length} />
          ))}
        </Animated.ScrollView>
      )}
    </View>
  );

  const filterSheet = (
    <Sheet
      visible={sheet}
      onClose={() => setSheet(false)}
      kicker="Affiner"
      title="Filtres"
      testID="filters-sheet"
      footer={
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Button label="Tout effacer" variant="plain" onPress={() => setDraft(NO_FILTERS)} />
          <Button
            testID="apply-filters"
            label={draftCount === 0 ? 'Aucune pièce' : `Voir ${draftCount} pièce${draftCount > 1 ? 's' : ''}`}
            grow
            disabled={draftCount === 0}
            onPress={() => {
              setFilters(draft);
              setView('grille');
              setSheet(false);
            }}
          />
        </View>
      }
    >
      <View style={{ gap: 20 }}>
        <View style={{ gap: 10 }}>
          <T v="kicker" tone="ink2" upper>
            Usage
          </T>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            <Chip label="Jamais portées" on={draft.usage === 'jamais'} onPress={() => setDraft({ ...draft, usage: draft.usage === 'jamais' ? null : 'jamais' })} testID="f-jamais" />
            <Chip label="Oubliées depuis 3 mois" on={draft.usage === 'oubliees'} onPress={() => setDraft({ ...draft, usage: draft.usage === 'oubliees' ? null : 'oubliees' })} />
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <T v="kicker" tone="ink2" upper>
            Couleur
          </T>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {colors.map((f) => (
              <Chip key={f.name} testID={`f-color-${f.name}`} label={f.name} dot={f.hex} count={f.count} on={draft.color === f.name} onPress={() => setDraft({ ...draft, color: draft.color === f.name ? null : f.name })} />
            ))}
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <T v="kicker" tone="ink2" upper>
            Saison
          </T>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {(['mi-saison', 'hiver', 'été', 'toute l’année'] as Season[]).map((x) => (
              <Chip key={x} label={x[0].toUpperCase() + x.slice(1)} on={draft.season === x} onPress={() => setDraft({ ...draft, season: draft.season === x ? null : x })} />
            ))}
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <T v="kicker" tone="ink2" upper>
            Trier
          </T>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {(
              [
                ['recentes', 'Ajoutées récemment'],
                ['plus', 'Les plus portées'],
                ['moins', 'Les moins portées'],
              ] as [Sort, string][]
            ).map(([v, l]) => (
              <Chip key={v} label={l} on={draft.sort === v} onPress={() => setDraft({ ...draft, sort: v })} />
            ))}
          </View>
        </View>
      </View>
    </Sheet>
  );

  if (view === 'grille') {
    const cols = s.density === 'dense' ? 3 : 2;
    const gap = s.density === 'dense' ? 10 : 14;
    const tileW = (width - space.gutter * 2 - gap * (cols - 1)) / cols;
    return (
      <View className="bg-paper" style={{ flex: 1 }} testID="screen-dressing-grid">
      <Ambient />
        <ScrollEdge y={edge} />
        <Animated.FlatList
          key={cols}
          data={list}
          numColumns={cols}
          keyExtractor={(p) => p.id}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: TAB_CLEARANCE + insets.bottom, gap: 18 }}
          columnWrapperStyle={{ gap, paddingHorizontal: space.gutter }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            s.pieces.length === 0 ? (
              <View style={{ paddingHorizontal: space.gutter }}>
                <EmptyWardrobe />
              </View>
            ) : (
            <EmptyState
              art={<Garment kind="pull" size={84} tint={c.sunk} />}
              title="Rien ne correspond"
              body={query ? `Aucune pièce ne contient « ${query} ». Tu pourrais essayer une couleur ou une matière.` : 'Tu pourrais retirer un filtre pour élargir.'}
              action={<Button testID="clear-filters" label="Tout afficher" variant="secondary" size="m" onPress={reset} />}
            />
            )
          }
          renderItem={({ item }) => <PieceTile piece={item} width={tileW} dense={s.density === 'dense'} onPress={(from) => nav.navigate('Piece', { id: item.id, from })} />}
        />
        {filterSheet}
      </View>
    );
  }

  const byCat = CATEGORIES.map((cat) => ({ cat, pieces: list.filter((p) => p.category === cat.id) })).filter((x) => x.pieces.length);
  return (
    <View className="bg-paper" style={{ flex: 1 }}>
      <Ambient />
      <ScrollEdge y={edge} />
      <Animated.ScrollView testID="screen-dressing" onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: TAB_CLEARANCE + insets.bottom, gap: 22 }}>
        {header}
        {s.pieces.length === 0 ? (
          <View style={{ paddingHorizontal: space.gutter }}>
            <EmptyWardrobe />
          </View>
        ) : (
          byCat.length === 0 && <EmptyState title="Rien ne correspond" body="Tu pourrais retirer un filtre pour élargir." action={<Button label="Tout afficher" variant="secondary" size="m" onPress={reset} />} />
        )}
        {byCat.map(({ cat, pieces }, i) => (
          <View key={cat.id} style={{ gap: 4 }} accessibilityLabel={cat.title}>
            <View style={{ paddingHorizontal: space.gutter }}>
              <SectionHead
                n={String(i + 1).padStart(2, '0')}
                title={cat.title}
                action={`${pieces.length} pièce${pieces.length > 1 ? 's' : ''}`}
                testID={`rail-${cat.id}-all`}
                onAction={() => {
                  setCategory(cat.id);
                  setView('grille');
                }}
              />
            </View>
            <Rail pieces={pieces} shelf={cat.id === 'chaussures' || cat.id === 'accessoires'} onPiece={(p, from) => nav.navigate('Piece', { id: p.id, from })} />
          </View>
        ))}
      </Animated.ScrollView>
      {filterSheet}
    </View>
  );
}

/** Un dressing vide : le portant attend, et on dit par quoi commencer. */
function EmptyWardrobe() {
  const nav = useNavigation<Nav>();
  const { c } = useTheme();
  return (
    <View style={{ gap: 16 }} testID="dressing-empty">
      <View style={{ marginHorizontal: -space.gutter }}>
        <FirstRail pieces={[]} slots={5} size={70} />
      </View>
      <T v="section">Tes portants sont vides.</T>
      <T v="body" tone="ink2">
        Commence par ce que tu portes le plus : ton jean, un haut, tes baskets. Chaque photo devient une illustration rangée ici, par catégorie.
      </T>
      <Button testID="dressing-empty-add" label="Ajouter ma première pièce" icon="plus" onPress={() => nav.navigate('AddPiece')} />
      <View style={{ gap: 0 }}>
        {CATEGORIES.map((cat, i) => (
          <View key={cat.id} className="flex-row items-center" style={{ minHeight: 46, gap: 12, borderBottomWidth: i === CATEGORIES.length - 1 ? 0 : 1, borderColor: c.rule }}>
            <T v="numeral" tone="brass" style={{ fontSize: 16, width: 24 }}>
              {String(i + 1).padStart(2, '0')}
            </T>
            <T v="body" style={{ flex: 1 }}>
              {cat.title}
            </T>
            <T v="caption" tone="ink2">
              vide
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

const ITEM = 92;

/**
 * Un portant : la tringle reste fixe, les pièces glissent dessous et se
 * balancent un instant quand on les pousse, comme de vrais cintres.
 * Chaussures et sacs sont posés sur une étagère, sans balancement.
 */
function Rail({ pieces, shelf, onPiece }: { pieces: Piece[]; shelf: boolean; onPiece: (p: Piece, from?: Origin) => void }) {
  const { c, scheme } = useTheme();
  const { s, a } = useStore();
  const fresh = new Set(s.fresh);
  let order = 0;
  const swing = useSharedValue(0);
  const lastX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const dx = e.contentOffset.x - lastX.value;
      lastX.value = e.contentOffset.x;
      if (shelf) return;
      const target = Math.max(-9, Math.min(9, -dx * 0.9));
      swing.value = withSequence(withSpring(target, { damping: 14, stiffness: 160 }), withSpring(0, motion.swing));
    },
  });
  return (
    <View style={{ height: shelf ? 150 : 172 }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: shelf ? 104 : 2, height: shelf ? 2 : 1.5, backgroundColor: c.rod, opacity: shelf ? 0.5 : 1 }} />
      <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16} decelerationRate="fast" snapToInterval={ITEM + 16} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 16 }}>
        {pieces.map((p, i) => (
          <Hanging
            key={p.id}
            piece={p}
            index={i}
            swing={swing}
            shelf={shelf}
            dark={scheme === 'dark'}
            rod={c.rod}
            arriving={fresh.has(p.id) ? order++ : null}
            onLanded={() => a.landed(p.id)}
            onPress={(from) => onPiece(p, from)}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

/**
 * Une pièce sur son cintre. `arriving` (son rang parmi les nouvelles) : elle
 * vient d'arriver, elle tombe sur la tringle et se balance un instant, avec
 * une vibration légère, une seule fois.
 */
function Hanging({
  piece, index, swing, shelf, dark, rod, arriving, onLanded, onPress,
}: {
  piece: Piece; index: number; swing: SharedValue<number>; shelf: boolean; dark: boolean; rod: string;
  arriving: number | null; onLanded: () => void; onPress: (from?: Origin) => void;
}) {
  const art = useRef<View>(null);
  const reduced = useReducedMotion();
  const k = 0.8 + (index % 3) * 0.15;
  const drop = useSharedValue(arriving !== null && !reduced ? 1 : 0);
  const sway = useSharedValue(0);
  useEffect(() => {
    if (arriving === null) return;
    if (reduced) return onLanded();
    const wait = 200 + arriving * 140;
    drop.value = withDelay(wait, withSpring(0, { damping: 15, stiffness: 190 }));
    if (!shelf) sway.value = withDelay(wait + 220, withSequence(withSpring(9, { damping: 12, stiffness: 220 }), withSpring(0, motion.swing)));
    const buzz = setTimeout(() => arriving === 0 && haptic('light'), wait + 240);
    const done = setTimeout(onLanded, wait + 1600);
    return () => {
      clearTimeout(buzz);
      clearTimeout(done);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => ({
    opacity: 1 - drop.value,
    transform: [{ translateY: -90 * drop.value }, { rotate: `${swing.value * k + sway.value}deg` }],
  }));
  const hangs = hangOf(piece.kind) !== 'none';
  return (
    <Tap testID={`rail-piece-${piece.id}`} onPress={() => measureOrigin(art.current, onPress)} accessibilityLabel={`${piece.name}, ${wornLabel(piece)}`} accessibilityHint="Ouvre la fiche" style={{ width: ITEM, alignItems: 'center', gap: 2 }} scaleTo={0.96}>
      <Animated.View style={[{ height: shelf ? 110 : 118, justifyContent: shelf ? 'flex-end' : 'flex-start', transformOrigin: 'top' }, style]}>
        <View ref={art}>
          <Garment kind={piece.kind} tint={piece.tint} image={piece.image} size={shelf ? 84 : ITEM} hanger={hangs && !shelf} hangerColor={rod} dark={dark} label={piece.name} />
        </View>
      </Animated.View>
      <T v="caption" style={{ fontFamily: 'Sans500', textAlign: 'center' }} numberOfLines={1}>
        {piece.name}
      </T>
      <T v="small" tone={piece.wears === 0 && !isNew(piece) ? 'caution' : 'ink2'} numberOfLines={1}>
        {isNew(piece) ? newLabel(piece)[0].toUpperCase() + newLabel(piece).slice(1) : wornLabel(piece)}
      </T>
    </Tap>
  );
}
