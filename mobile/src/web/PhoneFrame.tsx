import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaFrameContext, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '../state/store';
import { ScreenSize } from '../ui/screen';
import { F } from '../theme/fonts';

/** iPhone 17 : écran de 402 × 874 pt, île dynamique, 62 pt en haut et 34 pt en bas de zone de sécurité. */
const W = 402;
const H = 874;
const INSETS = { top: 62, bottom: 34, left: 0, right: 0 };
const BEZEL = 12;
const RADIUS = 62;
/** En dessous, le panneau passe au-dessus du téléphone au lieu d'être à son côté. */
const SIDE_MIN = 880;
const PANEL_W = 280;

/**
 * Aperçu web seulement : l'app dans un iPhone 17 posé à côté d'un panneau
 * de test (thème, compte de démonstration, remise à zéro). Sur un écran
 * étroit, le panneau se range au-dessus du téléphone. Rien de ceci n'existe
 * sur le téléphone.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const win = useWindowDimensions();
  const { scheme, pref, setPref } = useTheme();
  const { a } = useStore();
  // Sur un vrai téléphone (pointeur tactile, écran étroit), l'app prend tout l'écran ; ailleurs, le cadre.
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && win.width < 520;
  const framed = !touch && win.width >= 300 && win.height >= 420;

  if (!framed) return <>{children}</>;

  const side = win.width >= SIDE_MIN;
  const chrome = side ? 0 : 56;
  const scale = Math.min(1, (win.height - chrome - 24) / (H + BEZEL * 2), (win.width - 24 - (side ? PANEL_W + 56 : 0)) / (W + BEZEL * 2));
  const dark = scheme === 'dark';
  const page = dark ? '#07080B' : '#E4E7EE';
  const ink = dark ? '#F4F4F6' : '#0E0F13';
  const muted = dark ? '#A3A6B1' : '#5D606B';
  const line = dark ? 'rgba(244,244,246,0.3)' : 'rgba(14,15,19,0.3)';

  const pill = (label: string, on: boolean, onPress: () => void, id: string) => (
    <Pressable key={id} testID={id} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: on ? ink : 'transparent', borderWidth: 1, borderColor: on ? ink : line }}>
      <Text style={{ ...F.s600, fontSize: 13, color: on ? page : ink }}>{label}</Text>
    </Pressable>
  );
  const light = pref === 'light' || (pref === 'auto' && !dark);
  const night = pref === 'dark' || (pref === 'auto' && dark);

  const phone = (
    <View style={{ width: (W + BEZEL * 2) * scale, height: (H + BEZEL * 2) * scale }}>
      <View style={{ position: 'absolute', left: 0, top: 0, width: W + BEZEL * 2, height: H + BEZEL * 2, transform: [{ scale }], transformOrigin: 'top left' }}>
        {/* Boutons latéraux : action et volumes à gauche, veille à droite. */}
        {[[120, 30], [176, 56], [246, 56]].map(([top, h], i) => (
          <View key={i} style={{ position: 'absolute', left: -3, top, width: 4, height: h, borderTopLeftRadius: 2, borderBottomLeftRadius: 2, backgroundColor: '#2A2927' }} />
        ))}
        <View style={{ position: 'absolute', right: -3, top: 200, width: 4, height: 92, borderTopRightRadius: 2, borderBottomRightRadius: 2, backgroundColor: '#2A2927' }} />
        <View style={{ flex: 1, borderRadius: RADIUS + BEZEL, backgroundColor: '#161514', padding: BEZEL, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 20 } }}>
          <View testID="phone" style={{ width: W, height: H, borderRadius: RADIUS, overflow: 'hidden' }}>
            <ScreenSize.Provider value={{ width: W, height: H }}>
              <SafeAreaFrameContext.Provider value={{ x: 0, y: 0, width: W, height: H }}>
                <SafeAreaInsetsContext.Provider value={INSETS}>{children}</SafeAreaInsetsContext.Provider>
              </SafeAreaFrameContext.Provider>
            </ScreenSize.Provider>
            <StatusBarMock color={ink} />
            <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, left: (W - 139) / 2, width: 139, height: 5, borderRadius: 3, backgroundColor: ink, opacity: 0.85 }} />
          </View>
        </View>
      </View>
    </View>
  );

  if (!side) {
    return (
      <View style={{ flex: 1, backgroundColor: page, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
        <View style={{ height: chrome, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {pill('Clair', light, () => setPref('light'), 'frame-light')}
          {pill('Sombre', night, () => setPref('dark'), 'frame-dark')}
          <View style={{ width: 8 }} />
          {pill('Démo', false, a.loginDemo, 'frame-demo')}
          {pill('Recommencer', false, a.restart, 'frame-restart')}
          <Text style={{ ...F.s500, fontSize: 12, color: muted, marginLeft: 6 }}>Aperçu · données fictives</Text>
        </View>
        {phone}
      </View>
    );
  }

  const section = (title: string) => <Text style={{ ...F.s600, fontSize: 11, letterSpacing: 0.9, color: muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 }}>{title}</Text>;
  return (
    <View style={{ flex: 1, backgroundColor: page, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 56, padding: 12 }}>
      <View testID="frame-panel" style={{ width: PANEL_W, borderRadius: 28, padding: 24, backgroundColor: dark ? '#101218' : '#FFFFFF', borderWidth: 1, borderColor: dark ? 'rgba(244,244,246,0.12)' : 'rgba(14,15,19,0.08)' }}>
        <Text accessibilityRole="header" style={{ ...F.s600, fontSize: 20, color: ink }}>Aperçu de l’app</Text>
        <Text style={{ ...F.s500, fontSize: 13, color: muted, marginTop: 4 }}>iPhone 17 · 402 × 874 pt</Text>
        {section('Thème')}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {pill('Clair', pref === 'light', () => setPref('light'), 'frame-light')}
          {pill('Sombre', pref === 'dark', () => setPref('dark'), 'frame-dark')}
          {pill('Auto', pref === 'auto', () => setPref('auto'), 'frame-auto')}
        </View>
        {section('Compte')}
        <View style={{ gap: 8, alignItems: 'flex-start' }}>
          {pill('Démo : Alice, 37 pièces', false, a.loginDemo, 'frame-demo')}
          {pill('Nouvel espace, vide', false, a.restart, 'frame-restart')}
        </View>
        <Text style={{ ...F.s500, fontSize: 12, lineHeight: 17, color: muted, marginTop: 22 }}>Données fictives : rien n’est envoyé. Seul un vrai iPhone (Expo Go) fait foi pour les animations et le verre.</Text>
      </View>
      {phone}
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
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 59, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40, paddingTop: 0 }}>
      <Text style={{ ...F.s600, fontSize: 16, color, width: 60 }}>{time}</Text>
      <View style={{ position: 'absolute', top: 11, left: (W - 126) / 2, width: 126, height: 37, borderRadius: 19, backgroundColor: '#000' }} />
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
