/**
 * « Pas pour moi » (09/10) : la feuille qui s'ouvre sous une tenue qu'on ne
 * veut pas. Une raison en un geste (facultative), la pièce visée si c'est
 * elle, et une autre tenue tout de suite. La raison part chez Kodi : c'est la
 * réponse à « l'IA ne me comprend pas ».
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Piece } from '../data/wardrobe';
import { RAISONS, type Raison } from '../state/ecarts';
import { useTheme } from '../theme/ThemeProvider';
import { T } from './T';
import { Tap } from './Tap';
import { Button } from './Button';
import { F } from '../theme/fonts';
import { Garment } from './Garment';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

export function NotForMeSheet({ visible, pieces, onClose, onConfirm }: { visible: boolean; pieces: Piece[]; onClose: () => void; onConfirm: (raison: Raison, cibles: string[]) => void }) {
  const { c, scheme } = useTheme();
  const [raison, setRaison] = useState<Raison | null>(null);
  const [cibles, setCibles] = useState<string[]>([]);
  // Chaque ouverture repart d'une feuille vierge.
  useEffect(() => {
    if (visible) {
      setRaison(null);
      setCibles([]);
    }
  }, [visible]);
  const waiting = raison === 'piece' && cibles.length === 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      kicker="Dis-le à Kodi"
      title="Pas pour moi"
      testID="not-for-me-sheet"
      footer={<Button testID="not-for-me-confirm" label={waiting ? 'Choisis la pièce' : 'Une autre tenue'} icon="refresh" disabled={waiting} onPress={() => onConfirm(raison ?? 'sans', raison === 'piece' ? cibles : [])} />}
    >
      <View style={{ gap: 16 }}>
        <T v="body" tone="ink2">
          Pourquoi ? Kodi s’en souviendra pour tes prochaines tenues. Tu peux aussi passer sans rien dire.
        </T>
        <View className="flex-row flex-wrap" style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="La raison">
          {RAISONS.map((r) => {
            const on = raison === r.id;
            // Une capsule pleine : sur le blanc d'une feuille, le verre des puces ne se verrait pas.
            return (
              <Tap
                key={r.id}
                testID={`raison-${r.id}`}
                onPress={() => setRaison(on ? null : r.id)}
                feedback="select"
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={r.label}
                scaleTo={0.97}
                style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center', backgroundColor: on ? c['primary-bg'] : c.pill }}
              >
                <T v="caption" tone={on ? 'primary-fg' : 'ink'} style={F.s500}>
                  {r.label}
                </T>
              </Tap>
            );
          })}
        </View>
        {raison === 'piece' && (
          <View style={{ gap: 10 }}>
            <T v="label" tone="ink2">
              Laquelle ?
            </T>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {pieces.map((p) => {
                const on = cibles.includes(p.id);
                return (
                  <Tap
                    key={p.id}
                    testID={`raison-piece-${p.id}`}
                    onPress={() => setCibles(on ? cibles.filter((x) => x !== p.id) : [...cibles, p.id])}
                    feedback="select"
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={p.name}
                    scaleTo={0.96}
                    style={{ width: 76, gap: 6, alignItems: 'center' }}
                  >
                    <View style={{ width: 76, height: 76, borderRadius: 18, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 1.5 : 1, borderColor: on ? c.ink : c['card-edge'] }}>
                      <Garment kind={p.kind} tint={p.tint} image={p.image} size={52} dark={scheme === 'dark'} label={p.name} />
                      {on && (
                        <View style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: c['primary-bg'], alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="check" size={12} color={c['primary-fg']} strokeWidth={2.4} flat />
                        </View>
                      )}
                    </View>
                    <T v="small" tone={on ? 'ink' : 'ink2'} numberOfLines={1} style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 11 }}>
                      {p.name}
                    </T>
                  </Tap>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </Sheet>
  );
}
