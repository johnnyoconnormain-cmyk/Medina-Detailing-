import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both drivers reach for Node built-ins (net, tls, fs). Leaving them external
  // stops Next trying to bundle them — which otherwise breaks instrumentation,
  // where the file is compiled for the edge runtime too.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
