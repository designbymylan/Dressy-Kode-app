import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Les Server Actions portent les mutations de réglages et d'inscription.
    serverActions: { bodySizeLimit: '8mb' },
    // Changer d'onglet ou revenir sur une page déjà vue l'affiche tout de suite, sans aller-retour
    // serveur (300 s gardés dans le navigateur). Les modifications faites dans l'app purgent ce cache
    // (revalidatePath dans actions.ts), donc elles restent visibles aussitôt.
    staleTimes: { dynamic: 300 },
  },
  // Le styliste s'appelait Kode jusqu'au 21/10 : les anciens liens mènent à Kodi.
  async redirects() {
    return [{ source: '/kode', destination: '/kodi', permanent: true }];
  },
};

export default config;
