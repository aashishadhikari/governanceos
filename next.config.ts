import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",

  experimental: {
    proxyClientMaxBodySize: "100mb",
  },

  turbopack: {
    // Fix: Next.js 16 detected a stale package-lock.json in the home directory.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;