/**
 * Mes choix (23/10) : les pièces aimées (cœurs), l'accord « Kodi apprend de
 * mes choix », et ce que Kodi retient de la personne, qu'on efface une ligne
 * à la fois. Ouvert depuis Réglages. Sans compte, ces choix restent sur le
 * téléphone.
 */
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { F } from '../theme/fonts';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Icon } from '../ui/Icon';
import { Toggle } from '../ui/controls';
import { Card, EmptyState, Group, Row, Tag } from '../ui/bits';
import { Ambient } from '../ui/Ambient';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import type { Nav } from '../navigation/types';

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

export function MesChoix() {
  const { s, a } = useStore();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const aimees = s.coeurs.map((id) => s.pieces.find((p) => p.id === id)).filter((p) => !!p);
  const accord = !!s.gouts;

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-mes-choix">
      <Ambient />
      <StackHeader title="Mes choix" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top + 4, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <View style={{ gap: 8, paddingHorizontal: 4, paddingBottom: 4 }}>
          <T v="label" tone="ink2">
            Tes goûts
          </T>
          <T v="hero" accessibilityRole="header">
            {'Ce que tu aimes,\n'}
            <T v="hero" style={F.accent}>
              ce que Kodi retient
            </T>
            .
          </T>
        </View>

        <Card style={{ gap: 10 }} testID="mes-choix-accord">
          <Tag label="Kodi apprend de mes choix" />
          <Toggle testID="gouts-consent" value={accord} onChange={(v) => a.accorderGouts(v)} label="Kodi apprend de mes choix" />
          <T v="small" tone="ink2">
            Quand tu aimes une pièce ou une tenue, ou que tu écartes une tenue, Kodi s’en souvient pour mieux te proposer. Retirer l’accord efface tout ce qu’il retient. Tes cœurs restent dans tes favoris.
          </T>
        </Card>

        <T v="label" tone="ink2" style={{ paddingHorizontal: 6, paddingTop: 6 }} accessibilityRole="header">
          Pièces aimées
        </T>
        {aimees.length ? (
          <Group testID="mes-choix-pieces">
            {aimees.map((p) => (
              <Row key={p.id} testID={`coeur-${p.id}`} icon="heart" title={p.name} onPress={() => nav.navigate('Piece', { id: p.id })} />
            ))}
          </Group>
        ) : (
          <EmptyState title="Pas encore de cœur" body="Touche « Ajouter à mes choix » sur une pièce de ton dressing : elle se retrouve ici." />
        )}

        {accord && (
          <>
            <T v="label" tone="ink2" style={{ paddingHorizontal: 6, paddingTop: 6 }} accessibilityRole="header">
              Ce que Kodi retient
            </T>
            {s.souvenirs.length ? (
              <Group testID="mes-choix-souvenirs">
                {s.souvenirs.map((f) => (
                  <Row
                    key={f.id}
                    testID={`souvenir-${f.id}`}
                    icon={f.origine === 'aime' ? 'heart' : 'close'}
                    title={f.texte}
                    detail={`${f.origine === 'aime' ? 'Aimé' : 'Écarté'} le ${date(f.date)}`}
                    right={
                      <Tap testID={`souvenir-effacer-${f.id}`} onPress={() => a.retirerSouvenir(f.id)} accessibilityRole="button" accessibilityLabel="Effacer ce souvenir" style={{ padding: 8 }}>
                        <Icon name="trash" size={18} color={c.ink2} />
                      </Tap>
                    }
                  />
                ))}
              </Group>
            ) : (
              <EmptyState title="Rien encore" body="Kodi retiendra ce que tu aimes et ce que tu écartes." />
            )}
          </>
        )}

        <T v="small" tone="ink2" style={{ paddingHorizontal: 6 }}>
          Sans compte, ces choix restent sur ce téléphone.
        </T>
      </Animated.ScrollView>
    </View>
  );
}
