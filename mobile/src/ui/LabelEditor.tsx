import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { CATEGORIES, COLOURS, SEASONS, type CategoryId, type Piece, type Season } from '../data/wardrobe';
import type { GarmentKind } from './Garment';
import { useTheme } from '../theme/ThemeProvider';
import { F } from '../theme/fonts';
import { T } from './T';
import { Button } from './Button';
import { Chip } from './controls';
import { Sheet } from './Sheet';

/** Le type d'illustration par défaut quand la catégorie change. */
const KIND_FOR: Record<CategoryId, GarmentKind> = { manteaux: 'veste', hauts: 'tshirt', bas: 'pantalon', robes: 'robe', chaussures: 'baskets', accessoires: 'sac' };

/** « 12,99 » ou « 12.99 » → 12.99 ; vide → pas de prix ; illisible → null. */
function readPrice(text: string): number | undefined | null {
  const t = text.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}

const priceText = (n?: number) => (n == null ? '' : String(n).replace('.', ','));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T v="kicker" tone="ink2">
        {label}
      </T>
      {children}
    </View>
  );
}

/**
 * L'étiquette d'une pièce, corrigée à la main : quand Kodi s'est trompé de
 * nom, de couleur ou de matière, ou pour noter le prix. Rien n'est perdu
 * tant que « Enregistrer » n'est pas touché.
 */
export function LabelEditor({ piece, visible, onClose, onSave }: { piece: Piece; visible: boolean; onClose: () => void; onSave: (p: Piece) => void }) {
  const { c } = useTheme();
  const [name, setName] = useState(piece.name);
  const [category, setCategory] = useState<CategoryId>(piece.category);
  const [colorId, setColorId] = useState<string | undefined>(piece.colorId ?? COLOURS.find((x) => x.label === piece.color)?.id);
  const [material, setMaterial] = useState(piece.material);
  const [season, setSeason] = useState<Season>(piece.season);
  const [price, setPrice] = useState(priceText(piece.price));

  // Chaque ouverture repart de l'étiquette enregistrée.
  useEffect(() => {
    if (!visible) return;
    setName(piece.name);
    setCategory(piece.category);
    setColorId(piece.colorId ?? COLOURS.find((x) => x.label === piece.color)?.id);
    setMaterial(piece.material);
    setSeason(piece.season);
    setPrice(priceText(piece.price));
  }, [visible, piece]);

  const parsed = readPrice(price);
  const ok = name.trim().length > 0 && parsed !== null;
  const input = { minHeight: 50, borderRadius: 25, paddingHorizontal: 18, color: c.ink, ...F.s400, fontSize: 16 } as const;

  const save = () => {
    if (!ok) return;
    const colour = COLOURS.find((x) => x.id === colorId);
    const colourChanged = colorId !== (piece.colorId ?? COLOURS.find((x) => x.label === piece.color)?.id);
    // La teinte mesurée par Kodi reste tant que la couleur ne change pas.
    const tint = colourChanged && colour ? colour.hex : piece.tint;
    onSave({
      ...piece,
      name: name.trim(),
      category,
      kind: category === piece.category ? piece.kind : KIND_FOR[category],
      colorId: colour?.id,
      color: colour?.label ?? piece.color,
      tint,
      swatch: tint ?? colour?.hex ?? piece.swatch,
      material: material.trim(),
      season,
      price: parsed ?? undefined,
    });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      kicker="L’étiquette"
      title="Modifier l’étiquette"
      testID="label-editor"
      footer={<Button testID="label-save" label="Enregistrer" disabled={!ok} onPress={save} />}
    >
      <View style={{ gap: 20, paddingBottom: 8 }}>
        <Field label="Nom">
          <TextInput testID="label-name" value={name} onChangeText={setName} maxLength={60} placeholder="Par exemple : short en jean délavé" placeholderTextColor={c.ink2} accessibilityLabel="Nom de la pièce" className="bg-sunk" style={input} />
        </Field>

        <Field label="Catégorie">
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {CATEGORIES.map((x) => (
              <Chip key={x.id} testID={`label-cat-${x.id}`} label={x.short} on={category === x.id} onPress={() => setCategory(x.id)} />
            ))}
          </View>
        </Field>

        <Field label="Couleur">
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {COLOURS.map((x) => (
              <Chip key={x.id} testID={`label-colour-${x.id}`} label={x.label} dot={x.hex} on={colorId === x.id} onPress={() => setColorId(x.id)} />
            ))}
          </View>
        </Field>

        <Field label="Matière">
          <TextInput testID="label-material" value={material} onChangeText={setMaterial} maxLength={80} placeholder="Par exemple : denim de coton" placeholderTextColor={c.ink2} accessibilityLabel="Matière" className="bg-sunk" style={input} />
        </Field>

        <Field label="Saison">
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {SEASONS.map((x) => (
              <Chip key={x} testID={`label-season-${x}`} label={x[0].toUpperCase() + x.slice(1)} on={season === x} onPress={() => setSeason(x)} />
            ))}
          </View>
        </Field>

        <Field label="Prix d’achat">
          <TextInput
            testID="label-price"
            value={price}
            onChangeText={setPrice}
            maxLength={9}
            keyboardType="decimal-pad"
            placeholder="Par exemple : 39,90"
            placeholderTextColor={c.ink2}
            accessibilityLabel="Prix d’achat en euros"
            className="bg-sunk"
            style={input}
          />
          {parsed === null ? (
            <T v="small" tone="caution">
              Un prix en euros, par exemple 39,90.
            </T>
          ) : (
            <T v="small" tone="ink2">
              Il sert à calculer le coût par port. Tu peux le laisser vide.
            </T>
          )}
        </Field>
      </View>
    </Sheet>
  );
}
