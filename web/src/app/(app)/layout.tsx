import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/space';
import { TabBar } from '@/components/TabBar';

/**
 * Le middleware a déjà écarté les visiteurs non connectés ; ce second
 * contrôle attrape le cas où la session existe mais l'espace manque
 * (déclencheur d'inscription en échec, espace supprimé).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/bienvenue');
  // Tant que le questionnaire n'est pas passé, l'application reste fermée :
  // Kodi n'aurait rien sur quoi s'appuyer pour proposer quoi que ce soit.
  if (!viewer.onboardedAt) redirect('/demarrage');

  return (
    <>
      {children}
      <TabBar />
    </>
  );
}
