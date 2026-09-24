import { prisma } from "@/lib/db";
import type { ComplaintStatus, User } from "@unisphere/db";
import { assertTransition } from "@/server/status";
import { notifyRole, notifyUser } from "./notifications";
import { ServiceError } from "./forms";

export { ServiceError } from "./forms";

/**
 * Complaint Box service (plan M2d). Categories route: "Faculty" complaints
 * notify faculty + coordinator; others notify the coordinator. Status changes
 * write ComplaintEvents and notify the submitter (+ assignee) — §6.6.
 */

export const COMPLAINT_CATEGORIES = ["Faculty", "Facilities", "IT", "Examination", "Other"] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export async function createComplaint(
  user: User,
  input: { subject: string; category: string; description: string },
) {
  const subject = input.subject.trim().slice(0, 150);
  const description = input.description.trim().slice(0, 4000);
  const category = COMPLAINT_CATEGORIES.includes(input.category as ComplaintCategory)
    ? input.category
    : "Other";
  if (subject.length < 4) throw new ServiceError("validation_error", "Subject is too short", 422);
  if (description.length < 10) throw new ServiceError("validation_error", "Description is too short", 422);

  return prisma.$transaction(async (tx) => {
    const complaint = await tx.complaint.create({
      data: {
        submittedById: user.id,
        subject,
        category,
        description,
        status: "OPEN",
        events: { create: { actorId: user.id, status: "OPEN", comment: "Complaint filed" } },
      },
    });

    const body = `New ${category.toLowerCase()} complaint: "${subject}"`;
    if (category === "Faculty") {
      await notifyRole("FACULTY", { type: "COMPLAINT", title: "New faculty complaint", body, link: `/faculty/complaints` }, tx);
      await notifyRole("COORDINATOR", { type: "COMPLAINT", title: "New faculty complaint", body, link: `/coordinator/complaints` }, tx);
    } else {
      await notifyRole("COORDINATOR", { type: "COMPLAINT", title: "New complaint filed", body, link: `/coordinator/complaints` }, tx);
    }
    return complaint;
  });
}

export async function listMyComplaints(user: User, opts?: { cursor?: string; take?: number }) {
  const take = Math.min(opts?.take ?? 20, 50);
  const rows = await prisma.complaint.findMany({
    where: { submittedById: user.id },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : null };
}

/** Owner (submitter) or manager (faculty/coordinator) may read. 404 otherwise. */
export async function getComplaint(user: User, id: string) {
  const complaint = await prisma.complaint.findFirst({
    where:
      user.role === "FACULTY" || user.role === "COORDINATOR"
        ? { id }
        : { id, submittedById: user.id },
    include: {
      submittedBy: { select: { name: true, email: true, registrationNo: true } },
      assignedTo: { select: { name: true } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!complaint) throw new ServiceError("not_found", "Complaint not found", 404);
  return complaint;
}

/** Management list (faculty: Faculty category + assigned; coordinator: all). */
export async function listManagedComplaints(user: User, opts?: { cursor?: string; take?: number }) {
  const where =
    user.role === "FACULTY"
      ? { OR: [{ category: "Faculty" }, { assignedToId: user.id }] }
      : {};
  const take = Math.min(opts?.take ?? 20, 50);
  const rows = await prisma.complaint.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: take + 1,
    include: {
      submittedBy: { select: { name: true, registrationNo: true } },
      assignedTo: { select: { name: true } },
    },
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : null };
}

/** Transition + optional assign + comment. Faculty/coordinator only (capability-checked at call site AND here). */
export async function updateComplaint(
  user: User,
  id: string,
  to: Extract<ComplaintStatus, "IN_REVIEW" | "RESOLVED" | "CLOSED">,
  opts?: { comment?: string; assignToMe?: boolean },
) {
  if (user.role !== "FACULTY" && user.role !== "COORDINATOR") {
    throw new ServiceError("forbidden", "Only faculty and coordinators manage complaints", 403);
  }

  return prisma.$transaction(async (tx) => {
    const complaint = await tx.complaint.findUnique({
      where: { id },
      include: { submittedBy: { select: { id: true, name: true } } },
    });
    if (!complaint) throw new ServiceError("not_found", "Complaint not found", 404);
    if (user.role === "FACULTY" && complaint.category !== "Faculty" && complaint.assignedToId !== user.id) {
      throw new ServiceError("forbidden", "Faculty manage faculty-category or assigned complaints", 403);
    }

    assertTransition("complaint", complaint.status, to);

    const updated = await tx.complaint.update({
      where: { id },
      data: {
        status: to,
        ...(opts?.assignToMe ? { assignedToId: user.id } : {}),
        events: {
          create: {
            actorId: user.id,
            status: to,
            comment: opts?.comment?.slice(0, 1000) || null,
          },
        },
      },
    });

    await notifyUser(
      complaint.submittedBy.id,
      {
        type: "COMPLAINT",
        title: `Complaint ${to.replace("_", " ").toLowerCase()}`,
        body: opts?.comment
          ? `Update from ${user.name}: ${opts.comment}`
          : `Your complaint "${complaint.subject}" is now ${to.replace("_", " ").toLowerCase()}.`,
        link: `/complaints/${complaint.id}`,
      },
      tx,
    );
    if (updated.assignedToId && updated.assignedToId !== user.id) {
      await notifyUser(
        updated.assignedToId,
        {
          type: "COMPLAINT",
          title: "Complaint assigned to you",
          body: `"${complaint.subject}" is now ${to.replace("_", " ").toLowerCase()}.`,
          link: `/coordinator/complaints`,
        },
        tx,
      );
    }
    return updated;
  });
}
