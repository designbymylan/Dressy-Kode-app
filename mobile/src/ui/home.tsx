import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CATEGORIES, euros, type Piece } from '../data/wardrobe';
import { useMeteo, usageRate, useStore } from '../state/store';
import { dayName, isoOf, offsetOf } from '../state/planning';
import { useTheme } from '../theme/ThemeProvider';
import { material, space } from '../theme/tokens';
import { F } from '../theme/fonts';
import type { Nav } from '../navigation/types';
import { Card, Tag, WeatherIcon } from './bits';
import { Garment } from './Garment';
import { Icon, type IconName } from './Icon';
import { T } from './T';
import { Tap } from './Tap';
import { FlatLay } from './outfit';

/**
 * Les sections de l'accueil nées de la refonte du 23/10, sur les pages
 * d'accueil envoyées (applis de mode, de santé) : raccourcis en tuiles,
 * prochain rendez-vous en cartes empilées, rayons en ronds, chiffres sur
 * deux cartes pastel. Couleurs, polices, verre et arrondis restent ceux de
 * la charte.
 */

/** Une tuile de raccourci : l'icône pleine, un mot. */
function Shortcut({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  const { c, scheme } = useTheme();
  return (
    <Tap
      testID={testID}
      onPress={onPress}
      accessibilityLabel={label}
      outerStyle={{ flex: 1 }}
      style={[{ height: 88, borderRadius: 22, backgroundColor: c['glass-strong'], borderWidth: 1, borderColor: c['card-edge'], alignItems: 'center', justifyContent: 'center', gap: 8 }, material.card[scheme]]}
    >
      <Icon name={icon} size={26} color={c.ink} />
      <T v="small" style={F.s600} numberOfLines={1}>
        {label}
      </T>
    </Tap>
  );
}

/** Quatre gestes qu'on refait chaque semaine : ajouter, composer, planifier, voyager. */
export function QuickActions() {
  const nav = useNavigation<Nav>();
  return (
    <View className="flex-row" style={{ gap: 10 }} testID="home-shortcuts">
      <Shortcut testID="shortcut-add" icon="plus" label="Ajouter" onPress={() => nav.navigate('AddPiece')} />
      <Shortcut testID="shortcut-compose" icon="hanger" label="Composer" onPress={() => nav.navigate('Compose')} />
      <Shortcut testID="shortcut-planning" icon="calendar" label="Calendrier" onPress={() => nav.navigate('Planning', {})} />
      <Shortcut testID="shortcut-trip" icon="suitcase" label="Voyage" onPress={() => nav.navigate('Trip')} />
    </View>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Le prochain rendez-vous : une carte bleue, deux feuillets qui dépassent
 * dessous (beurre, puis chocopie pâle), sa date, son heure, sa météo et la
 * tenue prévue, ou le moyen de la prévoir. Sans rendez-vous, une carte en
 * pointillés propose d'en ajouter un.
 */
export function NextEvent() {
  const { s } = useStore();
  const nav = useNavigation<Nav>();
  const { c, scheme } = useTheme();
  const meteo = useMeteo();
  const now = new Date();
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const today = isoOf(0);
  const next = s.events
    .filter((e) => e.date > today || (e.date === today && (!e.time || e.time >= hhmm)))
    .sort((x, z) => `${x.date}${x.time ?? '99'}`.localeCompare(`${z.date}${z.time ?? '99'}`))[0];

  if (!next)
    return (
      <Tap
        testID="home-no-event"
        onPress={() => nav.navigate('EventEdit', { date: today })}
        scaleTo={0.99}
        accessibilityLabel="Ajouter un rendez-vous"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.faint }}
      >
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.pill, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={22} color={c.ink} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="bodyStrong">Un rendez-vous à venir ?</T>
          <T v="caption" tone="ink2">
            Kodi prépare la tenue qui va avec.
          </T>
        </View>
      </Tap>
    );

  const o = offsetOf(next.date);
  const w = meteo.jours[o] ?? null;
  const plan = s.planned[next.date];
  const pieces = plan ? (plan.pieces.map((id) => s.pieces.find((p) => p.id === id)).filter(Boolean) as Piece[]) : [];
  const sub = [next.kind, next.dressCode].filter(Boolean).join(' · ');
  // La carte reste bleu clair en mode sombre : texte et icônes restent noirs dessus (jeton « primary-fg »).
  const ink = c['primary-fg'];
  return (
    <View style={{ paddingTop: 10, paddingBottom: 26 }} testID="home-next-event">
      {/* Les feuillets qui dépassent sous la carte. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 28, right: 28, bottom: 0, height: 64, borderRadius: 28, backgroundColor: c['choco-soft'], borderWidth: 1, borderColor: c['card-edge'] }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 14, right: 14, bottom: 12, height: 64, borderRadius: 28, backgroundColor: c.butter }} />
      <View>
        <Tap
          onPress={() => nav.navigate('Planning', { date: next.date })}
          scaleTo={0.99}
          accessibilityLabel={`Prochain rendez-vous : ${next.title}, ${dayName(next.date)}${next.time ? `, ${next.time.replace(':', ' h ')}` : ''}`}
          style={[{ backgroundColor: c.blue, borderRadius: 28, padding: 18, paddingTop: 24, gap: 14 }, material.card[scheme]]}
        >
          <View className="flex-row items-center" style={{ gap: 14 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <T v="cardTitle" tone="primary-fg" numberOfLines={2}>
                {next.title}
              </T>
              {sub ? (
                <T v="caption" tone="primary-fg" numberOfLines={1} style={{ opacity: 0.72 }}>
                  {sub}
                </T>
              ) : null}
            </View>
            {pieces.length > 0 && <FlatLay pieces={pieces} w={84} h={84} />}
          </View>
          <View style={{ height: 1, backgroundColor: ink, opacity: 0.14 }} />
          <View className="flex-row items-center" style={{ gap: 14, flexWrap: 'wrap' }}>
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Icon name="calendar" size={16} color={ink} />
              <T v="small" tone="primary-fg" style={F.s600}>
                {dayName(next.date)}
              </T>
            </View>
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Icon name="clock" size={16} color={ink} />
              <T v="small" tone="primary-fg" style={F.s600}>
                {next.time ?? 'Dans la journée'}
              </T>
            </View>
            {w && (
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <WeatherIcon w={w} size={16} color={ink} />
                <T v="small" tone="primary-fg" style={F.s600}>{`${w.t}°`}</T>
              </View>
            )}
            <View style={{ flex: 1 }} />
            {!plan && (
              <Tap
                testID="next-event-plan"
                onPress={() => nav.navigate('Compose', { date: next.date })}
                accessibilityLabel="Prévoir la tenue de ce rendez-vous"
                hitSlop={6}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: c['butter-field'] }}
              >
                <Icon name="plus" size={15} color={ink} strokeWidth={2.2} />
                <T v="small" tone="primary-fg" style={F.s600}>
                  Prévoir la tenue
                </T>
              </Tap>
            )}
          </View>
        </Tap>
        {/* L'étiquette à cheval sur le bord haut de la carte. */}
        <View pointerEvents="none" style={{ position: 'absolute', top: -10, left: 20, height: 22, paddingHorizontal: 10, borderRadius: 11, backgroundColor: c['butter-field'], borderWidth: 1, borderColor: c['card-edge'], justifyContent: 'center' }}>
          <T v="label" tone="primary-fg" style={{ fontSize: 10.5 }}>
            Prochain rendez-vous
          </T>
        </View>
      </View>
    </View>
  );
}

/**
 * Les rayons du dressing en ronds (comme les catégories d'une boutique) :
 * la dernière pièce ajoutée de chaque rayon, son nom, son nombre de pièces.
 * Chaque rond ouvre le dressing à ce rayon.
 */
export function Rayons({ title }: { title: string }) {
  const { s } = useStore();
  const nav = useNavigation<Nav>();
  const { c, scheme } = useTheme();
  const items = CATEGORIES.map((cat) => {
    const list = s.pieces.filter((p) => p.category === cat.id);
    return { cat, n: list.length, rep: [...list].sort((a, b) => a.addedDaysAgo - b.addedDaysAgo)[0] };
  }).filter((x) => x.n > 0);
  if (items.length < 2) return null;
  const all = () => nav.navigate('Tabs', { screen: 'Dressing', params: { view: 'rangees' } });
  return (
    <View style={{ gap: 12 }} testID="home-rayons">
      <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 4, minHeight: 28 }}>
        <Tag label={title} />
        <T testID="module-rayons-action" v="label" tone="ink2" onPress={all} accessibilityRole="link" suppressHighlighting style={{ paddingLeft: 12 }}>
          Tout voir
        </T>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 18 }}>
        {items.map(({ cat, n, rep }) => (
          <Tap
            key={cat.id}
            testID={`rayon-${cat.id}`}
            onPress={() => nav.navigate('Tabs', { screen: 'Dressing', params: { category: cat.id, view: 'grille' } })}
            accessibilityLabel={`${cat.short}, ${n} pièce${n > 1 ? 's' : ''}`}
            style={{ width: 76, alignItems: 'center', gap: 8 }}
          >
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: c['card-edge'] }}>
              <Garment kind={rep.kind} tint={rep.tint} image={rep.image} size={52} dark={scheme === 'dark'} label={rep.name} />
            </View>
            <View style={{ alignItems: 'center', gap: 1 }}>
              <T v="small" style={F.s600} numberOfLines={1}>
                {cat.short}
              </T>
              <T v="kicker" tone="ink2">
                {String(n)}
              </T>
            </View>
          </Tap>
        ))}
      </ScrollView>
    </View>
  );
}

