import type { Metadata, Viewport } from 'next';
import { getTheme } from '@/lib/space';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dressy — ton dressing, en vitrine',
  description: 'Ta garde-robe numérique et ton styliste IA. Porte mieux, achète moins.',
  applicationName: 'Dressy',
  // iOS ignore le manifest pour l'icône et le mode plein écran.
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Dressy', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEF0F4' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0C10' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Le thème est résolu AVANT le premier octet de HTML : c'est ce qui fait
  // qu'il vaut pour toute l'application et non pour un seul écran.
  const theme = await getTheme();

  return (
    <html lang="fr" data-theme={theme}>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Les halos pastel de la direction « App design » : un seul calque fixe, derrière tout. */}
        <div className="ambient" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        {children}
      </body>
    </html>
  );
}
