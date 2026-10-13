import type { MetadataRoute } from 'next';

/** Pour « Ajouter à l'écran d'accueil » : le nom, les couleurs et l'icône du K étoilé. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dresskode',
    short_name: 'Dresskode',
    description: 'Ta garde-robe numérique et ton styliste IA. Porte mieux, achète moins.',
    lang: 'fr',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