/** Une carte de chiffre : le libellé en haut, le grand chiffre, un mot d'état. */
function Figure({ label, value, note, icon, tone, testID }: { label: string; value: string; note: string; icon: IconName; tone: 'butter' | 'blue'; testID: string }) {
  const { c } = useTheme();
  const body = (
    <>
      <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
        <T v="caption" tone={tone === 'butter' ? 'primary-fg' : 'ink'} numberOfLines={1} style={{ flexShrink: 1, opacity: 0.75 }}>
          {label}
        </T>
        <Icon name={icon} size={18} color={tone === 'butter' ? c['primary-fg'] : c['blue-ink']} />
      </View>
      <T v="stat" numberOfLines={1} adjustsFontSizeToFit tone={tone === 'butter' ? 'primary-fg' : 'ink'} style={{ fontSize: 38, lineHeight: 42 }}>
        {value}
      </T>
      <T v="caption" tone={tone === 'butter' ? 'primary-fg' : 'blue-ink'} style={F.s600}>
        {note}
      </T>
    </>
  );
  if (tone === 'butter')
    return (
      <Card testID={testID} className="bg-butter" style={{ flex: 1, padding: 16, gap: 8 }}>
        {body}
      </Card>
    );
  return (
    <Card testID={testID} style={{ flex: 1, padding: 16, gap: 8, backgroundColor: c['blue-soft'] }}>
      {body}
    </Card>
  );
}

