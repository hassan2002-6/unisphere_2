import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are TypeScript sources — let Next compile them.
  transpilePackages: ["@unisphere/db"],
  // Keep native/driver packages on the Node.js runtime instead of bundling.
  serverExternalPackages: ["pg", "@prisma/client", "@prisma/adapter-pg"],
};

export default nextConfig;
