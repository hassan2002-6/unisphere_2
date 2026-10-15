import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are TypeScript sources — let Next compile them.
  transpilePackages: ["@unisphere/db"],
  // Keep native/driver packages on the Node.js runtime instead of bundling.
  serverExternalPackages: ["pg", "@prisma/client", "@prisma/adapter-pg"],
  experimental: {
    // Assignment/complaint/photo uploads travel through server actions — the
    // app cap is 2 MB per file (+ form overhead), so allow a 4 MB body.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
