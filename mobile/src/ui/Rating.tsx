/**
 * Noter le dessin d'une pièce (18/11) : trois lignes d'étoiles (le temps, la
 * qualité, le rendu final), de 1 à 5, dans une feuille. Le bouton ne s'allume
 * que quand les trois notes sont données ; une pièce déjà notée rouvre ses
 * notes, qu'on peut changer.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { HIT } from '../theme/tokens';
import { CRITERES, MOTS, complete, type Critere, type NoteDessin } from '../state/notes';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { T } from './T';
import { Tap } from './Tap';

const STAR = 'M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4 6.9 19.3 8 13.6l-4.3-4 5.8-.7Z';

function Star({ on, size, color, off }: { on: boolean; size: number; color: string; off: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d={STAR} fill={on ? color : 'none'} stroke={on ? color : off} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

/** Cinq étoiles qu'on touche ; chacune a sa zone tactile et son libellé pour le lecteur d'écran. */
export function Stars({ value, onChange, label, testID }: { value: number; onChange: (n: number) => void; label: string; testID?: string }) {
  const { c } = useTheme();
  return (
    <View className="flex-row" style={{ gap: 2 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Tap
          key={n}
          testID={testID ? `${testID}-${n}` : undefined}
          onPress={() => onChange(n)}
          feedback="select"
          scaleTo={0.88}
          accessibilityRole="radio"
          accessibilityLabel={`${label}, ${n} sur 5, ${MOTS[n - 1].toLowerCase()}`}
          accessibilityState={{ selected: value === n }}
          style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}
        >
          <Star on={n <= value} size={30} color={c['blue-ink']} off={c.ink2} />
        </Tap>
      ))}
    </View>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Les notes déjà données, pour les rouvrir. */
  initial?: NoteDessin | null;
  onSave: (n: NoteDessin) => void;
};

export function RatingSheet({ visible, onClose, initial, onSave }: Props) {
  const [note, setNote] = useState<Partial<NoteDessin>>(initial ?? {});
  // À chaque ouverture, on repart des notes déjà données.
  useEffect(() => {
    if (visible) setNote(initial ?? {});
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = complete(note);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Le dessin de Kodi"
      testID="piece-rating"
      footer={<Button testID="rating-save" label={initial ? 'Mettre à jour' : 'Envoyer ma note'} disabled={!ready} onPress={() => ready && onSave(note)} />}
    >
      <View style={{ gap: 6, paddingBottom: 8 }}>
        {CRITERES.map((k) => {
          const v = note[k.id] ?? 0;
          return (
            <View key={k.id} style={{ gap: 2, paddingVertical: 6 }}>
              <View className="flex-row items-baseline justify-between">
                <T v="bodyStrong" style={{ fontSize: 15 }}>
                  {k.label}
                </T>
                <T v="caption" tone="ink2">
                  {v ? MOTS[v - 1] : k.detail}
                </T>
              </View>
              <View style={{ marginLeft: -7 }}>
                <Stars testID={`rating-${k.id}`} label={k.label} value={v} onChange={(n) => setNote((x) => ({ ...x, [k.id as Critere]: n }))} />
              </View>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}
