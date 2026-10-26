import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Les Server Actions portent les mutations de réglages et d'inscription.
    serverActions: { bodySizeLimit: '8mb' },
    // Revenir sur un onglet déjà ouvert l'affiche tout de suite (30 s gardés dans le navigateur).
    staleTimes: { dynamic: 30 },
  },
  // Le styliste s'appelait Kode jusqu'au 21/10 : les anciens liens mènent à Kodi.
  async redirects() {
    return [{ source: '/kode', destination: '/kodi', permanent: true }];
  },
};

export default config;
