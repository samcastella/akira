/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  // Ignorar errores de ESLint en el build (temporalmente)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
