import { useEffect, useRef, useState } from 'react';
import { TextInput, View, type ViewInstance } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CATEGORIES, MONTHS_SHORT, addedLabel, costPerWear, dayDate, forms, isNew, sinceLabel, wornLabel, type Piece as PieceT } from '../data/wardrobe';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { motion, space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { IconButton } from '../ui/Button';
import { Button } from '../ui/Button';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { Bars, Card, EmptyState, Row, Tag } from '../ui/bits';
import { Icon } from '../ui/Icon';
import { F } from '../theme/fonts';
import { Garment, hangOf } from '../ui/Garment';
import { HeartButton } from '../ui/Heart';
import { Sheet } from '../ui/Sheet';
import { useScreen } from '../ui/screen';
import { Ambient } from '../ui/Ambient';
import { LabelEditor } from '../ui/LabelEditor';
import { RatingSheet } from '../ui/Rating';
import { moyenne } from '../state/notes';
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

/**
 * Ports des six derniers mois, mois par mois. Un vrai dressing les lit dans
 * son journal (« Je la porte », table `wears`) : aucun chiffre inventé. Seul
 * le compte de démonstration, sans journal, les dérive de ses compteurs.
 */
function history(p: PieceT, journal: Record<string, string[]>, demo: boolean) {
  const now = dayDate(0);
  const labels = Array.from({ length: 6 }, (_, i) => MONTHS_SHORT[(now.getMonth() - 5 + i + 12) % 12].replace('.', ''));
  if (!demo) {
    const values = labels.map(() => 0);
    for (const [iso, ids] of Object.entries(journal)) {
      if (!ids.includes(p.id)) continue;
      const [y, m] = iso.split('-').map(Number);
      const back = (now.getFullYear() - y) * 12 + now.getMonth() - (m - 1);
      if (back >= 0 && back < 6) values[5 - back] += 1;
    }
    return { labels, values };
  }
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
  const ref = useRef<ViewInstance>(null);
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

/**
 * Un texte de la fiche qu'on corrige sur place (22/11) : le nom, la marque. Un
 * toucher l'ouvre, « OK » ou la sortie du champ l'enregistre. Vide, la marque
 * propose de l'ajouter ; le nom, lui, ne se vide pas.
 */
function InlineEdit({ value, empty, kind, max, required, onSave, testID }: { value: string; empty: string; kind: 'name' | 'brand'; max: number; required?: boolean; onSave: (v: string) => void; testID?: string }) {
  const { c } = useTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => {
    if (!editing) setText(value);
  }, [value, editing]);
  const commit = () => {
    setEditing(false);
    const v = text.trim();
    if (v === value || (required && !v)) return setText(value);
    onSave(v);
  };
  const name = kind === 'name';
  if (editing)
    return (
      <TextInput
        testID={`${testID}-input`}
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        autoFocus
        selectTextOnFocus
        maxLength={max}
        returnKeyType="done"
        autoCapitalize={name ? 'sentences' : 'words'}
        placeholder={name ? 'Nom de la pièce' : 'Marque'}
        placeholderTextColor={c.ink2}
        accessibilityLabel={name ? 'Nom de la pièce' : 'Marque de la pièce'}
        style={{ color: c.ink, paddingVertical: 4, borderBottomWidth: 1.5, borderColor: c.ink, ...(name ? { ...F.display, fontSize: 26 } : { ...F.s500, fontSize: 14 }) }}
      />
    );
  const filled = value.length > 0;
  return (
    <Tap testID={testID} onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel={filled ? `${name ? 'Nom' : 'Marque'} : ${value}. Modifier` : empty} hitSlop={6} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: name ? 36 : 22 }}>
      {name ? (
        <T v="title" accessibilityRole="header" style={{ flexShrink: 1 }}>
          {value}
        </T>
      ) : (
        <T v="label" tone={filled ? 'ink' : 'ink2'} numberOfLines={1} style={{ flexShrink: 1 }}>
          {filled ? value : empty}
        </T>
      )}
      <Icon name={filled || name ? 'edit' : 'plus'} size={name ? 16 : 13} color={c.ink2} strokeWidth={2} />
    </Tap>
  );
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
  const [rating, setRating] = useState(false);
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
  const { labels, values } = history(piece, s.journal, s.account === 'demo');
  const wornToday = piece.lastWorn === 0;
  const liked = s.coeurs.includes(piece.id);
  // Le dessin se note : connecté, seulement une pièce que Kodi a dessinée d'une photo ; la démonstration le simule.
  const ratable = s.account !== 'connecte' || !!piece.image;
  // « Image propre » (le mode Studio, revenu le 20/11) : la pièce arrive découpée dans sa photo ; Kodi la
  // redessine sur fond net à la demande, une génération. Connecté, seule une pièce venue d'une photo.
  const cleanable = s.account !== 'connecte' || !!piece.image;
  const left = s.gen;
  const free = s.plan === 'decouverte';
  const noGen = left !== null && left <= 0;
  const note = s.notes[piece.id] ?? null;

  // La scène ne porte que la pièce, la plus grande possible ; le panneau d'infos est dessous (18/11).
  const art = Math.min(280, Math.round(width * 0.7));
  const stageH = Math.round(art * 1.25) + 44;
  const tag = wornToday ? `Porté${f.e} aujourd’hui` : piece.wears === 0 ? (isNew(piece) ? 'Nouveau' : `Jamais porté${f.e}`) : cat.short;
  const usage = [`${piece.wears} port${piece.wears > 1 ? 's' : ''}`, cpw ? `${cpw} par port` : null].filter(Boolean).join(' · ');
  const priceTxt = piece.price != null ? `${piece.price.toFixed(2).replace('.', ',').replace(',00', '')} €` : null;
  // Ce que la fiche dit de la pièce : une case par caractéristique, « Ajouter » quand elle manque.
  const specs: { label: string; value: string | null; swatch?: string }[] = [
    { label: 'Catégorie', value: cat.short },
    { label: 'Couleur', value: piece.color || null, swatch: piece.swatch },
    { label: 'Matière', value: piece.material ? cap(piece.material) : null },
    { label: 'Taille', value: piece.size ?? null },
    { label: 'Coupe', value: piece.fit ? cap(piece.fit) : null },
    { label: 'Saison', value: cap(piece.season) },
    { label: 'Prix d’achat', value: priceTxt },
    { label: 'Au dressing', value: cap(addedLabel(piece.addedDaysAgo)) },
  ];

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-piece">
      <Ambient />
      <StackHeader title={piece.name} brand y={y} right={[{ icon: 'more', label: 'Plus d’actions', onPress: () => setMenu(true), testID: 'piece-more' }]} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 18 }}>
        {/* La scène : la pièce seule sur gris studio ; le panneau de verre est posé dessous (18/11, il cachait la pièce). */}
        <View style={{ height: stageH, borderRadius: 28, backgroundColor: c.stage, overflow: 'hidden', alignItems: 'center' }}>
          {hangOf(piece.kind) !== 'none' && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 22, height: 1.5, backgroundColor: c.rod }} />}
          <Animated.View ref={grow.ref} onLayout={grow.onLayout} style={[{ marginTop: 22 }, grow.style]}>
            <Garment kind={piece.kind} tint={piece.tint} image={piece.image} size={art} hanger={hangOf(piece.kind) !== 'none'} hangerColor={c.rod} dark={scheme === 'dark'} label={piece.name} />
          </Animated.View>
        </View>

        {/* La carte d'identité de la pièce (22/11) : état et gestes, marque, nom qu'on corrige d'un toucher, puis ses caractéristiques rangées en grille. */}
        <Card style={{ padding: 18, gap: 14 }} testID="piece-id">
          <View className="flex-row items-center justify-between">
            <Tag label={tag} tone="glass" />
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <HeartButton testID="piece-coeur" liked={liked} onToggle={() => a.coeur(piece.id)} name={piece.name} size={44} />
              <IconButton testID="piece-compose" icon="chevron" label="Composer une tenue avec cette pièce" variant="solid" size={44} onPress={() => nav.navigate('Compose', { with: piece.id })} />
            </View>
          </View>

          <View style={{ gap: 4 }}>
            <InlineEdit testID="piece-brand" kind="brand" value={piece.brand ?? ''} empty="Ajouter la marque" max={60} onSave={(v) => a.updatePiece({ ...piece, brand: v || undefined })} />
            <InlineEdit testID="piece-name" kind="name" value={piece.name} empty="Nommer la pièce" max={60} required onSave={(v) => a.updatePiece({ ...piece, name: v })} />
            <T v="kicker" tone={piece.wears === 0 && !isNew(piece) ? 'caution' : 'ink2'} style={{ marginTop: 2 }}>
              {usage}
            </T>
          </View>

          <View className="flex-row flex-wrap" testID="piece-specs">
            {specs.map((x) => (
              <Tap
                key={x.label}
                testID={`spec-${x.label}`}
                onPress={() => setEditing(true)}
                accessibilityRole="button"
                accessibilityLabel={x.value ? `${x.label} : ${x.value}. Modifier l’étiquette` : `${x.label} : à renseigner`}
                outerStyle={{ width: '50%' }}
                scaleTo={0.98}
                style={{ gap: 5, paddingVertical: 12, paddingRight: 12, borderTopWidth: 1, borderColor: c.rule }}
              >
                <T v="label" tone="ink2">
                  {x.label}
                </T>
                {x.value ? (
                  <View className="flex-row items-center" style={{ gap: 7 }}>
                    {x.swatch ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: x.swatch, borderWidth: 1, borderColor: c.rule }} /> : null}
                    <T v="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {x.value}
                    </T>
                  </View>
                ) : (
                  <View className="flex-row items-center" style={{ gap: 5 }}>
                    <Icon name="plus" size={13} color={c.ink2} strokeWidth={2} />
                    <T v="body" tone="ink2">
                      Ajouter
                    </T>
                  </View>
                )}
              </Tap>
            ))}
          </View>
        </Card>

        <Button testID="piece-wear" label={wornToday ? `Porté${f.e} aujourd’hui` : `Je ${f.le} porte`} hint="Note un port aujourd’hui" disabled={wornToday} icon={wornToday ? 'check' : undefined} onPress={() => a.wear([piece.id], `C’est noté : ${piece.name.toLowerCase()} aujourd’hui`)} />

        {dormant && (
          <Card className="bg-butter" style={{ gap: 12, padding: 14 }}>
            <Tag label={piece.lastWorn === null ? `Jamais porté${f.e}` : `${f.il} ${f.v('dort', 'dorment')} depuis ${sinceLabel(piece).replace('il y a ', '')}`} tone="butter" />
            <View className="flex-row" style={{ gap: 8 }}>
              <Button testID="dormant-plan" label="Prévoir demain" size="m" grow onPress={() => nav.navigate('Compose', { with: piece.id, day: 1 })} />
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
        <Row icon="edit" title="Modifier l’étiquette" detail="Nom, couleur, matière, prix" testID="piece-edit" onPress={() => { setMenu(false); setTimeout(() => setEditing(true), 380); }} />
        {cleanable && left !== null && (
          noGen ? (
            <>
              {/* À zéro : la ligne est éteinte et dit pourquoi ; un seul chemin mène aux offres. */}
              <Row icon="image" title="Image propre" detail={free ? 'Tu as utilisé tes générations offertes.' : 'Tes générations reviennent le 1er du mois.'} testID="piece-clean-off" />
              {free && <Row icon="lock" title="Voir les offres" testID="piece-clean-offers" onPress={() => { setMenu(false); setTimeout(() => nav.navigate('Generations'), 380); }} />}
            </>
          ) : (
            <Row
              icon="image"
              title="Image propre"
              detail={s.creator ? 'Kodi redessine cette pièce sur fond net' : `Kodi redessine cette pièce sur fond net · ${left} ${free ? (left > 1 ? 'offertes' : 'offerte') : 'ce mois-ci'}`}
              testID="piece-clean"
              onPress={() => {
                setMenu(false);
                void a.cleanImage(piece.id).then((r) => {
                  if (r === 'quota') nav.navigate('Generations');
                });
              }}
            />
          )
        )}
        {ratable && (
          <Row
            icon="star"
            title="Noter le dessin"
            detail={note ? `Ta note : ${moyenne(note)} sur 5` : 'Le temps, la qualité, le rendu final'}
            testID="piece-rate"
            onPress={() => { setMenu(false); setTimeout(() => setRating(true), 380); }}
          />
        )}
        <Row icon="trash" title="Retirer du dressing" detail="Tu pourras annuler juste après" last onPress={() => { setMenu(false); nav.goBack(); a.removePiece(piece.id); }} testID="piece-remove" />
      </Sheet>

      <RatingSheet visible={rating} onClose={() => setRating(false)} initial={note} onSave={(n) => { setRating(false); a.ratePiece(piece.id, n); }} />

      <LabelEditor piece={piece} visible={editing} onClose={() => setEditing(false)} onSave={(p) => { setEditing(false); a.updatePiece(p); }} />
    </View>
  );
}
