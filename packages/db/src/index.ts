import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Single PrismaClient instance for the whole app (dev-HMR safe via globalThis).
 * Prisma 7 uses driver adapters — no Rust engine. Construction is lazy:
 * importing this module never throws, even when DATABASE_URL is unset —
 * queries fail at call time with a clear error instead.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn(
      "[@unisphere/db] DATABASE_URL is not set — database queries will fail. " +
        "Copy .env.example to .env and fill it in.",
    );
  }
  const adapter = new PrismaPg({
    connectionString: connectionString ?? "postgresql://unset:unset@localhost:5432/unset",
  });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "../generated/prisma/client";
