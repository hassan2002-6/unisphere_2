/**
 * Link Clerk users to seeded DB rows (demo prep).
 *
 * For each demo email: ensure a Clerk user exists (create with unverified
 * email + a demo password when missing), then set the DB row's clerkId to the
 * Clerk user id so sign-in lands on the seeded persona (role + data).
 *
 * Requires: CLERK_SECRET_KEY, DATABASE_URL.
 * Run:  bun run scripts/link-clerk-users.ts        (from apps/web)
 */

import { prisma } from "@unisphere/db";

const DEMO_USERS = [
  { email: "student@shu.demo", password: "UniSphere#Demo1" },
  { email: "faculty@shu.demo", password: "UniSphere#Demo2" },
  { email: "coordinator@shu.demo", password: "UniSphere#Demo3" },
  { email: "fyphead@shu.demo", password: "UniSphere#Demo4" },
  { email: "mentor@shu.demo", password: "UniSphere#Demo5" },
];

const SECRET = process.env.CLERK_SECRET_KEY;

async function clerk(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${SECRET}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`clerk ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function ensureClerkUser(email: string, password: string): Promise<string> {
  const found = (await clerk(`/users?email_address[]=${encodeURIComponent(email)}`)) as { id: string }[];
  if (Array.isArray(found) && found.length > 0) return found[0].id;

  const created = (await clerk(`/users`, {
    method: "POST",
    body: JSON.stringify({
      email_address: [email],
      password,
      skip_password_checks: true,
      skip_password_requirement: false,
    }),
  })) as { id: string };
  return created.id;
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
    await prisma.user.update({ where: { id: existing.id }, data: { clerkId } });
    console.log(`  link ${u.email}: clerkId updated → stays ${existing.role} with its seeded data`);
  }

  console.log("\nDemo accounts ready. Password for all: see DEMO_USERS in this script.");
  process.exit(0);
}

main().catch((e) => {
  console.error("failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
