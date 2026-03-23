import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Limit workers to prevent OOM on Railway (512MB-1GB plans)
    cpus: 2,
  },
};

export default nextConfig;
