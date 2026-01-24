import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize barrel imports for better dev/build performance
  // Reference: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@tanstack/react-query",
    ],
  },
};

export default nextConfig;
