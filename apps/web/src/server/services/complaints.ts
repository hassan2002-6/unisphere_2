import { prisma } from "@/lib/db";
import type { ComplaintEventKind, ComplaintPriority, User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { toBytes } from "@/server/bytes";
import { assertTransition } from "@/server/status";
import { notifyRole, notifyUser } from "./notifications";
import { recordAudit } from "./audit";
import { ServiceError } from "./forms";

export { ServiceError } from "./forms";

/**
 * Complaint Box service (spec §6). A complaint is routed by the admin-managed
 * rules (ComplaintRoute) to a concrete recipient, carries a reference number,
 * and moves through a status machine with a full history. Students only ever
 * see PUBLIC events — internal notes stay internal.
 */

export const DEFAULT_CATEGORIES = ["Faculty", "Facilities", "IT", "Examination", "Other"] as const;

export const CLOSE_STATUSES = ["RESOLVED", "CLOSED"] as const;

/** Derived flag — a complaint past its response window that isn't resolved. */
export function isOverdue(c: { dueAt: Date | null; status: string }, now = new Date()): boolean {
  return !!c.dueAt && c.dueAt.getTime() < now.getTime() && !CLOSE_STATUSES.includes(c.status as (typeof CLOSE_STATUSES)[number]);
}

/** Reference number: CMP-<year>-<seq>, allocated per year with retry on races. */
async function nextRefNo(db: { complaint: { count: (args: { where: { refNo: { startsWith: string } } }) => Promise<number> } }, year: number): Promise<string> {
  const prefix = `CMP-${year}-`;
  const count = await db.complaint.count({ where: { refNo: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function listActiveCategories() {
  const rows = await prisma.complaintCategory.findMany({ where: { active: true }, orderBy: { label: "asc" } });
  if (rows.length > 0) return rows;
  // Fresh DB before seeding: fall back to the defaults so the form still works.
  return DEFAULT_CATEGORIES.map((key) => ({ id: key, key, label: key, active: true, createdAt: new Date() }));
}

type RouteTarget = { targetUserId: string | null; targetRole: string | null; defaultPriority: ComplaintPriority; escalateAfterHours: number | null; escalateToRole: string | null };

/** First active rule for the category; falls back to "route to coordinators". */
export async function resolveRouteForCategory(categoryKey: string): Promise<RouteTarget> {
  const route = await prisma.complaintRoute.findFirst({
    where: { categoryKey, active: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!route) {
    return { targetUserId: null, targetRole: "COORDINATOR", defaultPriority: "MEDIUM", escalateAfterHours: null, escalateToRole: null };
  }
  return {
    targetUserId: route.targetUserId,
    targetRole: route.targetRole,
    defaultPriority: route.defaultPriority,
    escalateAfterHours: route.escalateAfterHours,
    escalateToRole: route.escalateToRole,
  };
}

async function pickAssignee(target: RouteTarget): Promise<string | null> {
  if (target.targetUserId) {
    const explicit = await prisma.user.findFirst({ where: { id: target.targetUserId, isActive: true }, select: { id: true } });
    if (explicit) return explicit.id;
  }
  if (target.targetRole) {
    const roleUser = await prisma.user.findFirst({
      where: { role: target.targetRole as never, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (roleUser) return roleUser.id;
  }
  return null;
}

export type CreateComplaintInput = {
  subject: string;
  category: string;
  description: string;
  classId?: string | null;
  attachment?: { name: string; mime: string; data: Buffer } | null;
};

export async function createComplaint(user: User, input: CreateComplaintInput) {
  const subject = input.subject.trim().slice(0, 150);
  const description = input.description.trim().slice(0, 6000);
  if (subject.length < 4) throw new ServiceError("validation_error", "Subject is too short", 422);
  if (description.length < 10) throw new ServiceError("validation_error", "Description is too short", 422);

  const categories = await listActiveCategories();
  const category = categories.some((c) => c.key === input.category) ? input.category : (categories.find((c) => c.key === "Other")?.key ?? categories[0].key);

  let classId: string | null = null;
  if (input.classId) {
    const enrolled = await prisma.enrollment.count({ where: { classId: input.classId, studentId: user.id } });
    if (enrolled === 0) throw new ServiceError("forbidden", "You can only reference courses you are enrolled in", 403);
    classId = input.classId;
  }

  const target = await resolveRouteForCategory(category);
  const assigneeId = await pickAssignee(target);
  const now = new Date();
  const dueAt = target.escalateAfterHours ? new Date(now.getTime() + target.escalateAfterHours * 3600_000) : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const complaint = await prisma.$transaction(async (tx) => {
        const refNo = await nextRefNo(tx as never, now.getFullYear());
        const created = await tx.complaint.create({
          data: {
            refNo,
            submittedById: user.id,
            subject,
            category,
            description,
            priority: target.defaultPriority,
            classId,
            assignedToId: assigneeId,
            dueAt,
            attachmentName: input.attachment?.name ?? null,
            attachmentMime: input.attachment?.mime ?? null,
            attachmentSize: input.attachment?.data.length ?? null,
            attachmentData: input.attachment ? toBytes(input.attachment.data) : null,
            status: "OPEN",
            events: {
              create: [
                { actorId: user.id, status: "OPEN", kind: "STATUS", visibility: "PUBLIC", comment: "Complaint filed" },
                ...(assigneeId
                  ? [{ actorId: null, status: "OPEN" as const, kind: "FORWARD" as const, visibility: "PUBLIC" as const, assigneeToId: assigneeId, comment: "Routed by configuration" }]
                  : []),
              ],
            },
          },
        });

        if (assigneeId) {
          await notifyUser(
            assigneeId,
            { type: "COMPLAINT", title: `New complaint (${refNo})`, body: `${subject} — ${category}, priority ${target.defaultPriority.toLowerCase()}.`, link: "/coordinator/complaints" },
            tx,
          );
        } else {
          await notifyRole("COORDINATOR", { type: "COMPLAINT", title: `New complaint (${refNo})`, body: `${subject} — needs a recipient.`, link: "/coordinator/complaints" }, tx);
        }
        return created;
      });
      await recordAudit({
        actorId: user.id,
        action: "complaint.create",
        entity: "Complaint",
        entityId: complaint.id,
        summary: `${complaint.refNo} "${subject}" (${category}) → ${assigneeId ? "routed" : "unassigned"}`,
      });
      return complaint;
    } catch (e) {
      // Unique refNo collision under concurrency — retry with the next number.
      if (attempt === 4) throw e;
    }
  }
  throw new ServiceError("conflict", "Could not allocate a reference number — try again", 409);
}

/** Manager = assignee, coordinator, admin, or (unassigned faculty-category) faculty. */
function canManage(user: User, c: { assignedToId: string | null; category: string; submittedById: string }): boolean {
  if (!can(user.role, "complaints.manage")) return false;
  if (user.role === "COORDINATOR" || user.role === "ADMIN") return true;
  if (c.assignedToId === user.id) return true;
  return user.role === "FACULTY" && c.category === "Faculty" && c.assignedToId === null;
}

export async function listMyComplaints(user: User, opts?: { cursor?: string; take?: number }) {
  const take = Math.min(opts?.take ?? 20, 50);
  const rows = await prisma.complaint.findMany({
    where: { submittedById: user.id },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    include: { assignedTo: { select: { name: true } } },
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = (hasMore ? rows.slice(0, take) : rows).map((c) => ({ ...c, overdue: isOverdue(c) }));
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : null };
}

/** Submitter or manager may read. Students never see INTERNAL events. */
export async function getComplaint(user: User, id: string) {
  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: {
      submittedBy: { select: { id: true, name: true, email: true, registrationNo: true } },
      assignedTo: { select: { id: true, name: true, role: true } },
      class: { select: { courseCode: true, title: true, section: true } },
      events: {
        orderBy: { createdAt: "asc" },
        include: {
          actor: { select: { name: true, role: true } },
          assigneeFrom: { select: { name: true } },
          assigneeTo: { select: { name: true } },
        },
      },
    },
  });
  if (!complaint) throw new ServiceError("not_found", "Complaint not found", 404);
  const isOwner = complaint.submittedById === user.id;
  const manager = canManage(user, complaint);
  if (!isOwner && !manager) throw new ServiceError("not_found", "Complaint not found", 404);
  return {
    ...complaint,
    overdue: isOverdue(complaint),
    isManager: manager,
    events: isOwner && !manager ? complaint.events.filter((e) => e.visibility === "PUBLIC") : complaint.events,
  };
}

export type ManagedFilters = { status?: string; priority?: string; overdueOnly?: boolean; q?: string; cursor?: string; take?: number };

/** Management queue (assignee, faculty queue, coordinator/admin see all). */
export async function listManagedComplaints(user: User, opts?: ManagedFilters) {
  if (!can(user.role, "complaints.manage")) throw new ServiceError("forbidden", "Not allowed to manage complaints", 403);
  const take = Math.min(opts?.take ?? 20, 50);

  // URL-provided filters must never reach Prisma unchecked.
  const STATUS_VALUES = ["OPEN", "IN_REVIEW", "AWAITING_INFO", "RESOLVED", "CLOSED"];
  const PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH"];
  const statusFilter = opts?.status && STATUS_VALUES.includes(opts.status) ? opts.status : undefined;
  const priorityFilter = opts?.priority && PRIORITY_VALUES.includes(opts.priority) ? opts.priority : undefined;
  const q = opts?.q?.trim().slice(0, 80);

  const scope =
    user.role === "COORDINATOR" || user.role === "ADMIN"
      ? {}
      : user.role === "FACULTY"
        ? { OR: [{ assignedToId: user.id }, { category: "Faculty", assignedToId: null }] }
        : { assignedToId: user.id };

  const where = {
    AND: [
      scope,
      ...(statusFilter ? [{ status: statusFilter as never }] : []),
      ...(priorityFilter ? [{ priority: priorityFilter as never }] : []),
      ...(opts?.overdueOnly ? [{ dueAt: { lt: new Date() }, status: { notIn: ["RESOLVED", "CLOSED"] as never } }] : []),
      ...(q ? [{ OR: [{ subject: { contains: q, mode: "insensitive" as const } }, { refNo: { contains: q, mode: "insensitive" as const } }] }] : []),
    ],
  };

  const rows = await prisma.complaint.findMany({
    where,
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
    take: take + 1,
    include: {
      submittedBy: { select: { name: true, registrationNo: true } },
      assignedTo: { select: { name: true } },
    },
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = (hasMore ? rows.slice(0, take) : rows).map((c) => ({ ...c, overdue: isOverdue(c) }));
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : null };
}

async function loadForAction(user: User, id: string) {
  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: { submittedBy: { select: { id: true, name: true } } },
  });
  if (!complaint) throw new ServiceError("not_found", "Complaint not found", 404);
  if (!canManage(user, complaint)) {
    throw new ServiceError("forbidden", "Complaints you are not assigned to cannot be updated", 403);
  }
  return complaint;
}

type EventPayload = {
  kind: ComplaintEventKind;
  visibility?: "PUBLIC" | "INTERNAL";
  comment?: string | null;
  assigneeFromId?: string | null;
  assigneeToId?: string | null;
};

async function applyEvent(
  user: User,
  id: string,
  status: string,
  evt: EventPayload,
  extraData: { assignedToId?: string; priority?: ComplaintPriority } = {},
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.complaint.update({
      where: { id },
      data: {
        status: status as never,
        ...extraData,
        events: {
          create: {
            actorId: user.id,
            status: status as never,
            kind: evt.kind,
            visibility: evt.visibility ?? "PUBLIC",
            comment: evt.comment ?? null,
            assigneeFromId: evt.assigneeFromId ?? null,
            assigneeToId: evt.assigneeToId ?? null,
          },
        },
      },
    });
    return updated;
  });
}

export type ComplaintAction = "acknowledge" | "respond" | "request_info" | "resolve" | "close" | "forward" | "escalate";

export async function actOnComplaint(
  user: User,
  id: string,
  action: ComplaintAction,
  opts?: { comment?: string; toUserId?: string },
) {
  const complaint = await loadForAction(user, id);
  const comment = opts?.comment?.trim().slice(0, 2000) || null;

  if (action === "acknowledge") {
    assertTransition("complaint", complaint.status, "IN_REVIEW");
    const claim = !complaint.assignedToId ? { assignedToId: user.id } : {};
    const updated = await applyEvent(user, id, "IN_REVIEW", { kind: "STATUS", comment: comment ?? "Acknowledged" }, claim);
    await recordAudit({ actorId: user.id, action: "complaint.acknowledge", entity: "Complaint", entityId: id, summary: `${complaint.refNo} acknowledged` });
    return updated;
  }

  if (action === "respond") {
    if (!comment) throw new ServiceError("validation_error", "A response comment is required", 422);
    const updated = await applyEvent(user, id, complaint.status, { kind: "RESPONSE", comment });
    await notifyUser(complaint.submittedById, {
      type: "COMPLAINT",
      title: `Response on ${complaint.refNo}`,
      body: `${user.name}: ${comment}`,
      link: `/complaints/${id}`,
    });
    await recordAudit({ actorId: user.id, action: "complaint.respond", entity: "Complaint", entityId: id, summary: `${complaint.refNo} response` });
    return updated;
  }

  if (action === "request_info") {
    assertTransition("complaint", complaint.status, "AWAITING_INFO");
    const updated = await applyEvent(user, id, "AWAITING_INFO", { kind: "RESPONSE", comment: comment ?? "More information needed" });
    await notifyUser(complaint.submittedById, {
      type: "COMPLAINT",
      title: `${complaint.refNo}: information requested`,
      body: comment ?? "The office needs more information from you.",
      link: `/complaints/${id}`,
    });
    await recordAudit({ actorId: user.id, action: "complaint.request_info", entity: "Complaint", entityId: id, summary: `${complaint.refNo} awaiting info` });
    return updated;
  }

  if (action === "resolve" || action === "close") {
    const to = action === "resolve" ? "RESOLVED" : "CLOSED";
    assertTransition("complaint", complaint.status, to);
    const updated = await applyEvent(user, id, to, { kind: "STATUS", comment });
    await notifyUser(complaint.submittedById, {
      type: "COMPLAINT",
      title: `${complaint.refNo} ${to.toLowerCase()}`,
      body: comment ?? `Your complaint "${complaint.subject}" was ${to.toLowerCase()} by ${user.name}.`,
      link: `/complaints/${id}`,
    });
    await recordAudit({ actorId: user.id, action: `complaint.${action}`, entity: "Complaint", entityId: id, summary: `${complaint.refNo} ${to}` });
    return updated;
  }

  if (action === "forward") {
    if (!opts?.toUserId || opts.toUserId === complaint.assignedToId) {
      throw new ServiceError("validation_error", "Choose a different person to forward to", 422);
    }
    const target = await prisma.user.findFirst({
      where: { id: opts.toUserId, isActive: true, role: { in: ["FACULTY", "COORDINATOR", "FYP_HEAD", "ADMIN"] } },
      select: { id: true, name: true },
    });
    if (!target) throw new ServiceError("validation_error", "That person cannot receive complaints", 422);
    const updated = await applyEvent(user, id, complaint.status === "OPEN" ? "IN_REVIEW" : complaint.status, {
      kind: "FORWARD",
      comment: comment ?? `Forwarded to ${target.name}`,
      assigneeFromId: complaint.assignedToId,
      assigneeToId: target.id,
    }, { assignedToId: target.id });
    await notifyUser(target.id, {
      type: "COMPLAINT",
      title: `Complaint forwarded to you (${complaint.refNo})`,
      body: `${user.name} forwarded "${complaint.subject}".${comment ? ` Note: ${comment}` : ""}`,
      link: "/coordinator/complaints",
    });
    await notifyUser(complaint.submittedById, {
      type: "COMPLAINT",
      title: `${complaint.refNo} passed to ${target.name}`,
      body: `Your complaint is now with ${target.name}.`,
      link: `/complaints/${id}`,
    });
    await recordAudit({ actorId: user.id, action: "complaint.forward", entity: "Complaint", entityId: id, summary: `${complaint.refNo} → ${target.name}` });
    return updated;
  }

  // escalate — bump priority, reassign per the route's escalation target (or coordinators)
  const route = await resolveRouteForCategory(complaint.category);
  const escalateRole = route.escalateToRole ?? (complaint.category === "Faculty" ? "ADMIN" : "COORDINATOR");
  const escaper = await prisma.user.findFirst({
    where: { role: escalateRole as never, isActive: true, id: { not: complaint.assignedToId ?? undefined } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!escaper) throw new ServiceError("validation_error", "No escalation target is configured", 422);
  const updated = await applyEvent(user, id, complaint.status, {
    kind: "ESCALATION",
    comment: comment ?? `Escalated to ${escaper.name}`,
    assigneeFromId: complaint.assignedToId,
    assigneeToId: escaper.id,
  }, { assignedToId: escaper.id, priority: "HIGH" });
  await notifyUser(escaper.id, {
    type: "COMPLAINT",
    title: `Escalated complaint (${complaint.refNo})`,
    body: `"${complaint.subject}" was escalated by ${user.name}.`,
    link: "/coordinator/complaints",
  });
  await notifyUser(complaint.submittedById, {
    type: "COMPLAINT",
    title: `${complaint.refNo} escalated`,
    body: `Your complaint was escalated to a senior office for action.`,
    link: `/complaints/${id}`,
  });
  await recordAudit({ actorId: user.id, action: "complaint.escalate", entity: "Complaint", entityId: id, summary: `${complaint.refNo} escalated → ${escaper.name}` });
  return updated;
}

/** INTERNAL note — visible to managers only, never to the student. */
export async function addInternalNote(user: User, id: string, note: string) {
  const complaint = await loadForAction(user, id);
  const text = note.trim().slice(0, 2000);
  if (text.length < 2) throw new ServiceError("validation_error", "Note is too short", 422);
  const updated = await applyEvent(user, id, complaint.status, { kind: "NOTE", visibility: "INTERNAL", comment: text });
  await recordAudit({ actorId: user.id, action: "complaint.note", entity: "Complaint", entityId: id, summary: `${complaint.refNo} internal note` });
  return updated;
}

/** Submitter replies while the complaint is awaiting information (or to add detail). */
export async function replyToComplaint(user: User, id: string, comment: string) {
  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint || complaint.submittedById !== user.id) throw new ServiceError("not_found", "Complaint not found", 404);
  const text = comment.trim().slice(0, 2000);
  if (text.length < 2) throw new ServiceError("validation_error", "Reply is too short", 422);

  return prisma.$transaction(async (tx) => {
    let status = complaint.status;
    if (complaint.status === "AWAITING_INFO") {
      assertTransition("complaint", complaint.status, "IN_REVIEW");
      status = "IN_REVIEW";
    }
    const updated = await tx.complaint.update({
      where: { id },
      data: {
        status,
        events: { create: { actorId: user.id, status, kind: "RESPONSE", visibility: "PUBLIC", comment: text } },
      },
    });
    if (complaint.assignedToId) {
      await notifyUser(complaint.assignedToId, {
        type: "COMPLAINT",
        title: `Reply on ${complaint.refNo}`,
        body: `${user.name}: ${text.slice(0, 140)}`,
        link: "/coordinator/complaints",
      }, tx);
    }
    return updated;
  });
}

/** Attachment bytes — submitter or manager only. */
export async function getComplaintAttachment(user: User, id: string) {
  const c = await prisma.complaint.findUnique({ where: { id } });
  if (!c?.attachmentData || !c.attachmentName) throw new ServiceError("not_found", "No attachment", 404);
  if (c.submittedById !== user.id && !canManage(user, c)) throw new ServiceError("forbidden", "Not allowed", 403);
  return { fileName: c.attachmentName, mime: c.attachmentMime ?? "application/octet-stream", data: c.attachmentData };
}

/** People a complaint can be forwarded/escalated to (for the manager UI picker). */
export async function listComplaintHandlers() {
  return prisma.user.findMany({
    where: { isActive: true, role: { in: ["FACULTY", "COORDINATOR", "FYP_HEAD", "ADMIN"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, employeeId: true },
    take: 50,
  });
}
