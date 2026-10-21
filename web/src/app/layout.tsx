import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { getTheme, getThemeShortcut } from '@/lib/space';
import { Splash } from '@/components/Splash';
import { ThemeNotch } from '@/components/ThemeNotch';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dressy — ton dressing, en vitrine',
  description: 'Ta garde-robe numérique et Kodi, ton styliste de poche. Porte mieux, achète moins.',
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
  const [theme, shortcut, jar] = await Promise.all([getTheme(), getThemeShortcut(), cookies()]);
  // Kodi accueille à chaque lancement : une fois par session de navigation.
  const launch = !jar.get('dk_splash');

  return (
    <html lang="fr" data-theme={theme}>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {launch ? <Splash /> : null}
        {shortcut ? <ThemeNotch key={theme} theme={theme} /> : null}
        {children}
      </body>
    </html>
  );
}
