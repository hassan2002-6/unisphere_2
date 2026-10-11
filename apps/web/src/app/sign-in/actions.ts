"use server";

import { headers } from "next/headers";
import { resolveLoginIdentifier } from "@/server/services/accounts";

/**
 * Sign-in support (spec §4): the login form accepts a University ID
 * (S22CSC003, FAC001, COORD001, …) or an email address. Clerk authenticates
 * by email, so an ID is resolved to its linked account here — server-side.
 *
 * A tiny in-process limiter keeps the ID → email mapping from being enumerated.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 25;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function resolveLoginIdentifierAction(
  identifier: string,
): Promise<{ email: string; name: string } | null> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return null;
  if (typeof identifier !== "string" || identifier.length > 120) return null;
  return resolveLoginIdentifier(identifier);
}
