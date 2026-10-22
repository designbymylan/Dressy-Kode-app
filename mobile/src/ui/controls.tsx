import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Tap } from './Tap';
import { T } from './T';
import { Icon, type IconName } from './Icon';
import { BlueGlass } from './Glass';
import { useTheme } from '../theme/ThemeProvider';
import { material, motion } from '../theme/tokens';
import { F } from '../theme/fonts';

/** Puce de filtre ou de choix (globals.css : `.chip`) : verre clair, verre bleu et texte noir quand elle est choisie (21/10). */
export function Chip({ label, on, onPress, icon, count, testID, dot }: { label: string; on?: boolean; onPress: () => void; icon?: IconName; count?: number; testID?: string; dot?: string }) {
  const { c, scheme } = useTheme();
  return (
    <Tap
      testID={testID}
      onPress={onPress}
      feedback="select"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!on }}
      accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
      hitSlop={4}
      style={[
        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 40, borderRadius: 20, borderWidth: 1 },
        on
          ? { backgroundColor: c.blue, borderColor: 'transparent', ...material.blue[scheme] }
          : { backgroundColor: c['glass-strong'], borderColor: c['glass-border'] },
      ]}
    >
      {on && <BlueGlass radius={20} />}
      {icon && (
        <View style={{ marginRight: 6 }}>
          <Icon name={icon} size={16} color={on ? c['on-blue'] : c.ink} strokeWidth={1.8} />
        </View>
      )}
      {dot && <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: dot, marginRight: 7, borderWidth: 1, borderColor: on ? c['on-blue'] : c.rule }} />}
      <T v="caption" tone={on ? 'on-blue' : 'ink'} style={[on ? F.s600 : F.s500, { fontSize: 13.5 }]}>
        {label}
      </T>
      {count !== undefined && (
        <T v="caption" tone={on ? 'on-blue' : 'ink2'} style={{ marginLeft: 6 }}>
          {count}
        </T>
      )}
    </Tap>
  );
}

/**
 * Segment de verre à curseur bleu (globals.css : `.segment`, 21/10), pour
 * basculer entre deux vues (Portants / Grille). Le curseur glisse d'une
 * option à l'autre.
 */
export function Segmented<V extends string>({ options, value, onChange, label }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; label: string }) {
  return <SegmentTrack options={options} value={value} onChange={onChange} label={label} role="tablist" idPrefix="seg" compact />;
}

function SegmentTrack<V extends string>({ options, value, onChange, label, role, idPrefix, compact }: { options: { value: V; label: string; icon?: IconName }[]; value: V; onChange: (v: V) => void; label: string; role: 'tablist' | 'radiogroup'; idPrefix: string; compact?: boolean }) {
  const { c } = useTheme();
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const w = useSharedValue(0);
  const x = useSharedValue(index);
  useEffect(() => {
    x.value = withSpring(index, motion.spring);
  }, [index, x]);
  const thumb = useAnimatedStyle(() => ({ width: w.value, transform: [{ translateX: x.value * w.value }] }));
  const h = compact ? 32 : 38;
  return (
    <View
      accessibilityRole={role}
      accessibilityLabel={label}
      onLayout={(e) => (w.value = (e.nativeEvent.layout.width - 6) / options.length)}
      className="flex-row"
      style={[{ padding: 3, borderRadius: 999, backgroundColor: c.pill }, compact && { alignSelf: 'flex-start', width: options.length * 108 + 6 }]}
    >
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: 999, backgroundColor: c.blue, shadowColor: '#4B7DA5', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, thumb]}>
        <BlueGlass radius={h / 2} />
      </Animated.View>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Tap
            key={o.value}
            testID={`${idPrefix}-${o.value}`}
            onPress={() => onChange(o.value)}
            feedback="select"
            scaleTo={0.97}
            accessibilityRole={role === 'tablist' ? 'tab' : 'radio'}
            accessibilityState={role === 'tablist' ? { selected: on } : { checked: on }}
            accessibilityLabel={o.label}
            outerStyle={{ flexGrow: 1, flexBasis: 0 }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: h, borderRadius: 999, paddingHorizontal: compact ? 16 : 10 }}
          >
            {o.icon && (
              <View style={{ marginRight: 6 }}>
                <Icon name={o.icon} size={16} color={on ? c['on-blue'] : c.ink2} />
              </View>
            )}
            <T v="caption" tone={on ? 'on-blue' : 'ink2'} style={on ? F.s600 : undefined}>
              {o.label}
            </T>
          </Tap>
        );
      })}
    </View>
  );
}

