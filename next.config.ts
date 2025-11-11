/** @type {import('next').NextConfig} */
module.exports = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  // Temporal mientras limpiamos el lint
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: '/habitos', destination: '/programas', permanent: false },
      { source: '/habitos/crear', destination: '/programas/crear', permanent: false },
      { source: '/habitos/herramientas', destination: '/herramientas', permanent: false },
    ];
  },
};
