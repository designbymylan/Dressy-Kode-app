import type { Metadata, Viewport } from 'next';
import { getTheme, getThemeShortcut } from '@/lib/space';
import { Intro, INTRO_SCRIPT } from '@/components/Intro';
import { ThemeNotch } from '@/components/ThemeNotch';
import './globals.css';

/**
 * L'adresse publique du site : sans elle, l'aperçu d'un lien partagé
 * (image Open Graph) pointait vers localhost. Vercel donne le domaine de
 * production ; ailleurs, celui du projet.
 */
const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'https://dresskode-app.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'Dresskode, ton dressing en vitrine',
  description: 'Ta garde-robe numérique et ton styliste IA. Porte mieux, achète moins.',
  applicationName: 'Dresskode',
  openGraph: { type: 'website', locale: 'fr_FR', siteName: 'Dresskode' },
  twitter: { card: 'summary_large_image' },
  // iOS ignore le manifest pour le mode plein écran. Les icônes viennent des
  // fichiers app/icon.svg et app/apple-icon.png (l'orbe).
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
  const [theme, shortcut] = await Promise.all([getTheme(), getThemeShortcut()]);

  return (
    <html lang="fr" data-theme={theme}>
      <head>
        {/* L'intro déjà vue dans cet onglet ne doit pas clignoter : décidé avant le premier affichage. */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
      </head>
      {/* Inter Tight et Inter, servies par le site (@font-face de globals.css) : aucun service externe. */}
      <body>
        {/* Les halos crème (noirs en sombre), derrière le verre : un seul calque fixe, sous tout le reste. */}
        <div className="ambient" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        {children}
        {/* L'encoche clair / sombre, en haut à droite (21/10), masquable dans Mon compte. */}
        {shortcut ? <ThemeNotch key={theme} theme={theme} /> : null}
        <Intro />
      </body>
    </html>
  );
}