/**
 * Onglets soulignés (05/10, en capitales espacées depuis le 09/10, comme les
 * rayons d'une grande enseigne) : le libellé actif en encre, un trait bleu
 * sous lui (21/10) ; les autres en gris. `right` accueille une action (filtres).
 */
export function UnderlineTabs<V extends string>({ options, value, onChange, label, right }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; label: string; right?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View className="flex-row items-center justify-between" style={{ borderBottomWidth: 1, borderColor: c.rule }}>
      <View accessibilityRole="tablist" accessibilityLabel={label} className="flex-row" style={{ gap: 18 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Tap
              key={o.value}
              testID={`seg-${o.value}`}
              onPress={() => onChange(o.value)}
              feedback="select"
              scaleTo={1}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
              style={{ height: 44, justifyContent: 'center', paddingHorizontal: 1 }}
            >
              <T v="label" tone={on ? 'ink' : 'ink2'}>
                {o.label}
              </T>
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, borderRadius: 1, backgroundColor: on ? c['blue-ink'] : 'transparent' }} />
            </Tap>
          );
        })}
      </View>
      {right}
    </View>
  );
}

/** Sélecteur en capsule pour les réglages (Auto / Clair / Sombre) : le même segment de verre, pleine largeur. */
export function SegmentedPill<V extends string>({ options, value, onChange, label }: { options: { value: V; label: string; icon?: IconName }[]; value: V; onChange: (v: V) => void; label: string }) {
  return <SegmentTrack options={options} value={value} onChange={onChange} label={label} role="radiogroup" idPrefix="pill" />;
}

/** Interrupteur maison : contour à 3:1 quand il est éteint (WCAG 1.4.11), bleu quand il est allumé (21/10). */
export function Toggle({ value, onChange, label, testID }: { value: boolean; onChange: (v: boolean) => void; label: string; testID?: string }) {
  const { c } = useTheme();
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.value = withSpring(value ? 1 : 0, motion.snappy);
  }, [value, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 20 }] }));
  return (
    <Tap
      testID={testID}
      onPress={() => onChange(!value)}
      feedback="select"
      scaleTo={1}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      hitSlop={8}
      style={{ width: 51, height: 31, borderRadius: 16, borderWidth: 1.5, borderColor: value ? c['blue-ink'] : c.control, backgroundColor: value ? c.blue : c['glass-strong'], justifyContent: 'center', paddingHorizontal: 2 }}
    >
      <Animated.View style={[{ width: 24, height: 24, borderRadius: 12, backgroundColor: value ? c['blue-ink'] : c.control, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }, knob]} />
    </Tap>
  );
}

/** − valeur + : pour les mesures, sans clavier. */
export function Stepper({ value, onChange, min, max, step = 1, unit, label }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit: string; label: string }) {
  const { c } = useTheme();
  const btn = (dir: -1 | 1) => (
    <Tap
      testID={`step-${label}-${dir > 0 ? 'plus' : 'moins'}`}
      onPress={() => onChange(Math.min(max, Math.max(min, value + dir * step)))}
      feedback="select"
      accessibilityLabel={`${dir > 0 ? 'Augmenter' : 'Diminuer'} ${label}`}
      disabled={dir < 0 ? value <= min : value >= max}
      style={{ alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c['glass-border'], backgroundColor: c['glass-strong'], opacity: (dir < 0 ? value <= min : value >= max) ? 0.4 : 1 }}
    >
      <Icon name={dir > 0 ? 'plus' : 'minus'} size={18} color={c.ink} strokeWidth={1.9} />
    </Tap>
  );
  return (
    <View className="flex-row items-center" style={{ gap: 12 }} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: `${value} ${unit}` }}>
      {btn(-1)}
      <T v="cardTitle" style={{ minWidth: 76, textAlign: 'center' }}>
        {value}
        <T v="caption" tone="ink2"> {unit}</T>
      </T>
      {btn(1)}
    </View>
  );
}

/** Pastille de couleur (choix de teintes). */
export function Swatch({ hex, on, onPress, label, size = 44 }: { hex: string; on: boolean; onPress: () => void; label: string; size?: number }) {
  const { c } = useTheme();
  return (
    <Tap onPress={onPress} feedback="select" accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size / 2, padding: 3, borderWidth: 2, borderColor: on ? c['blue-ink'] : 'transparent' }}>
      <View style={{ flex: 1, borderRadius: size / 2, backgroundColor: hex, borderWidth: 1, borderColor: c.rule }} className="items-center justify-center">
        {on && <Icon name="check" size={16} color={isLight(hex) ? '#1C1A17' : '#FFFFFF'} strokeWidth={2.4} />}
      </View>
    </Tap>
  );
}

export function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}
