import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  // Ignorar errores de ESLint en el build de Vercel (solo por ahora)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

