/** @type {import('next').NextConfig} */
const internalApiUrl = process.env.INTERNAL_API_URL ?? "http://localhost:3001";
const isStaticExport = process.env.NEXT_OUTPUT === "export" || process.env.STATIC_EXPORT === "true";

const nextConfig = {
  reactStrictMode: true,
  output: isStaticExport ? "export" : "standalone",
  httpAgentOptions: {
    keepAlive: true,
  },
  ...(isStaticExport
    ? {
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
      }
    : {
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
        experimental: {
          proxyTimeout: 300000,
        },
      })
};

export default nextConfig;
