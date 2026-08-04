import type { NextConfig } from "next";
import path from "path";

// Scoped to production only — CSP can interfere with Turbopack's dev-mode
// HMR websocket, and this app has no external script/font/image hosts to
// account for, so there's nothing dev mode needs from these.
const productionSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",

  experimental: {
    proxyClientMaxBodySize: "100mb",
  },

  turbopack: {
    // Fix: Next.js 16 detected a stale package-lock.json in the home directory.
    root: path.resolve(__dirname),
  },

  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [{ source: "/(.*)", headers: productionSecurityHeaders }];
  },
};

export default nextConfig;