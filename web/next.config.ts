import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Classic SSR: pages that read searchParams render per request, so a freshly
  // inserted story shows up on the very next load (no stale cache to wait out).
  cacheComponents: false,
  reactStrictMode: true,
  // the sandbox preview proxies the dev server under *.e2b.app
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
