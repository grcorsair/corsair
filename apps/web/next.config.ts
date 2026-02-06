import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    unoptimized: true, // Firebase App Hosting handles CDN caching
  },
};

export default nextConfig;
