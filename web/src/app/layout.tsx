import type { Metadata, Viewport } from 'next';
import { getTheme } from '@/lib/space';
import { Intro, INTRO_SCRIPT } from '@/components/Intro';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dresskode, ton dressing en vitrine',
  description: 'Ta garde-robe numérique et ton styliste IA. Porte mieux, achète moins.',
  applicationName: 'Dresskode',
  // iOS ignore le manifest pour le mode plein écran. Les icônes viennent des
  // fichiers app/icon.svg et app/apple-icon.png (le K étoilé).
  appleWebApp: { capable: true, title: 'Dresskode', statusBarStyle: 'default' },
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
      <head>
        {/* L'intro déjà vue dans cet onglet ne doit pas clignoter : décidé avant le premier affichage. */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
      </head>
      {/* Helvetica, celle du système : aucune police à télécharger. */}
      <body>
        {/* Les halos crème (noirs en sombre), derrière le verre : un seul calque fixe, sous tout le reste. */}
        <div className="ambient" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        {children}
        <Intro />
      </body>
    </html>
  );
}
