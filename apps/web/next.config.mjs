/** @type {import('next').NextConfig} */
const internalApiUrl = process.env.INTERNAL_API_URL ?? "http://localhost:3001";

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
        destination: `${internalApiUrl}/api/:path*`
      },
      {
        source: "/health",
        destination: `${internalApiUrl}/health`
      }
    ];
  },
  // Increase the serverless function timeout for long-running AI proxy requests
  experimental: {
    proxyTimeout: 300000, // 5 minutes
  }
};

export default nextConfig;
