import { prisma } from "@/lib/db";

/**
 * Reports (plan M3): counts per status + resource utilization.
 * Numbers must match the seed — asserted in later integration tests.
 */

export type ReportSummary = Awaited<ReturnType<typeof getSummary>>;

export async function getSummary() {
  const [
    usersByRole,
    formsByStatus,
    complaintsByStatus,
    fypByStatus,
    requestsByStatus,
    allocationsByStatus,
    resources,
    labs,
    internshipsOpen,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.formSubmission.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.fypApplication.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.resourceRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.allocation.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.resource.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
    prisma.lab.findMany({ orderBy: { number: "asc" } }),
    prisma.internship.count({ where: { status: "OPEN" } }),
  ]);

  const asCounts = (rows: { _count: { _all: number } }[], key: string) =>
    Object.fromEntries(
      rows.map((r) => [(r as unknown as Record<string, string>)[key], r._count._all] as const),
    );

  return {
    usersByRole: asCounts(usersByRole, "role"),
    formsByStatus: asCounts(formsByStatus, "status"),
    complaintsByStatus: asCounts(complaintsByStatus, "status"),
    fypByStatus: asCounts(fypByStatus, "status"),
    requestsByStatus: asCounts(requestsByStatus, "status"),
    allocationsByStatus: asCounts(allocationsByStatus, "status"),
    resources: resources.map((r) => ({
      name: r.name,
      model: r.model,
      type: r.type,
      quantity: r.quantity,
      available: r.available,
      inUse: r.quantity - r.available,
      utilizationPct: r.quantity > 0 ? Math.round(((r.quantity - r.available) / r.quantity) * 100) : 0,
    })),
    labs: labs.map((l) => ({ name: l.name, number: l.number, capacity: l.capacity, type: l.type })),
    internshipsOpen,
  };
}

export function summaryToCsv(s: ReportSummary): string {
  const lines: string[] = [];
  const section = (title: string) => lines.push("", `# ${title}`);
  const kv = (k: string, v: string | number) => lines.push(`${k},${v}`);

  lines.push("UniSphere report export");
  section("Users by role");
  for (const [k, v] of Object.entries(s.usersByRole)) kv(k, v);
  section("Forms by status");
  for (const [k, v] of Object.entries(s.formsByStatus)) kv(k, v);
  section("Complaints by status");
  for (const [k, v] of Object.entries(s.complaintsByStatus)) kv(k, v);
  section("FYP by status");
  for (const [k, v] of Object.entries(s.fypByStatus)) kv(k, v);
  section("Resource requests by status");
  for (const [k, v] of Object.entries(s.requestsByStatus)) kv(k, v);
  section("Allocations by status");
  for (const [k, v] of Object.entries(s.allocationsByStatus)) kv(k, v);
  section("Resource utilization");
  lines.push("name,model,type,quantity,available,inUse,utilizationPct");
  for (const r of s.resources) {
    lines.push([r.name, r.model, r.type, r.quantity, r.available, r.inUse, r.utilizationPct].join(","));
  }
  section("Labs");
  lines.push("name,number,capacity,type");
  for (const l of s.labs) lines.push([l.name, l.number, l.capacity, l.type ?? ""].join(","));
  section("Other");
  kv("openInternships", s.internshipsOpen);

  return lines.join("\n");
}
