import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma, type User } from "./db";
import { can, type Capability } from "./rbac";

/**
 * Session → DB user resolution (plan component C1).
 * The DB row is authoritative for role; Clerk provides identity only.
 *
 * First-login behavior:
 *  1. clerkId match → done.
 *  2. email match on a pre-provisioned (seeded) row → attach the clerkId.
 *  3. else auto-provision a STUDENT row (set AUTO_PROVISION="false" to
 *     hard-disable; portal pages then show "not provisioned").
 */
export async function getCurrentUser(): Promise<User | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (existing) return existing;

  const cu = await currentUser();
  const email = cu?.primaryEmailAddress?.emailAddress;
  if (!email) return null;

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    return prisma.user.update({ where: { id: byEmail.id }, data: { clerkId: userId } });
  }

  if (process.env.AUTO_PROVISION === "false") return null;

  return prisma.user.create({
    data: {
      clerkId: userId,
      email,
      name: [cu?.firstName, cu?.lastName].filter(Boolean).join(" ") || email.split("@")[0],
      role: "STUDENT",
    },
  });
}

/** Portal pages: require a signed-in user with a DB row. */
export async function requireUser(): Promise<User> {
  if (!process.env.DATABASE_URL) redirect("/setup-needed");
  const user = await getCurrentUser();
  if (!user) redirect("/not-provisioned");
  return user;
}

/** Handlers/pages that need a specific capability (plan §8.1). */
export async function requireCapability(capability: Capability): Promise<User> {
  const user = await requireUser();
  if (!can(user.role, capability)) redirect("/dashboard?denied=1");
  return user;
}
