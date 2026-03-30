/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Extend the default proxy timeout to 5 minutes for long-running AI operations
  // (vernacular translation, briefing generation, etc.)
  httpAgentOptions: {
    keepAlive: true,
  },
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
  },
  // Increase the serverless function timeout for long-running AI proxy requests
  experimental: {
    proxyTimeout: 300000, // 5 minutes
  }
};

export default nextConfig;
