/**
 * Performance measurement (spec §13): times the five hottest server paths on
 * real seeded data — role dashboards, list queries (assignments, submissions,
 * complaints, review queue) — plus the production HTTP surface.
 *
 * Run from apps/web with the env loaded:
 *   set -a && . ./.env.local && set +a && bun scripts/measure-perf.ts
 * Add BASE=https://unisphere-hazel.vercel.app to also time the live site.
 * Reports p50/p95 over N runs (default 7). Read-only — touches no records.
 */
import { getDashboard } from "@/server/services/dashboard";
import { listMyAssignments } from "@/server/services/assignments";
import { listManagedComplaints, listMyComplaints } from "@/server/services/complaints";
import { listMySubmissions, listReviewQueue } from "@/server/services/forms";
import { listNotifications } from "@/server/services/notifications";
import { prisma } from "@/lib/db";

const RUNS = Number(process.env.RUNS || 7);

function stats(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { p50: p(0.5), p95: p(0.95), min: sorted[0], max: sorted[sorted.length - 1] };
}

async function time(label: string, fn: () => Promise<unknown>) {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  const s = stats(times);
  console.log(
    `  ${label.padEnd(34)} p50 ${s.p50.toFixed(0).padStart(4)} ms · p95 ${s.p95.toFixed(0).padStart(4)} ms · min ${s.min.toFixed(0)} · max ${s.max.toFixed(0)} (n=${RUNS})`,
  );
}

async function main() {
  const student = await prisma.user.findUniqueOrThrow({ where: { email: "student@shu.edu.pk" } });
  const faculty = await prisma.user.findUniqueOrThrow({ where: { email: "faculty@shu.edu.pk" } });
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "coordinator@shu.edu.pk" } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@shu.edu.pk" } });

  console.log(`Database service timings (live Neon, n=${RUNS})\n`);
  await time("student dashboard (all widgets)", () => getDashboard(student));
  await time("faculty dashboard (all widgets)", () => getDashboard(faculty));
  await time("listMyAssignments (student)", () => listMyAssignments(student));
  await time("listMySubmissions (student)", () => listMySubmissions(student));
  await time("listMyComplaints (student)", () => listMyComplaints(student));
  await time("listManagedComplaints (admin)", () => listManagedComplaints(admin, { take: 20 }));
  await time("listReviewQueue (coordinator)", () => listReviewQueue(coordinator));
  await time("listNotifications (student)", () => listNotifications(student.id));

  const base = process.env.BASE?.replace(/\/$/, "");
  if (base) {
    console.log(`\nHTTP timings against ${base}\n`);
    const hit = async (path: string) => {
      const res = await fetch(base + path, { redirect: "manual" });
      return res.status;
    };
    await time("GET /api/health", () => hit("/api/health"));
    await time("GET / (landing)", () => hit("/"));
    await time("GET /sign-in", () => hit("/sign-in"));
    await time("GET /dashboard (307 auth redirect)", () => hit("/dashboard"));
    await time("GET /assignments (307 auth redirect)", () => hit("/assignments"));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
