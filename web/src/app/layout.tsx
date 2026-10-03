import type { Metadata, Viewport } from 'next';
import { getTheme } from '@/lib/space';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dresskode, ton dressing en vitrine',
  description: 'Ta garde-robe numérique et ton styliste IA. Porte mieux, achète moins.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Le thème est résolu AVANT le premier octet de HTML : c'est ce qui fait
  // qu'il vaut pour toute l'application et non pour un seul écran.
  const theme = await getTheme();

  return (
    <html lang="fr" data-theme={theme}>
      {/* Helvetica, celle du système : aucune police à télécharger. */}
      <body>
        {children}
      </body>
    </html>
  );
}
