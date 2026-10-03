import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // No standalone output — Vercel handles deployment natively
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Prisma needs to be bundled for serverless
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2"],
};

export default nextConfig;
