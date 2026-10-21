import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Les Server Actions portent les mutations de réglages et d'inscription.
    serverActions: { bodySizeLimit: '8mb' },
  },
  // Le styliste s'appelait Kode jusqu'au 21/10 : les anciens liens mènent à Kodi.
  async redirects() {
    return [{ source: '/kode', destination: '/kodi', permanent: true }];
  },
};

export default config;
