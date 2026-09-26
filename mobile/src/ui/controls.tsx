import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Tap } from './Tap';
import { T } from './T';
import { Icon, type IconName } from './Icon';
import { useTheme } from '../theme/ThemeProvider';
import { motion } from '../theme/tokens';

/** Puce de filtre ou de choix : pleine quand elle est active, contour sinon. */
export function Chip({ label, on, onPress, icon, count, testID, dot }: { label: string; on?: boolean; onPress: () => void; icon?: IconName; count?: number; testID?: string; dot?: string }) {
  const { c } = useTheme();
  return (
    <Tap
      testID={testID}
      onPress={onPress}
      feedback="select"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!on }}
      accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
      hitSlop={4}
      style={{ height: 36, borderRadius: 18 }}
      className={`flex-row items-center px-4 ${on ? 'bg-primary-bg' : 'border border-rule-strong'}`}
    >
      {icon && (
        <View style={{ marginRight: 6 }}>
          <Icon name={icon} size={16} color={on ? c['primary-fg'] : c.ink} strokeWidth={1.8} />
        </View>
      )}
      {dot && <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: dot, marginRight: 7, borderWidth: 1, borderColor: on ? c['primary-fg'] : c.rule }} />}
      <T v="caption" tone={on ? 'primary-fg' : 'ink'} style={{ fontFamily: 'HankenGrotesk_600SemiBold' }}>
        {label}
      </T>
      {count !== undefined && (
        <T v="caption" tone={on ? 'primary-fg' : 'ink2'} style={{ marginLeft: 6 }}>
          {count}
        </T>
      )}
    </Tap>
  );
}

/** Onglets soulignés, façon sommaire de magazine (Portants / Grille). */
export function Segmented<V extends string>({ options, value, onChange, label }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; label: string }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} className="flex-row" style={{ gap: 20 }}>
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
            style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' }}
          >
            <View style={{ paddingBottom: 4, borderBottomWidth: 1.5 }} className={on ? 'border-ink' : 'border-transparent'}>
              <T v="bodyStrong" tone={on ? 'ink' : 'ink2'} style={{ fontSize: 14.5, fontFamily: on ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium' }}>
                {o.label}
              </T>
            </View>
          </Tap>
        );
      })}
    </View>
  );
}

/** Sélecteur en capsule pour les réglages (Auto / Clair / Sombre). */
export function SegmentedPill<V extends string>({ options, value, onChange, label }: { options: { value: V; label: string; icon?: IconName }[]; value: V; onChange: (v: V) => void; label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} className="flex-row bg-sunk" style={{ borderRadius: 22, padding: 3, gap: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Tap
            key={o.value}
            testID={`pill-${o.value}`}
            onPress={() => onChange(o.value)}
            feedback="select"
            scaleTo={1}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            outerStyle={{ flexGrow: 1, flexBasis: 0 }}
            style={[{ height: 38, borderRadius: 19 }, on && { backgroundColor: c.raised, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }]}
            className="flex-row items-center justify-center"
          >
            {o.icon && (
              <View style={{ marginRight: 6 }}>
                <Icon name={o.icon} size={16} color={on ? c.ink : c.ink2} />
              </View>
            )}
            <T v="caption" tone={on ? 'ink' : 'ink2'} style={{ fontFamily: 'HankenGrotesk_600SemiBold' }}>
              {o.label}
            </T>
          </Tap>
        );
      })}
    </View>
  );
}

/** Interrupteur maison : contour à 3:1 quand il est éteint (WCAG 1.4.11). */
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
      style={{ width: 51, height: 31, borderRadius: 16, borderWidth: 1.5, borderColor: value ? c['primary-bg'] : c.control, backgroundColor: value ? c['primary-bg'] : 'transparent', justifyContent: 'center', paddingHorizontal: 2 }}
    >
      <Animated.View style={[{ width: 24, height: 24, borderRadius: 12, backgroundColor: value ? c['primary-fg'] : c.control }, knob]} />
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
      style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c['rule-strong'], opacity: (dir < 0 ? value <= min : value >= max) ? 0.4 : 1 }}
      className="items-center justify-center"
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
    <Tap onPress={onPress} feedback="select" accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size / 2, padding: 3, borderWidth: 2, borderColor: on ? c.ink : 'transparent' }}>
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
