import { prisma } from "@/lib/db";
import type { ClashReportKind, ClashReportStatus, User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { recordAudit } from "./audit";
import { notifyRole, notifyUser } from "./notifications";

/**
 * Student-reported timetable / exam clashes (spec §12, §13).
 *
 * The *computed* clashes from the scheduler stay in schedule.ts — this is the
 * manual report path: a student flags a clash, coordinators (and admins) are
 * notified, and the resolution is recorded on the report with the reporter
 * notified at the end. Nothing here changes the official timetable directly.
 *
 * Guards live here as well as in the server actions (defense in depth — the
 * RBAC matrix in tests/rbac.test.ts keeps the two in sync).
 */

export type ClashReportRow = Awaited<ReturnType<typeof listClashReports>>[number];

export async function reportClash(
  user: User,
  input: {
    kind: ClashReportKind;
    description: string;
    classId?: string | null;
    otherClassId?: string | null;
    examId?: string | null;
  },
) {
  const description = input.description.trim();
  if (user.role !== "STUDENT") throw new Error("Only students can report a clash");
  if (description.length < 10) throw new Error("Please describe the clash (at least 10 characters)");

  const report = await prisma.clashReport.create({
    data: {
      reportedById: user.id,
      kind: input.kind,
      description: description.slice(0, 2000),
      classId: input.classId ?? null,
      otherClassId: input.otherClassId ?? null,
      examId: input.examId ?? null,
      status: "OPEN",
    },
  });

  await notifyRole("COORDINATOR", {
    type: "CLASH",
    title: `Clash reported — ${input.kind === "EXAM" ? "exam" : "timetable"}`,
    body: `${user.name}: ${description.slice(0, 140)}`,
    link: "/coordinator/clashes",
  });
  await notifyRole("ADMIN", {
    type: "CLASH",
    title: `Clash reported — ${input.kind === "EXAM" ? "exam" : "timetable"}`,
    body: `${user.name}: ${description.slice(0, 140)}`,
    link: "/coordinator/clashes",
  });

  await recordAudit({
    actorId: user.id,
    action: "clash.report",
    entity: "ClashReport",
    entityId: report.id,
    summary: `${input.kind === "EXAM" ? "Exam" : "Timetable"} clash reported: ${description.slice(0, 100)}`,
  });

  return report;
}

export async function listMyClashReports(user: User) {
  return prisma.clashReport.findMany({
    where: { reportedById: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

/** Coordinator / admin view — open reports first, then the resolved history. */
export async function listClashReports(user: User, opts?: { includeResolved?: boolean }) {
  if (!can(user.role, "clashes.manage") && !can(user.role, "clashes.view")) {
    throw new Error("Not permitted to view clash reports");
  }
  return prisma.clashReport.findMany({
    where: opts?.includeResolved ? {} : { status: "OPEN" },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
    include: {
      reportedBy: { select: { id: true, name: true, email: true, registrationNo: true, role: true } },
      handledBy: { select: { id: true, name: true } },
    },
  });
}

export async function resolveClashReport(
  user: User,
  reportId: string,
  input: { status: Extract<ClashReportStatus, "RESOLVED" | "DISMISSED">; note: string },
) {
  if (!can(user.role, "clashes.manage")) throw new Error("Not permitted to close clash reports");
  const note = input.note.trim();
  if (note.length < 3) throw new Error("Add a short resolution note");

  const report = await prisma.clashReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error("Report not found");
  if (report.status !== "OPEN") throw new Error("This report is already closed");

  const updated = await prisma.clashReport.update({
    where: { id: reportId },
    data: {
      status: input.status,
      resolutionNote: note.slice(0, 1000),
      handledById: user.id,
      handledAt: new Date(),
    },
  });

  await notifyUser(report.reportedById, {
    type: "CLASH",
    title: input.status === "RESOLVED" ? "Your clash report was resolved" : "Your clash report was reviewed",
    body: note.slice(0, 200),
    link: "/clashes",
  });

  await recordAudit({
    actorId: user.id,
    action: input.status === "RESOLVED" ? "clash.resolve" : "clash.dismiss",
    entity: "ClashReport",
    entityId: reportId,
    summary: `${input.status === "RESOLVED" ? "Resolved" : "Dismissed"} clash report — ${note.slice(0, 100)}`,
  });

  return updated;
}
