import { useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { FIBRES, LIEUX, PAYS, cap, fieldOf, optionsOf, setField, sizeGroups, valueOf, type Answer, type FieldId, type Fiche } from '../data/fiche';
import type { Piece } from '../data/wardrobe';
import { useTheme } from '../theme/ThemeProvider';
import { F } from '../theme/fonts';
import { T } from './T';
import { Tap } from './Tap';
import { Button } from './Button';
import { Chip, Stepper } from './controls';
import { Sheet } from './Sheet';

type Props = {
  piece: Piece;
  /** Le champ ouvert ; null : feuille fermée. */
  field: FieldId | null;
  /** Dans le pas à pas : « 2 sur 7 » et un bouton pour passer. */
  step?: { n: number; total: number };
  onClose: () => void;
  /** La pièce mise à jour ; `next` : le pas à pas passe au champ suivant. */
  onSave: (p: Piece, next: boolean) => void;
  onSkip?: () => void;
};

/** « 12,99 » ou « 12.99 » → 12.99 ; vide → pas de prix ; illisible → null. */
function readPrice(text: string): number | undefined | null {
  const t = text.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}

const NOW = new Date();
const YEARS = Array.from({ length: 15 }, (_, i) => String(NOW.getFullYear() - i));
const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

/**
 * La feuille d'un champ de la fiche : un menu de choix (puces) pour presque
 * tout, un clavier seulement pour la marque, le prix ou une taille hors liste.
 * Un choix simple s'enregistre au toucher ; les autres se valident.
 */
export function FieldSheet({ piece, field, step, onClose, onSave, onSkip }: Props) {
  const { c } = useTheme();
  // Garde le dernier champ affiché pendant la sortie de la feuille.
  const [shown, setShown] = useState<FieldId>('composition');
  useEffect(() => {
    if (field) setShown(field);
  }, [field]);
  const id = field ?? shown;
  const def = fieldOf(id);
  const current = valueOf(id, piece);

  const [text, setText] = useState('');
  const [multi, setMulti] = useState<string[]>([]);
  const [comp, setComp] = useState<NonNullable<Fiche['composition']>>([]);
  const [lieu, setLieu] = useState<string | undefined>();
  const [year, setYear] = useState<string | undefined>();
  const [month, setMonth] = useState<number | undefined>();
  const [search, setSearch] = useState('');

  // Chaque ouverture, et chaque champ du pas à pas, repart de la valeur enregistrée.
  useEffect(() => {
    if (!field) return;
    const f = piece.fiche ?? {};
    setSearch('');
    setText(field === 'marque' ? (piece.brand ?? '') : field === 'prix' ? (piece.price != null ? String(piece.price).replace('.', ',') : '') : field === 'taille' ? '' : f.achatEnseigne ?? '');
    setMulti(field === 'particularites' ? (f.particularites ?? []) : field === 'occasions' ? (f.occasions ?? []) : []);
    setComp(f.composition ?? []);
    setLieu(f.achatLieu);
    setYear(f.achatDate?.slice(0, 4));
    setMonth(f.achatDate?.length === 7 ? Number(f.achatDate.slice(5)) : undefined);
  }, [field]); // eslint-disable-line react-hooks/exhaustive-deps

  const input = { minHeight: 50, borderRadius: 25, paddingHorizontal: 18, color: c.ink, ...F.s400, fontSize: 16 } as const;
  const save = (v: Answer, next = true) => onSave(setField(piece, id, v), next);
  const options = useMemo(() => optionsOf(id, piece), [id, piece]);

  const price = readPrice(text);
  const total = comp.reduce((n, x) => n + x.pct, 0);

  /* ---- Composition : des fibres, chacune sa part, jusqu'à 100 % ---- */
  const toggleFibre = (fibre: string) => {
    const at = comp.findIndex((x) => x.fibre === fibre);
    if (at >= 0) return setComp(comp.filter((_, i) => i !== at));
    if (comp.length >= 6) return;
    if (!comp.length) return setComp([{ fibre, pct: 100 }]);
    const left = 100 - total;
    if (left > 0) return setComp([...comp, { fibre, pct: left }]);
    // Plein : la nouvelle fibre prend 10 % à la plus présente.
    const top = comp.reduce((m, x, i) => (x.pct > comp[m].pct ? i : m), 0);
    if (comp[top].pct <= 10) return;
    setComp([...comp.map((x, i) => (i === top ? { ...x, pct: x.pct - 10 } : x)), { fibre, pct: 10 }]);
  };
  const setPct = (i: number, pct: number) =>
    // À deux fibres, l'autre suit : le total reste juste sans y penser.
    setComp(comp.length === 2 ? comp.map((x, j) => ({ ...x, pct: j === i ? pct : 100 - pct })) : comp.map((x, j) => (j === i ? { ...x, pct } : x)));

  const remove = current && id !== 'saison' ? (
    <T v="label" tone="ink2" onPress={() => save(undefined, false)} accessibilityRole="button" suppressHighlighting testID="fiche-remove" style={{ alignSelf: 'center', paddingVertical: 12 }}>
      Retirer cette information
    </T>
  ) : null;

  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  if (def.kind === 'single') {
    // Une valeur déjà notée hors liste (venue de Kodi) reste choisie.
    const list = current && !options.some((o) => o.toLowerCase() === current.toLowerCase()) ? [current, ...options] : options;
    body = (
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {list.map((o) => (
          <Chip key={o} testID={`fiche-opt-${o}`} label={cap(o)} on={current.toLowerCase() === o.toLowerCase()} onPress={() => save(o)} />
        ))}
      </View>
    );
  } else if (def.kind === 'multi') {
    const toggle = (o: string) => setMulti(multi.includes(o) ? multi.filter((x) => x !== o) : [...multi, o]);
    body = (
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {options.map((o) => (
          <Chip key={o} testID={`fiche-opt-${o}`} label={o} on={multi.includes(o)} onPress={() => toggle(o)} />
        ))}
      </View>
    );
    footer = <Button testID="fiche-save" label="Valider" onPress={() => save(multi)} />;
  } else if (def.kind === 'size') {
    body = (
      <View style={{ gap: 18 }}>
        {sizeGroups(piece.category).map((g) => (
          <View key={g.title} style={{ gap: 8 }}>
            <T v="kicker" tone="ink2">
              {g.title}
            </T>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {g.options.map((o) => (
                <Chip key={o} testID={`fiche-opt-${o}`} label={o} on={current === o} onPress={() => save(o)} />
              ))}
            </View>
          </View>
        ))}
        <View style={{ gap: 8 }}>
          <T v="kicker" tone="ink2">
            Une autre
          </T>
          <TextInput testID="fiche-text" value={text} onChangeText={setText} maxLength={20} placeholder="Par exemple : 42/44, 95C" placeholderTextColor={c.ink2} accessibilityLabel="Une autre taille" className="bg-sunk" style={input} />
        </View>
      </View>
    );
    footer = <Button testID="fiche-save" label="Enregistrer" disabled={!text.trim()} onPress={() => save(text)} />;
  } else if (def.kind === 'text') {
    body = <TextInput testID="fiche-text" value={text} onChangeText={setText} maxLength={60} autoFocus placeholder="Facultatif" placeholderTextColor={c.ink2} accessibilityLabel={def.label} className="bg-sunk" style={input} />;
    footer = <Button testID="fiche-save" label="Enregistrer" disabled={!text.trim()} onPress={() => save(text)} />;
  } else if (def.kind === 'price') {
    body = (
      <View style={{ gap: 8 }}>
        <TextInput testID="fiche-text" value={text} onChangeText={setText} maxLength={9} keyboardType="decimal-pad" autoFocus placeholder="Par exemple : 39,90" placeholderTextColor={c.ink2} accessibilityLabel="Prix d’achat en euros" className="bg-sunk" style={input} />
        <T v="small" tone={price === null ? 'caution' : 'ink2'}>
          {price === null ? 'Un prix en euros, par exemple 39,90.' : 'Il sert à calculer le coût par port.'}
        </T>
      </View>
    );
    footer = <Button testID="fiche-save" label="Enregistrer" disabled={price === null || price === undefined} onPress={() => save(price ?? undefined)} />;
  } else if (def.kind === 'country') {
    const q = search.trim().toLowerCase();
    const shownCountries = q ? PAYS.filter((p) => p.toLowerCase().includes(q)) : PAYS;
    const known = PAYS.some((p) => p.toLowerCase() === current.toLowerCase());
    body = (
      <View style={{ gap: 14 }}>
        <TextInput testID="fiche-search" value={search} onChangeText={setSearch} maxLength={40} placeholder="Chercher un pays" placeholderTextColor={c.ink2} accessibilityLabel="Chercher un pays" className="bg-sunk" style={input} />
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {current && !known && !q ? <Chip label={current} on onPress={() => save(current)} /> : null}
          {shownCountries.map((p) => (
            <Chip key={p} testID={`fiche-opt-${p}`} label={p} on={current === p} onPress={() => save(p)} />
          ))}
          {q && !shownCountries.some((p) => p.toLowerCase() === q) ? <Chip label={`Écrire « ${search.trim()} »`} onPress={() => save(search)} /> : null}
        </View>
      </View>
    );
  } else if (def.kind === 'shop') {
    body = (
      <View style={{ gap: 18 }}>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {LIEUX.map((o) => (
            <Chip key={o} testID={`fiche-opt-${o}`} label={o} on={lieu === o} onPress={() => setLieu(lieu === o ? undefined : o)} />
          ))}
        </View>
        <View style={{ gap: 8 }}>
          <T v="kicker" tone="ink2">
            Où exactement ? (facultatif)
          </T>
          <TextInput testID="fiche-text" value={text} onChangeText={setText} maxLength={60} placeholder="Le magasin, le site, la personne" placeholderTextColor={c.ink2} accessibilityLabel="Où exactement" className="bg-sunk" style={input} />
        </View>
      </View>
    );
    footer = <Button testID="fiche-save" label="Enregistrer" disabled={!lieu && !text.trim()} onPress={() => save({ lieu, enseigne: text.trim() || undefined })} />;
  } else if (def.kind === 'date') {
    body = (
      <View style={{ gap: 18 }}>
        <View style={{ gap: 8 }}>
          <T v="kicker" tone="ink2">
            Année
          </T>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {YEARS.map((y) => (
              <Chip key={y} testID={`fiche-opt-${y}`} label={y} on={year === y} onPress={() => { setYear(y); if (y !== year) setMonth(undefined); }} />
            ))}
          </View>
        </View>
        {year && (
          <View style={{ gap: 8 }}>
            <T v="kicker" tone="ink2">
              Mois (facultatif)
            </T>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {MONTHS.map((m, i) => (
                <Chip key={m} testID={`fiche-opt-m${i + 1}`} label={m} on={month === i + 1} onPress={() => setMonth(month === i + 1 ? undefined : i + 1)} />
              ))}
            </View>
          </View>
        )}
      </View>
    );
    footer = <Button testID="fiche-save" label="Enregistrer" disabled={!year} onPress={() => save(month ? `${year}-${String(month).padStart(2, '0')}` : year)} />;
  } else if (def.kind === 'composition') {
    const ok = comp.length === 0 || total === 100;
    body = (
      <View style={{ gap: 18 }}>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {FIBRES.map((f) => (
            <Chip key={f} testID={`fiche-opt-${f}`} label={f} on={comp.some((x) => x.fibre === f)} onPress={() => toggleFibre(f)} />
          ))}
        </View>
        {comp.length > 0 && (
          <View style={{ gap: 10 }}>
            {comp.map((x, i) => (
              <View key={x.fibre} className="flex-row items-center justify-between" style={{ gap: 10 }}>
                <T v="bodyStrong" style={{ flexShrink: 1 }} numberOfLines={1}>
                  {x.fibre}
                </T>
                <Stepper label={x.fibre} unit="%" value={x.pct} min={5} max={comp.length === 2 ? 95 : 100} step={5} onChange={(v) => setPct(i, v)} />
              </View>
            ))}
            <T v="small" tone={ok ? 'positive' : 'caution'}>
              {ok ? 'Total : 100 %' : total < 100 ? `Il manque ${100 - total} % pour arriver à 100 %.` : `Il y a ${total - 100} % de trop.`}
            </T>
          </View>
        )}
      </View>
    );
    footer = <Button testID="fiche-save" label="Enregistrer" disabled={!ok} onPress={() => save(comp.length ? comp : undefined)} />;
  }

  return (
    <Sheet
      visible={!!field}
      onClose={onClose}
      kicker={step ? `La fiche · ${step.n} sur ${step.total}` : def.label}
      title={def.ask}
      testID={`fiche-sheet-${id}`}
      footer={
        footer || step ? (
          <View style={{ gap: 6 }}>
            {footer}
            {step && onSkip && (
              <Tap testID="fiche-skip" onPress={onSkip} accessibilityLabel="Passer ce champ" style={{ alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 }}>
                <T v="label" tone="ink2">
                  Passer
                </T>
              </Tap>
            )}
          </View>
        ) : undefined
      }
    >
      <View style={{ gap: 8, paddingBottom: 8 }}>
        {body}
        {!step && remove}
      </View>
    </Sheet>
  );
}
