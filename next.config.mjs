/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ceinture et bretelles : le noindex est aussi posé via les metadata de
  // chaque page, mais l'en-tête HTTP couvre toute réponse (PRD §5.1).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
