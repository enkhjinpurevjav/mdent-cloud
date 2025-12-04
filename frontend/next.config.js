/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        // Forward any /api/* requests on book.mdent.cloud to your backend
        source: '/api/:path*',
        destination: 'https://api.mdent.cloud/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
