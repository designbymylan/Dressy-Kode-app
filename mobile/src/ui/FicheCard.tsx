import { View } from 'react-native';
import { completion, fieldOf, fieldsFor, valueOf, type FieldId } from '../data/fiche';
import type { Piece } from '../data/wardrobe';
import { useTheme } from '../theme/ThemeProvider';
import { T } from './T';
import { Tap } from './Tap';
import { Button } from './Button';
import { Icon } from './Icon';
import { Card } from './bits';

/** Les rubriques de la fiche : ce qu'on lit sur l'étiquette, l'usage, puis l'origine et l'achat. */
const GROUPS: { title: string; ids: FieldId[] }[] = [
  { title: 'Matière et coupe', ids: ['composition', 'taille', 'coupe', 'manches', 'longueur', 'motif', 'particularites'] },
  { title: 'Usage', ids: ['saison', 'entretien', 'occasions', 'etat'] },
  { title: 'Origine et achat', ids: ['marque', 'pays', 'achatLieu', 'achatDate', 'prix'] },
];

function FieldRow({ piece, id, last, onEdit }: { piece: Piece; id: FieldId; last: boolean; onEdit: (id: FieldId) => void }) {
  const { c } = useTheme();
  const def = fieldOf(id);
  const value = valueOf(id, piece);
  return (
    <Tap
      testID={`fiche-row-${id}`}
      onPress={() => onEdit(id)}
      scaleTo={0.99}
      accessibilityLabel={`${def.label}, ${value || 'à renseigner'}`}
      accessibilityHint="Ouvre le menu de choix"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: last ? 0 : 1, borderColor: c.rule }}
    >
      <T v="caption" tone="ink2" style={{ width: 108 }}>
        {def.label}
      </T>
      <View style={{ flex: 1, alignItems: 'flex-end', paddingVertical: 8 }}>
        {value ? (
          <T v="body" numberOfLines={2} style={{ textAlign: 'right' }}>
            {value}
          </T>
        ) : (
          <T v="body" tone="blue-ink">
            Ajouter
          </T>
        )}
      </View>
      <Icon name={value ? 'chevron' : 'plus'} size={value ? 18 : 16} color={value ? c.ink2 : c['blue-ink']} />
    </Tap>
  );
}

/**
 * La fiche technique d'une pièce (27/10) : chaque ligne s'ouvre sur un menu
 * de choix. En tête, la part déjà renseignée et un pas à pas qui enchaîne les
 * champs vides, sans clavier quand un choix suffit.
 */
export function FicheCard({ piece, onEdit, onGuide }: { piece: Piece; onEdit: (id: FieldId) => void; onGuide: (ids: FieldId[]) => void }) {
  const { c } = useTheme();
  const { done, total, missing } = completion(piece);
  const shown = new Set(fieldsFor(piece).map((f) => f.id));
  return (
    <Card testID="fiche" style={{ gap: 14, padding: 16 }}>
      <View style={{ gap: 8 }}>
        <View className="flex-row items-baseline justify-between">
          <T v="bodyStrong" accessibilityRole="header">
            La fiche
          </T>
          <T v="kicker" tone="ink2" testID="fiche-count">
            {`${done} sur ${total}`}
          </T>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.pill, overflow: 'hidden' }} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: done }}>
          <View style={{ width: `${Math.round((done / total) * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: c.blue }} />
        </View>
        {missing.length > 0 ? (
          <Button testID="fiche-guide" label={done === 0 ? 'Remplir la fiche' : `Compléter · ${missing.length} à renseigner`} size="m" variant="secondary" icon="edit" onPress={() => onGuide(missing)} />
        ) : (
          <T v="caption" tone="positive">
            La fiche est complète.
          </T>
        )}
      </View>
      {GROUPS.map((g) => {
        const ids = g.ids.filter((id) => shown.has(id));
        return (
          <View key={g.title}>
            <T v="label" tone="ink2" style={{ marginBottom: 2 }}>
              {g.title}
            </T>
            {ids.map((id, i) => (
              <FieldRow key={id} piece={piece} id={id} last={i === ids.length - 1} onEdit={onEdit} />
            ))}
          </View>
        );
      })}
    </Card>
  );
}
