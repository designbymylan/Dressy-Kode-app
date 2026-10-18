import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dressy',
    short_name: 'Dressy',
    description: 'Ta garde-robe numérique et ton styliste IA.',
    lang: 'fr',
    start_url: '/accueil',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#eef0f4',
    theme_color: '#eef0f4',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
