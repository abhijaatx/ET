/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*"
      },
      {
        source: "/health",
        destination: "http://localhost:3001/health"
      }
    ];
  }
};

export default nextConfig;
