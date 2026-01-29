import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker builds
  output: "standalone",

  // Disable Turbopack for Prisma compatibility
  turbopack: {
    rules: {},
  },

  // Optimize barrel imports for better dev/build performance
  // Reference: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@tanstack/react-query",
    ],
  },

  // Exclude AWS SDK and Prisma from server component bundling for proper resolution
  serverExternalPackages: ["@aws-sdk/client-s3", "@prisma/client", ".prisma/client"],

  // Use Webpack instead of Turbopack in development
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
