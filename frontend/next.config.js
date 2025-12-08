/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://api.mdent.cloud/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
