import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '../state/store';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Button } from '../ui/Button';
import { Chip } from '../ui/controls';
import { StackHeader, useHeaderScroll, useStackTop, Rule } from '../ui/layout';
import { Card, EmptyState, Skeleton } from '../ui/bits';
import { Garment } from '../ui/Garment';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Ambient } from '../ui/Ambient';
import type { Nav } from '../navigation/types';

/**
 * Écran 18 : la revue des feuilles, états vides, chargements et erreurs,
 * au même endroit. Chaque état a une phrase et une action : aucune impasse.
 */
function Block({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <Rule />
      <View className="flex-row items-baseline" style={{ gap: 10 }}>
        <T v="numeral" tone="brass">
          {n}
        </T>
        <T v="section">{title}</T>
      </View>
      {children}
    </View>
  );
}

export function States() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const { a } = useStore();
  const [sheet, setSheet] = useState<'confirm' | 'choice' | 'info' | null>(null);

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-states">
      <Ambient />
      <StackHeader title="États et feuilles" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 32, gap: 22 }}>
        <View style={{ gap: 8 }}>
          <T v="kicker" tone="ink2" upper>
            Aperçu design
          </T>
          <T v="title" accessibilityRole="header">
            Feuilles, vides{'\n'}
            <T v="title" style={{ fontFamily: 'Accent' }}>
              et chargements.
            </T>
          </T>
        </View>

        <Block n="01" title="Feuilles">
          <T v="body" tone="ink2">
            Toujours ouvertes par un geste, jamais par l’app. On les ferme en glissant, en touchant le voile ou la croix.
          </T>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            <Chip testID="demo-confirm" label="Confirmation" onPress={() => setSheet('confirm')} />
            <Chip testID="demo-choice" label="Choix" onPress={() => setSheet('choice')} />
            <Chip testID="demo-info" label="Information" onPress={() => setSheet('info')} />
          </View>
        </Block>

        <Block n="02" title="Vides">
          <Card>
            <EmptyState
              art={<Garment kind="trench" size={78} hanger hangerColor={c.rod} dark={scheme === 'dark'} />}
              title="Ton premier portant t’attend"
              body="Photographie trois pièces que tu portes souvent : Kode pourra déjà composer."
              action={<Button label="Ajouter une pièce" size="m" icon="plus" onPress={() => nav.navigate('AddPiece')} />}
            />
          </Card>
          <Card>
            <EmptyState
              art={<Icon name="calendar" size={40} color={c.ink2} />}
              title="Semaine calme"
              body="Aucun événement. Tu pourrais relier ton agenda pour que Kode prépare les jours chargés."
              action={<Button label="Relier mon agenda" size="m" variant="secondary" onPress={() => a.toast('La liaison d’agenda arrive bientôt')} />}
            />
          </Card>
          <Card>
            <EmptyState
              art={<Icon name="search" size={40} color={c.ink2} />}
              title="Rien ne correspond"
              body="Aucune pièce « velours ». Tu pourrais essayer une couleur ou une matière."
              action={<Button label="Tout afficher" size="m" variant="secondary" onPress={() => nav.navigate('Tabs', { screen: 'Dressing', params: { view: 'grille' } })} />}
            />
          </Card>
        </Block>

        <Block n="03" title="Chargements">
          <T v="body" tone="ink2">
            Des squelettes à la forme du contenu, jamais de roue qui tourne seule. Figés si les animations sont réduites.
          </T>
          <Card style={{ gap: 12 }}>
            <Skeleton w="40%" h={12} />
            <Skeleton w="80%" h={34} r={10} />
            <View className="flex-row" style={{ gap: 10 }}>
              <Skeleton w={96} h={120} r={18} />
              <Skeleton w={96} h={120} r={18} />
              <Skeleton w={96} h={120} r={18} />
            </View>
            <Skeleton w="100%" h={50} r={25} />
          </Card>
        </Block>

        <Block n="04" title="Erreurs">
          <Card className="flex-row" style={{ gap: 12 }}>
            <Icon name="offline" size={24} color={c.caution} />
            <View style={{ flex: 1, gap: 4 }}>
              <T v="bodyStrong">Pas de réseau</T>
              <T v="body" tone="ink2">
                Ton dressing et tes tenues prévues restent là. Kode répondra dès que le réseau revient.
              </T>
            </View>
          </Card>
          <Card className="bg-caution-soft flex-row" style={{ gap: 12 }}>
            <Icon name="kode" size={24} color={c.caution} />
            <View style={{ flex: 1, gap: 4 }}>
              <T v="bodyStrong">Kode n’a pas pu répondre</T>
              <T v="body" tone="ink2">
                La question ne compte pas dans ton quota. Tu peux la reposer.
              </T>
              <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                <Button label="Reposer la question" size="s" variant="secondary" icon="refresh" onPress={() => nav.navigate('Tabs', { screen: 'Kode', params: { ask: 'Une tenue pour demain', nonce: Date.now() } })} />
              </View>
            </View>
          </Card>
        </Block>
      </Animated.ScrollView>

      <Sheet
        visible={sheet === 'confirm'}
        onClose={() => setSheet(null)}
        kicker="Confirmer"
        title="Retirer le blazer lin ?"
        testID="demo-sheet-confirm"
        footer={
          <View className="flex-row" style={{ gap: 8 }}>
            <Button label="Garder" variant="secondary" grow onPress={() => setSheet(null)} />
            <Button label="Retirer" grow onPress={() => setSheet(null)} />
          </View>
        }
      >
        <T v="body" tone="ink2">
          Il quittera tes portants. Tu pourras annuler juste après.
        </T>
      </Sheet>
      <Sheet visible={sheet === 'choice'} onClose={() => setSheet(null)} kicker="Choisir" title="Pour quand ?">
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {['Aujourd’hui', 'Demain', 'Samedi', 'Dimanche'].map((d) => (
            <Chip key={d} label={d} onPress={() => setSheet(null)} />
          ))}
        </View>
      </Sheet>
      <Sheet visible={sheet === 'info'} onClose={() => setSheet(null)} kicker="Bon à savoir" title="Pourquoi le coût par port ?">
        <T v="body" tone="ink2">
          Une pièce à 120 € portée 40 fois revient à 3 € la sortie. C’est la mesure qui récompense ce que tu portes, pas ce que tu achètes.
        </T>
      </Sheet>
    </View>
  );
}
