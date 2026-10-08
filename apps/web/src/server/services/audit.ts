import { prisma } from "@/lib/db";
import type { Prisma } from "@unisphere/db";

/**
 * Audit trail (spec §7 "action history / audit logs", §18).
 * Writes are best-effort: a failure to audit must never break the action it
 * records, so everything is wrapped and swallowed.
 */

export type AuditInput = {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string;
  meta?: Prisma.InputJsonValue;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        meta: input.meta ?? undefined,
      },
    });
  } catch {
    // best-effort only
  }
}

export type AuditEntry = Awaited<ReturnType<typeof listAudit>>[number];

export async function listAudit(opts?: { take?: number; entity?: string; actorId?: string }) {
  return prisma.auditLog.findMany({
    where: {
      ...(opts?.entity ? { entity: opts.entity } : {}),
      ...(opts?.actorId ? { actorId: opts.actorId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 60,
    include: { actor: { select: { name: true, email: true, role: true } } },
  });
}

/** Distinct entity names present in the log (for the filter bar). */
export async function auditEntities(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ["entity"],
    select: { entity: true },
    orderBy: { entity: "asc" },
  });
  return rows.map((r) => r.entity);
}
