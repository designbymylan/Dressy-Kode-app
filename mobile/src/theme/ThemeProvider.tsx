import { createContext, useContext, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vars } from 'nativewind';
import { colors, type Colors, type Scheme } from './tokens';

export type ThemePref = 'auto' | 'light' | 'dark';

type ThemeValue = {
  scheme: Scheme;
  c: Colors;
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  /** « Verre plus opaque » : la version app de Réduire la transparence. */
  solidGlass: boolean;
  setSolidGlass: (v: boolean) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

const LOOK = 'dresskode:apparence:v1';

/** Les jetons en variables CSS : les classes `bg-paper`, `text-ink`… suivent le thème. */
const cssVars = (c: Colors) => vars(Object.fromEntries(Object.entries(c).map(([k, v]) => [`--${k}`, v])));
const VARS = { light: cssVars(colors.light), dark: cssVars(colors.dark) };

/**
 * Aperçu web : la page hôte peut imposer un thème (attribut data-theme sur
 * <html>). Il passe avant le réglage du système, comme sur le téléphone le
 * réglage d'iOS.
 */
function useHostScheme(): Scheme | null {
  const read = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
    const t = document.documentElement.getAttribute('data-theme');
    return t === 'dark' || t === 'light' ? t : null;
  };
  const [host, setHost] = useState<Scheme | null>(read);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof MutationObserver === 'undefined') return;
    const o = new MutationObserver(() => setHost(read()));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => o.disconnect();
  }, []);
  return host;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const host = useHostScheme();
  const device = useColorScheme();
  const system = host ?? device;
  const [pref, setPrefState] = useState<ThemePref>('auto');
  const [solidGlass, setSolidState] = useState(false);
  // Le thème et le verre choisis dans Réglages restent d'un lancement à l'autre (07/10).
  useEffect(() => {
    AsyncStorage.getItem(LOOK)
      .then((raw) => {
        if (!raw) return;
        const v = JSON.parse(raw) as { pref?: ThemePref; solidGlass?: boolean };
        if (v.pref === 'auto' || v.pref === 'light' || v.pref === 'dark') setPrefState(v.pref);
        if (typeof v.solidGlass === 'boolean') setSolidState(v.solidGlass);
      })
      .catch(() => undefined);
  }, []);
  const keep = (v: { pref: ThemePref; solidGlass: boolean }) => AsyncStorage.setItem(LOOK, JSON.stringify(v)).catch(() => undefined);
  const setPref = (p: ThemePref) => {
    setPrefState(p);
    void keep({ pref: p, solidGlass });
  };
  const setSolidGlass = (v: boolean) => {
    setSolidState(v);
    void keep({ pref, solidGlass: v });
  };
  const scheme: Scheme = pref === 'auto' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const value = useMemo(
    () => ({ scheme, c: colors[scheme], pref, setPref, solidGlass, setSolidGlass }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheme, pref, solidGlass],
  );
  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1, backgroundColor: colors[scheme].paper }, VARS[scheme]]}>{children}</View>
    </ThemeContext.Provider>
  );
}

/**
 * Une zone toujours claire : le bandeau beurre garde son texte noir, ses
 * boutons noirs et ses filets clairs, même en mode sombre. Les jetons (contexte
 * et variables CSS) repassent en clair pour tout ce qui est dessous ; `style`
 * va sur la vue qui porte ces variables.
 */
export function LightScope({ children, style, ...rest }: ComponentProps<typeof View>) {
  const v = useTheme();
  const value = useMemo(() => ({ ...v, scheme: 'light' as const, c: colors.light }), [v]);
  return (
    <ThemeContext.Provider value={value}>
      <View {...rest} style={[VARS.light, style]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme hors de ThemeProvider');
  return v;
}
