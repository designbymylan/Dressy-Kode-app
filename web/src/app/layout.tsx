import type { Metadata, Viewport } from 'next';
import { getTheme } from '@/lib/space';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dressy — ton dressing, en vitrine',
  description: 'Ta garde-robe numérique et ton styliste IA. Porte mieux, achète moins.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEEDEA' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0B' },
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
      </head>
      <body>{children}</body>
    </html>
  );
}
