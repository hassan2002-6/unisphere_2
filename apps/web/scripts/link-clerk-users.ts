/**
 * Link Clerk users to seeded DB rows (demo prep).
 *
 * For each demo email: ensure a Clerk user exists (create with unverified
 * email + the demo password when missing), then set the DB row's clerkId to the
 * Clerk user id so sign-in lands on the seeded persona (role + data).
 *
 * Requires: CLERK_SECRET_KEY, DATABASE_URL.
 * Run:  bun run scripts/link-clerk-users.ts        (from apps/web)
 */

import { prisma } from "@unisphere/db";

/** Every demo account shares one documented password (README, demo script). */
export const DEMO_PASSWORD = "UniSphere#Demo2026";

export const DEMO_USERS = [
  // Students — STU001–STU010
  { email: "student@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "student2@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "student3@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "student4@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "student5@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "student6@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "student7@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "student8@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "student9@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "student10@shu.edu.pk", password: DEMO_PASSWORD },
  // Faculty
  { email: "faculty@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "faculty2@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "faculty3@shu.edu.pk", password: DEMO_PASSWORD },
  // Coordination
  { email: "coordinator@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "fyphead@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "saadia.karim@shu.edu.pk", password: DEMO_PASSWORD },
  // Outreach + administration
  { email: "mentor@shu.edu.pk", password: DEMO_PASSWORD },
  { email: "admin@shu.edu.pk", password: DEMO_PASSWORD },
];

const SECRET = process.env.CLERK_SECRET_KEY;

async function clerk(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${SECRET}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`clerk ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

type ClerkUser = { id: string; email_addresses?: { email_address: string }[] };

/** Clerk's `?email_address[]=` filter is unreliable (and paged) — scan all pages. */
async function findClerkUser(email: string): Promise<ClerkUser | undefined> {
  const target = email.toLowerCase();
  let offset = 0;
  for (;;) {
    const page = (await clerk(`/users?limit=100&offset=${offset}`)) as ClerkUser[];
    if (!Array.isArray(page) || page.length === 0) return undefined;
    const match = page.find((u) =>
      u.email_addresses?.some((e) => e.email_address?.toLowerCase() === target),
    );
    if (match) return match;
    if (page.length < 100) return undefined;
    offset += 100;
  }
}

async function ensureClerkUser(email: string, password: string): Promise<string> {
  const match = await findClerkUser(email);

  if (match) {
    // Keep the demo password deterministic even for pre-existing users.
    await clerk(`/users/${match.id}`, {
      method: "PATCH",
      body: JSON.stringify({ password, skip_password_checks: true, bypass_client_trust: true }),
    });
    return match.id;
  }

  try {
    const created = (await clerk(`/users`, {
      method: "POST",
      body: JSON.stringify({
        email_address: [email],
        password,
        skip_password_checks: true,
        skip_password_requirement: false,
        // Device Trust email codes can't reach demo mailboxes — bypass it so
        // password sign-in completes (the shared demo password still applies).
        bypass_client_trust: true,
      }),
    })) as ClerkUser;
    return created.id;
  } catch (e) {
    // "That email address is taken" — the user appeared between the scan and
    // the create (or a filter miss); look it up once more before giving up.
    const retry = await findClerkUser(email);
    if (retry) {
      await clerk(`/users/${retry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password, skip_password_checks: true, bypass_client_trust: true }),
      });
      return retry.id;
    }
    throw e;
  }
}

async function main() {
  if (!SECRET) {
    console.log("SKIP: CLERK_SECRET_KEY is not set.");
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL is not set (seed must be loaded first).");
    process.exit(2);
  }

  for (const u of DEMO_USERS) {
    const clerkId = await ensureClerkUser(u.email, u.password);
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      console.log(`  warn ${u.email}: no seeded DB row (run \`bun run seed\` first)`);
      continue;
    }
    if (existing.clerkId === clerkId) {
      console.log(`  ok   ${u.email}: already linked (${existing.role})`);
      continue;
    }
    // A stale row may hold this clerkId from an earlier partial run — release it first
    // (clerkId is non-nullable, so moved rows get a unique placeholder).
    const stale = await prisma.user.updateMany({
      where: { clerkId, NOT: { id: existing.id } },
      data: { clerkId: `seed:stale:${Date.now()}:${Math.random().toString(36).slice(2, 8)}` },
    });
    if (stale.count > 0) console.log(`  note ${u.email}: released ${stale.count} stale clerkId holder(s)`);
    await prisma.user.update({ where: { id: existing.id }, data: { clerkId } });
    console.log(`  link ${u.email}: clerkId updated → stays ${existing.role} with its seeded data`);
  }

  console.log("\nDemo accounts ready — password documented in README (one password for every account).");
  process.exit(0);
}

main().catch((e) => {
  console.error("failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
