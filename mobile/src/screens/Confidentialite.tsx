/**
 * La politique de confidentialité (09/10), écrite pour être lue : un titre
 * fin, l'essentiel en quatre cartes, puis chaque section sur la base
 * éditoriale de l'app (étiquettes en capitales, texte à 15 px). Le texte vit
 * dans data/legal.ts, le même que docs/rgpd/ et la page du site.
 */
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EDITEUR, POLITIQUE, POLITIQUE_VERSION } from '../data/legal';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { F } from '../theme/fonts';
import { T } from '../ui/T';
import { Card } from '../ui/bits';
import { Ambient } from '../ui/Ambient';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';

export function Confidentialite() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop();
  const [bref, ...rest] = POLITIQUE;
  const editeur = [EDITEUR.nom, EDITEUR.forme, EDITEUR.adresse, EDITEUR.siren && `SIREN ${EDITEUR.siren}`].filter(Boolean).join(' · ');

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-confidentialite">
      <Ambient />
      <StackHeader title="Vie privée" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top + 4, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <View style={{ gap: 8, paddingHorizontal: 4, paddingBottom: 4 }}>
          <T v="label" tone="ink2">
            Politique de confidentialité
          </T>
          <T v="hero" accessibilityRole="header">
            {'Tes données,\n'}
            <T v="hero" style={F.accent}>
              en clair
            </T>
            .
          </T>
          <T v="small" tone="ink2">
            {POLITIQUE_VERSION}
          </T>
        </View>

        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {(bref.liste ?? []).map((x) => (
            <View key={x.titre} style={{ flexGrow: 1, flexBasis: '45%', padding: 14, gap: 6, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c['card-edge'] }}>
              <T v="body" style={F.s600}>
                {x.titre}
              </T>
              <T v="small" tone="ink2">
                {x.texte}
              </T>
            </View>
          ))}
        </View>

        {rest.map((s) => (
          <Card key={s.titre} style={{ gap: 10 }}>
            <T v="label" accessibilityRole="header">
              {s.titre}
            </T>
            {(s.texte ?? []).map((p) => (
              <T key={p} v="body">
                {p}
              </T>
            ))}
            {(s.liste ?? []).map((x, i) => (
              <View key={x.titre} style={{ gap: 3, paddingTop: i ? 10 : 0, borderTopWidth: i ? 1 : 0, borderColor: c.rule }}>
                <T v="body" style={F.s600}>
                  {x.titre}
                </T>
                <T v="caption" tone="ink2">
                  {x.texte}
                </T>
              </View>
            ))}
          </Card>
        ))}

        <Card style={{ gap: 6 }} testID="confidentialite-editeur">
          <T v="label">Éditeur et contact</T>
          <T v="body">{editeur}</T>
          <T v="body" tone={EDITEUR.contact ? 'ink' : 'ink2'} selectable>
            {EDITEUR.contact ?? 'L’adresse de contact sera indiquée ici avant la sortie de l’app.'}
          </T>
        </Card>
      </Animated.ScrollView>
    </View>
  );
}
