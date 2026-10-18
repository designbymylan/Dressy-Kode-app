/**
 * Les briques de la planification (07/10) : la grille d'un mois, le choix
 * d'une heure, des puces à choix simple ou multiple, un choix de date.
 */
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { MONTHS } from '../data/wardrobe';
import { useTheme } from '../theme/ThemeProvider';
import { isoFromDate, isoOf, monthGrid, timeLabel, type Iso } from '../state/planning';
import { T } from './T';
import { Tap } from './Tap';
import { IconButton } from './Button';
import { Chip } from './controls';

export const WEEK_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** « Octobre 2026 » ; l'année seulement quand ce n'est pas l'année en cours. */
export function monthTitle(year: number, month: number) {
  return `${cap(MONTHS[month])}${year !== new Date().getFullYear() ? ` ${year}` : ''}`;
}

/** Le mois affiché et ses flèches ; on ne remonte pas avant `min` (mois depuis aujourd'hui) ni au-delà de `max`. */
export function MonthNav({ at, onChange, min = -1, max = 12, testID }: { at: number; onChange: (at: number) => void; min?: number; max?: number; testID?: string }) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + at, 1);
  return (
    <View className="flex-row items-center justify-between">
      <T v="hero" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 34 }}>
        {monthTitle(d.getFullYear(), d.getMonth())}
      </T>
      <View className="flex-row" style={{ gap: 6 }}>
        <View style={{ opacity: at <= min ? 0.3 : 1 }} pointerEvents={at <= min ? 'none' : 'auto'}>
          <IconButton testID={testID ? `${testID}-prev` : undefined} icon="back" label="Mois précédent" variant="quiet" size={40} onPress={() => onChange(at - 1)} />
        </View>
        <View style={{ opacity: at >= max ? 0.3 : 1 }} pointerEvents={at >= max ? 'none' : 'auto'}>
          <IconButton testID={testID ? `${testID}-next` : undefined} icon="chevron" label="Mois suivant" variant="quiet" size={40} onPress={() => onChange(at + 1)} />
        </View>
      </View>
    </View>
  );
}

export type CellState = {
  selected?: boolean;
  /** Entre deux dates choisies (un voyage). */
  inRange?: boolean;
  disabled?: boolean;
};

/**
 * La grille d'un mois, lundi en premier. `cell` dessine le contenu de chaque
 * case (vignette de tenue, points des rendez-vous) ; la grille s'occupe de la
 * forme, de l'état choisi, d'aujourd'hui et des jours passés.
 */
export function MonthGrid({
  at,
  width,
  cellHeight = 64,
  state,
  onPick,
  cell,
  label,
  testID,
}: {
  at: number;
  width: number;
  cellHeight?: number;
  state?: (iso: Iso) => CellState;
  onPick: (iso: Iso) => void;
  cell?: (iso: Iso, on: boolean) => ReactNode;
  label?: (iso: Iso) => string;
  testID?: string;
}) {
  const { c } = useTheme();
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + at, 1);
  const weeks = monthGrid(d.getFullYear(), d.getMonth());
  const today = isoOf(0);
  const gap = 4;
  const col = Math.floor((width - gap * 6) / 7);
  return (
    <View style={{ gap: 6 }} testID={testID}>
      <View className="flex-row" style={{ gap }}>
        {WEEK_LETTERS.map((l, i) => (
          <T key={i} v="kicker" tone="ink2" style={{ width: col, textAlign: 'center' }}>
            {l}
          </T>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} className="flex-row" style={{ gap }}>
          {week.map((iso, k) => {
            if (!iso) return <View key={k} style={{ width: col, height: cellHeight }} />;
            const st = state?.(iso) ?? {};
            const past = iso < today;
            const on = !!st.selected;
            const fg = on ? c['primary-fg'] : c.ink;
            const day = Number(iso.slice(8, 10));
            return (
              <Tap
                key={iso}
                testID={testID ? `${testID}-${iso}` : undefined}
                onPress={() => onPick(iso)}
                disabled={st.disabled}
                feedback="select"
                scaleTo={0.94}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: !!st.disabled }}
                accessibilityLabel={label?.(iso) ?? iso}
                style={{
                  width: col,
                  height: cellHeight,
                  borderRadius: 16,
                  alignItems: 'center',
                  paddingTop: 6,
                  gap: 3,
                  backgroundColor: on ? c['primary-bg'] : st.inRange ? c.stage : 'transparent',
                  borderWidth: iso === today && !on ? 1.5 : 0,
                  borderColor: c.ink,
                  opacity: st.disabled ? 0.3 : past && !on ? 0.45 : 1,
                }}
              >
                <T v="bodyStrong" style={{ color: fg, fontSize: 15, lineHeight: 18 }}>
                  {String(day)}
                </T>
                {cell?.(iso, on)}
              </Tap>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** L'heure d'un rendez-vous : « Dans la journée », ou une heure et ses quarts. */
export function TimePicker({ value, onChange, testID }: { value: string | null; onChange: (v: string | null) => void; testID?: string }) {
  const hour = value ? Number(value.slice(0, 2)) : null;
  const minute = value ? value.slice(3, 5) : '00';
  const set = (h: number, m: string) => onChange(`${String(h).padStart(2, '0')}:${m}`);
  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
        <Chip testID={testID ? `${testID}-none` : undefined} label="Dans la journée" on={value === null} onPress={() => onChange(null)} />
        {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => (
          <Chip key={h} testID={testID ? `${testID}-${h}` : undefined} label={`${h} h`} on={hour === h} onPress={() => set(h, minute)} />
        ))}
      </ScrollView>
      {hour !== null && (
        <View className="flex-row" style={{ gap: 8 }}>
          {['00', '15', '30', '45'].map((m) => (
            <Chip key={m} label={timeLabel(`${String(hour).padStart(2, '0')}:${m}`) ?? m} on={minute === m} onPress={() => set(hour, m)} />
          ))}
        </View>
      )}
    </View>
  );
}

/** Des puces : une seule à la fois (`multi` faux), ou plusieurs, jusqu'à `max`. */
export function ChoiceChips({
  options,
  value,
  onChange,
  multi,
  max,
  testID,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  multi?: boolean;
  max?: number;
  testID?: string;
}) {
  const toggle = (o: string) => {
    const on = value.includes(o);
    if (!multi) return onChange(on ? [] : [o]);
    if (on) return onChange(value.filter((x) => x !== o));
    if (max && value.length >= max) return onChange([...value.slice(1), o]);
    onChange([...value, o]);
  };
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {options.map((o) => (
        <Chip key={o} testID={testID ? `${testID}-${o}` : undefined} label={o} on={value.includes(o)} onPress={() => toggle(o)} />
      ))}
    </View>
  );
}

/** Le premier jour du mois à `at` mois d'aujourd'hui, pour savoir quel mois montrer d'une date. */
export function monthAt(iso: Iso): number {
  const now = new Date();
  const [y, m] = iso.split('-').map(Number);
  return (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
}

export const firstOfMonth = (at: number) => {
  const now = new Date();
  return isoFromDate(new Date(now.getFullYear(), now.getMonth() + at, 1));
};
