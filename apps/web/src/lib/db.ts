/**
 * Database access for the web app — re-exports the workspace Prisma client.
 * Server-only: never import this from a client component.
 */
export { prisma } from "@unisphere/db";
export * from "@unisphere/db";
