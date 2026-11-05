/**
 * Les favoris du dressing (05/11), comme la page « Favoris » des grandes
 * boutiques : toutes les pièces au cœur, toutes catégories confondues,
 * posées par rayon sur leur gris studio. Un chiffre, un bouton pour composer
 * avec elles, et un état vide qui dit quoi faire. Les cœurs sont ceux de
 * « Mes choix » (`s.coeurs`) : une seule liste, deux entrées.
 */
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { CATEGORIES, type Piece } from '../data/wardrobe';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from './T';
import { Button } from './Button';
import { Card, EmptyState, PieceTile, Tag } from './bits';
import { Icon } from './Icon';
import type { Nav } from '../navigation/types';

type Props = {
  /** Les favoris à montrer (après la recherche et les filtres). */
  pieces: Piece[];
  /** Combien de favoris au total, sans filtre : zéro, c'est l'état vide. */
  total: number;
  tileW: number;
  gap: number;
  dense: boolean;
  /** Revenir au dressing entier. */
  onExit: () => void;
  /** Effacer la recherche et les filtres. */
  onReset: () => void;
};

export function FavorisView({ pieces, total, tileW, gap, dense, onExit, onReset }: Props) {
  const { s, a } = useStore();
  const { c } = useTheme();
  const nav = useNavigation<Nav>();
  const liked = new Set(s.coeurs);

  if (total === 0) {
    return (
      <EmptyState
        art={
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="heart" size={30} color={c['blue-ink']} />
          </View>
        }
        title="Pas encore de favoris"
        body="Touche le cœur d’une pièce pour la retrouver ici."
        action={<Button testID="favoris-empty-back" label="Voir mon dressing" variant="secondary" size="m" onPress={onExit} />}
      />
    );
  }

  const byCat = CATEGORIES.map((cat) => ({ cat, items: pieces.filter((p) => p.category === cat.id) })).filter((x) => x.items.length);
  // Le cœur le plus récent d'abord : s.coeurs est dans cet ordre, et Kodi part des premières pièces.
  const order = s.coeurs.filter((id) => pieces.some((p) => p.id === id));

  return (
    <Animated.View entering={FadeIn.duration(180)} style={{ gap: 20 }} testID="favoris-view">
      {pieces.length > 0 && (
      <View style={{ paddingHorizontal: space.gutter }}>
        <Card style={{ gap: 14, padding: 16 }} testID="favoris-card">
          <Tag label="Mes favoris" icon="heart" />
          <View className="flex-row items-end" style={{ gap: 10 }}>
            <T v="stat" style={{ fontSize: 40, lineHeight: 44 }} accessibilityLabel={`${pieces.length} favori${pieces.length > 1 ? 's' : ''}`}>
              {String(pieces.length)}
            </T>
            <T v="small" tone="ink2" style={{ paddingBottom: 6, flex: 1 }}>
              {`${pieces.length > 1 ? 'pièces aimées' : 'pièce aimée'} · ${byCat.length} rayon${byCat.length > 1 ? 's' : ''}`}
            </T>
          </View>
          <Button testID="favoris-compose" label="Composer avec mes favoris" icon="hanger" size="m" onPress={() => nav.navigate('Compose', { pieces: order.slice(0, 12) })} />
        </Card>
      </View>
      )}

      {pieces.length === 0 && <EmptyState title="Rien ne correspond" body="Tu pourrais retirer un filtre pour élargir." action={<Button label="Tout afficher" variant="secondary" size="m" onPress={onReset} />} />}

      {byCat.map(({ cat, items }) => (
        <View key={cat.id} style={{ gap: 12, paddingHorizontal: space.gutter }} accessibilityLabel={cat.title} testID={`favoris-${cat.id}`}>
          <T v="label" tone="ink2" accessibilityRole="header">
            {`${cat.short} · ${items.length}`}
          </T>
          <View className="flex-row flex-wrap" style={{ gap, rowGap: 18 }}>
            {items.map((p) => (
              <PieceTile key={p.id} piece={p} width={tileW} dense={dense} liked={liked.has(p.id)} onLike={() => a.coeur(p.id)} onPress={(from) => nav.navigate('Piece', { id: p.id, from })} />
            ))}
          </View>
        </View>
      ))}
    </Animated.View>
  );
}
