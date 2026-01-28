import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker builds
  output: "standalone",

  // Optimize barrel imports for better dev/build performance
  // Reference: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@tanstack/react-query",
    ],
  },

  // Exclude AWS SDK from server component bundling for proper resolution
  serverExternalPackages: ["@aws-sdk/client-s3"],
};

export default nextConfig;