/**
 * Deux chiffres sur deux cartes pastel (beurre, bleu pâle), comme les
 * constantes d'une appli de santé : les pièces sorties ce mois-ci, puis le
 * coût par port ou, sans prix, la part du dressing portée.
 */
export function Figures() {
  const { s } = useStore();
  if (!s.pieces.length) return null;
  const worn30 = s.pieces.filter((p) => p.lastWorn !== null && p.lastWorn <= 30).length;
  const rate = usageRate(s.pieces);
  const priced = s.pieces.filter((p) => p.price && p.wears > 0);
  const cpw = priced.length ? priced.reduce((n, p) => n + (p.price ?? 0), 0) / priced.reduce((n, p) => n + p.wears, 0) : null;
  return (
    <View className="flex-row" style={{ gap: 10 }} testID="home-figures">
      <Figure testID="figure-out" tone="butter" icon="hanger" label="Sorties ce mois" value={String(worn30)} note={worn30 >= Math.ceil(s.pieces.length / 3) ? 'Belle rotation' : worn30 > 0 ? 'Ça tourne' : 'Tout dort'} />
      {cpw !== null ? (
        <Figure testID="figure-cpw" tone="blue" icon="tag" label="Coût par port" value={euros(cpw)} note="Moyenne de ton dressing" />
      ) : (
        <Figure testID="figure-rate" tone="blue" icon="chart" label="Dressing porté" value={`${rate} %`} note={rate >= 60 ? 'Bien exploité' : 'Encore à sortir'} />
      )}
    </View>
  );
}

/** Une carte de pièce en grand (« Le plus porté ») : la pièce sur gris studio, son rang, son nom, ses ports. */
export function PieceCard({ piece, rank, width, onPress, testID }: { piece: Piece; rank: number; width: number; onPress: () => void; testID?: string }) {
  const { c, scheme } = useTheme();
  const priced = piece.price && piece.wears > 0 ? piece.price / piece.wears : null;
  return (
    <Tap testID={testID} onPress={onPress} accessibilityLabel={`${rank}, ${piece.name}, ${piece.wears} ports`} style={{ width, gap: 10 }} scaleTo={0.97}>
      <View style={{ height: width * 1.08, borderRadius: 28, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center' }}>
        <Garment kind={piece.kind} tint={piece.tint} image={piece.image} size={width * 0.66} dark={scheme === 'dark'} label={piece.name} />
        <View style={{ position: 'absolute', top: 12, left: 12, height: 28, minWidth: 28, paddingHorizontal: 9, borderRadius: 14, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
          <T v="small" style={[F.s600, { color: c.paper }]}>{String(rank)}</T>
        </View>
      </View>
      <View style={{ paddingHorizontal: 4, gap: 2 }}>
        <T v="bodyStrong" numberOfLines={1}>
          {piece.name}
        </T>
        <T v="caption" tone="ink2" numberOfLines={1}>
          {`${piece.wears} port${piece.wears > 1 ? 's' : ''}${priced !== null ? ` · ${euros(priced)} par port` : ''}`}
        </T>
      </View>
    </Tap>
  );
}
