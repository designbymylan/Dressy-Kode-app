import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Les Server Actions portent les mutations de réglages et d'inscription.
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default config;
