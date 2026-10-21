import { redirect } from 'next/navigation';
import { getThemeShortcut, getViewer } from '@/lib/space';
import { createClient } from '@/lib/supabase/server';
import { labelsFor, colourHex } from '@/lib/onboarding';
import { getPlan } from '@/lib/subscription';
import { loadWardrobe } from '@/lib/wardrobe';
import { ProfileScreen, type ProfileRow } from '@/components/screens/ProfileScreen';

export default async function Moi() {
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');

  const supabase = await createClient();
  const [{ data: sp }, { usage }, { plan, renews }, shortcut] = await Promise.all([
    supabase.from('style_profile').select('*').eq('space_id', viewer.spaceId).maybeSingle(),
    loadWardrobe(supabase),
    getPlan(supabase, viewer.spaceId),
    getThemeShortcut(),
  ]);

  const colours: string[] = sp?.colours ?? [];
  const style: ProfileRow[] = [
    { key: 'styles', icon: 'star', label: 'Mon style', values: labelsFor('styles', sp?.styles ?? []) },
    { key: 'colours', icon: 'palette', label: 'Mes couleurs', values: labelsFor('colours', colours), swatches: colours.map(colourHex) },
    { key: 'items', icon: 'shirt', label: 'Ce que je porte', values: labelsFor('favourite_items', sp?.favourite_items ?? []) },
    { key: 'occasions', icon: 'party', label: 'Mes occasions', values: labelsFor('occasions', sp?.occasions ?? []) },
    { key: 'avoid', icon: 'eyeOff', label: 'Ce que j’évite', values: labelsFor('avoid', sp?.avoid ?? []) },
    {
      key: 'rythme',
      icon: 'clock',
      label: 'Mon rythme',
      values: [...labelsFor('morning_time', sp?.morning_time ?? null), ...labelsFor('time_intent', sp?.time_intent ?? null)],
    },
    { key: 'goals', icon: 'target', label: 'Mes objectifs', values: labelsFor('goals', sp?.goals ?? []) },
  ];

  return (
    <ProfileScreen
      data={{
        name: viewer.displayName,
        email: viewer.email,
        avatarUrl: viewer.avatarUrl,
        since: viewer.memberSince,
        total: usage.total,
        pct: usage.pct,
        plan,
        renews,
        style,
        theme: viewer.settings.theme,
        shortcut,
        spaceName: viewer.spaceName,
        dressingView: viewer.settings.dressing_view,
      }}
    />
  );
}
