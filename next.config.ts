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
module.exports = {
  async redirects() {
    return [
      { source: '/habitos', destination: '/programas', permanent: false },
      { source: '/habitos/crear', destination: '/programas/crear', permanent: false },
      { source: '/habitos/herramientas', destination: '/herramientas', permanent: false },
    ];
  },
};
