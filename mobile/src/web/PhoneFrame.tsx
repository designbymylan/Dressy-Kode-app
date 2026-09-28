import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaFrameContext, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '../state/store';
import { ScreenSize } from '../ui/screen';

const W = 390;
const H = 844;
const INSETS = { top: 59, bottom: 34, left: 0, right: 0 };
const BEZEL = 12;

/**
 * Aperçu web seulement : l'app dans un cadre de téléphone (390 × 844, les
 * marges de sécurité d'un iPhone), avec deux réglages hors de l'écran pour
 * la revue, le thème et la remise à zéro. Rien de ceci n'existe sur le
 * téléphone.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const win = useWindowDimensions();
  const { scheme, pref, setPref } = useTheme();
  const { a } = useStore();
  // Sur un vrai téléphone (pointeur tactile, écran étroit), l'app prend tout l'écran ; ailleurs, le cadre.
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && win.width < 520;
  const framed = !touch && win.width >= 300 && win.height >= 420;

  if (!framed) return <>{children}</>;

  const chrome = 56;
  const scale = Math.min(1, (win.height - chrome - 24) / (H + BEZEL * 2), (win.width - 24) / (W + BEZEL * 2));
  const dark = scheme === 'dark';
  const page = dark ? '#07080B' : '#E4E7EE';
  const ink = dark ? '#F4F4F6' : '#0E0F13';
  const muted = dark ? '#A3A6B1' : '#5D606B';

  const pill = (label: string, on: boolean, onPress: () => void, id: string) => (
    <Pressable key={id} testID={id} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: on ? ink : 'transparent', borderWidth: 1, borderColor: on ? ink : dark ? 'rgba(244,244,246,0.3)' : 'rgba(14,15,19,0.3)' }}>
      <Text style={{ fontFamily: 'Sans600', fontSize: 13, color: on ? page : ink }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: page, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
      <View style={{ height: chrome, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {pill('Clair', pref === 'light' || (pref === 'auto' && !dark), () => setPref('light'), 'frame-light')}
        {pill('Sombre', pref === 'dark' || (pref === 'auto' && dark), () => setPref('dark'), 'frame-dark')}
        <View style={{ width: 8 }} />
        {pill('Recommencer', false, a.restart, 'frame-restart')}
        <Text style={{ fontFamily: 'Sans500', fontSize: 12, color: muted, marginLeft: 6 }}>Aperçu · données fictives</Text>
      </View>
      <View style={{ width: (W + BEZEL * 2) * scale, height: (H + BEZEL * 2) * scale }}>
        <View style={{ position: 'absolute', left: 0, top: 0, width: W + BEZEL * 2, height: H + BEZEL * 2, transform: [{ scale }], transformOrigin: 'top left', borderRadius: 56 + BEZEL, backgroundColor: '#161514', padding: BEZEL, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 20 } }}>
          <View testID="phone" style={{ width: W, height: H, borderRadius: 56, overflow: 'hidden' }}>
            <ScreenSize.Provider value={{ width: W, height: H }}>
              <SafeAreaFrameContext.Provider value={{ x: 0, y: 0, width: W, height: H }}>
                <SafeAreaInsetsContext.Provider value={INSETS}>{children}</SafeAreaInsetsContext.Provider>
              </SafeAreaFrameContext.Provider>
            </ScreenSize.Provider>
            <StatusBarMock color={ink} />
            <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, left: (W - 134) / 2, width: 134, height: 5, borderRadius: 3, backgroundColor: ink, opacity: 0.85 }} />
          </View>
        </View>
      </View>
    </View>
  );
}

function StatusBarMock({ color }: { color: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 34, paddingTop: 6 }}>
      <Text style={{ fontFamily: 'Sans600', fontSize: 16, color, width: 60 }}>{time}</Text>
      <View style={{ position: 'absolute', top: 11, left: (W - 124) / 2, width: 124, height: 36, borderRadius: 18, backgroundColor: '#000' }} />
      <Svg width={62} height={14} viewBox="0 0 62 14">
        <Rect x={0} y={9} width={3} height={4} rx={1} fill={color} />
        <Rect x={5} y={6.5} width={3} height={6.5} rx={1} fill={color} />
        <Rect x={10} y={4} width={3} height={9} rx={1} fill={color} />
        <Rect x={15} y={1.5} width={3} height={11.5} rx={1} fill={color} />
        <Path d="M25 5.5a9 9 0 0 1 12 0M27.5 8.3a5.2 5.2 0 0 1 7 0M30 11h2" stroke={color} strokeWidth={1.8} strokeLinecap="round" fill="none" />
        <Rect x={40.5} y={1.5} width={18} height={10} rx={3} stroke={color} strokeOpacity={0.5} strokeWidth={1} fill="none" />
        <Rect x={42} y={3} width={13} height={7} rx={1.6} fill={color} />
        <Rect x={59.5} y={5} width={1.6} height={3.5} rx={0.8} fill={color} fillOpacity={0.5} />
      </Svg>
    </View>
  );
}
