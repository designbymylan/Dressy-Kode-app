import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type Theme = 'light' | 'dark' | 'auto';
const THEMES: readonly Theme[] = ['light', 'dark', 'auto'];

export type Settings = {
  space_id: string;
  theme: Theme;
  accent: string;
  dressing_view: 'portants' | 'grille';
  density: 'confortable' | 'compacte';
  reduced_motion: boolean;
  high_contrast: boolean;
};

export type Viewer = {
  userId: string;
  email: string | null;
  displayName: string | null;
  /** Prénom donné par Google ou Apple à la première connexion, s'il y en a un. */
  givenName: string | null;
  onboardedAt: string | null;
  spaceId: string;
  spaceName: string;
  settings: Settings;
};

/**
 * L'espace et les réglages de la personne connectée.
 *
 * Aucune clause `.eq('owner_id', …)` n'est nécessaire : la RLS ne laisse
 * traverser que les espaces dont on est membre. C'est la base qui garantit
 * le cloisonnement, pas la requête, une requête oubliée ne peut donc pas
 * faire fuiter l'espace d'une autre personne.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // L'espace et le profil ne dépendent pas l'un de l'autre : on les lit en même temps.
  // `cache` (React) garde le résultat pour toute la requête : la mise en page et la page ne le relisent pas.
  const [{ data: space }, { data: profile }] = await Promise.all([
    supabase.from('spaces').select('id, name').limit(1).maybeSingle(),
    supabase.from('profiles').select('display_name, onboarded_at').eq('id', user.id).maybeSingle(),
  ]);
  if (!space) return null;

  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .eq('space_id', space.id)
    .maybeSingle();
  if (!settings) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const full = String(meta.given_name ?? meta.full_name ?? meta.name ?? '').trim();

  return {
    userId: user.id,
    email: user.email ?? null,
    displayName: profile?.display_name ?? null,
    givenName: full ? full.split(/\s+/)[0].slice(0, 30) : null,
    onboardedAt: profile?.onboarded_at ?? null,
    spaceId: space.id,
    spaceName: space.name,
    settings: settings as Settings,
  };
});

/**
 * Thème à poser sur <html>. « auto » est rendu tel quel : c'est la requête
 * média CSS qui tranche, ce qui évite d'attendre le JavaScript.
 * Un visiteur sans compte garde son choix dans le cookie `dk_theme`.
 */
export async function getTheme(): Promise<Theme> {
  const viewer = await getViewer().catch(() => null);
  if (viewer) return viewer.settings.theme;
  const saved = (await cookies()).get('dk_theme')?.value as Theme | undefined;
  return saved && THEMES.includes(saved) ? saved : 'auto';
}

/**
 * L'encoche clair / sombre du haut de l'écran (21/10) est un raccourci
 * d'appareil : on peut la masquer sur un téléphone et la garder sur un autre.
 */
export async function getThemeShortcut(): Promise<boolean> {
  return (await cookies()).get('dk_theme_tab')?.value !== '0';
}
