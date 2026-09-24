/**
 * Concurrency acceptance test (plan M3): the LAST-GPU race.
 *
 * Two parallel allocations compete for the last unit of a resource.
 * Exactly one may succeed; the other must fail with "no capacity".
 * This is the hard acceptance criterion, run against a live database.
 *
 * Run:  DATABASE_URL=... bun run scripts/test-concurrency.ts   (from apps/web)
 * Exit: 0 = pass, 1 = fail, 2 = skipped (no DATABASE_URL).
 */

import { prisma } from "@unisphere/db";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL is not set — concurrency test needs a live database.");
    process.exit(2);
  }

  // Fixtures: a 1-unit GPU + two students + two RECOMMENDED requests.
  const stamp = Date.now();
  const resource = await prisma.resource.create({
    data: { name: `race-gpu-${stamp}`, model: "TestGPU", type: "GPU", specs: "race", quantity: 1, available: 1 },
  });
  const makeUser = (n: number) =>
    prisma.user.create({
      data: { clerkId: `race-${stamp}-${n}`, email: `race-${stamp}-${n}@test.local`, name: `Race ${n}`, role: "STUDENT" },
    });
  const [a, b] = await Promise.all([makeUser(1), makeUser(2)]);
  const mkRequest = (applicantId: string) =>
    prisma.resourceRequest.create({
      data: {
        applicantId,
        projectName: `race-${stamp}`,
        groupName: "Race",
        members: "x",
        resourceType: "GPU",
        config: "TestGPU",
        purpose: "concurrency acceptance test",
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        timeSlot: "now",
        status: "RECOMMENDED",
      },
    });
  const [r1, r2] = await Promise.all([mkRequest(a.id), mkRequest(b.id)]);

  // The race: both try to decrement the single unit.
  const allocate = (requestId: string) =>
    prisma
      .$transaction(async (tx) => {
        const dec = await tx.resource.updateMany({
          where: { id: resource.id, available: { gt: 0 } },
          data: { available: { decrement: 1 } },
        });
        if (dec.count === 0) throw new Error("no_capacity");
        return tx.allocation.create({
          data: {
            requestId,
            resourceId: resource.id,
            startDate: new Date(),
            endDate: new Date(Date.now() + 86400000),
            timeSlot: "now",
            status: "ACTIVE",
            allocatedById: a.id,
          },
        });
      })
      .then(() => "allocated" as const)
      .catch(() => "no_capacity" as const);

  const results = await Promise.all([allocate(r1.id), allocate(r2.id)]);
  const after = await prisma.resource.findUnique({ where: { id: resource.id } });
  const allocations = await prisma.allocation.count({ where: { resourceId: resource.id } });

  const wins = results.filter((r) => r === "allocated").length;
  const fails = results.filter((r) => r === "no_capacity").length;

  console.log(`results: ${results.join(", ")}`);
  console.log(`resource after: available=${after?.available} (expected 0), allocations=${allocations} (expected 1)`);

  const pass = wins === 1 && fails === 1 && after?.available === 0 && allocations === 1;

  // Cleanup (best-effort).
  try {
    await prisma.allocation.deleteMany({ where: { resourceId: resource.id } });
    await prisma.resourceRequest.deleteMany({ where: { projectName: `race-${stamp}` } });
    await prisma.resource.delete({ where: { id: resource.id } });
    await prisma.user.deleteMany({ where: { clerkId: { startsWith: `race-${stamp}` } } });
  } catch {
    console.log("cleanup: partial (fixtures may remain)");
  }

  console.log(pass ? "PASS: exactly one allocation won the last unit." : "FAIL: the race was not resolved correctly.");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("crashed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
