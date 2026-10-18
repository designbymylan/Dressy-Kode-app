import type { ReactNode } from 'react';

/** Sur téléphone, pas de cadre : l'app occupe l'écran. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
