import { prisma } from "@/lib/db";
import type { ResourceType, User } from "@unisphere/db";
import { assertTransition } from "@/server/status";
import { notifyRole, notifyUser } from "./notifications";
import { ServiceError } from "./forms";

/**
 * GPU / lab resource workflow (plan M3 — the showcase spine).
 * PENDING → RECOMMENDED → ALLOCATED | REJECTED; PENDING/RECOMMENDED → CANCELLED (owner).
 * ALLOCATED creates exactly one Allocation in the same transaction, and the
 * availability decrement is guarded (`available > 0`) so two parallel
 * allocations of the last unit cannot both succeed — the acceptance test.
 */

export const RESOURCE_TYPES: ResourceType[] = ["GPU", "CPU", "WORKSTATION", "LAB"];

export async function createResourceRequest(
  user: User,
  input: {
    projectName: string;
    groupName: string;
    members: string;
    supervisor?: string;
    resourceType: ResourceType;
    config: string;
    purpose: string;
    startDate: string;
    endDate: string;
    timeSlot: string;
  },
) {
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new ServiceError("validation_error", "The requested window is invalid", 422);
  }
  if (input.purpose.trim().length < 10) {
    throw new ServiceError("validation_error", "Describe the purpose (at least 10 characters)", 422);
  }

  return prisma.$transaction(async (tx) => {
    const request = await tx.resourceRequest.create({
      data: {
        applicantId: user.id,
        projectName: input.projectName.trim().slice(0, 200),
        groupName: input.groupName.trim().slice(0, 200),
        members: input.members.trim().slice(0, 500),
        supervisor: input.supervisor?.trim().slice(0, 200) || null,
        resourceType: RESOURCE_TYPES.includes(input.resourceType) ? input.resourceType : "GPU",
        config: input.config.trim().slice(0, 300),
        purpose: input.purpose.trim().slice(0, 2000),
        startDate: start,
        endDate: end,
        timeSlot: input.timeSlot.trim().slice(0, 100),
        status: "PENDING",
      },
    });
    await notifyRole(
      "FYP_HEAD",
      {
        type: "RESOURCE",
        title: "New resource request",
        body: `${user.name} requested ${input.config} for "${request.projectName}".`,
        link: "/admin/requests",
      },
      tx,
    );
    return request;
  });
}

export async function listMyRequests(user: User) {
  return prisma.resourceRequest.findMany({
    where: { applicantId: user.id },
    orderBy: { createdAt: "desc" },
    include: { allocation: { include: { resource: true, lab: true } } },
  });
}

export async function listRequestQueue() {
  return prisma.resourceRequest.findMany({
    where: { status: { in: ["PENDING", "RECOMMENDED", "ALLOCATED"] } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      applicant: { select: { name: true, email: true, registrationNo: true } },
      allocation: { include: { resource: true, lab: true } },
    },
  });
}

/** FYP Head: PENDING → RECOMMENDED, or REJECTED with remarks. */
export async function recommendOrReject(
  user: User,
  id: string,
  decision: "RECOMMENDED" | "REJECTED",
  remarks?: string,
) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.resourceRequest.findUnique({
      where: { id },
      include: { applicant: { select: { id: true, name: true } } },
    });
    if (!req) throw new ServiceError("not_found", "Request not found", 404);
    assertTransition("resourceRequest", req.status, decision);

    const updated = await tx.resourceRequest.update({
      where: { id },
      data: { status: decision, remarks: remarks?.slice(0, 1000) || null, decidedById: user.id, decidedAt: new Date() },
    });
    await notifyUser(
      req.applicant.id,
      {
        type: "RESOURCE",
        title: decision === "RECOMMENDED" ? "Resource request recommended" : "Resource request rejected",
        body:
          decision === "RECOMMENDED"
            ? `Your request for "${req.projectName}" was recommended — allocation comes next.`
            : `Your request for "${req.projectName}" was rejected.${remarks ? ` Reason: ${remarks}` : ""}`,
        link: "/resources/my",
      },
      tx,
    );
    return updated;
  });
}

/**
 * Allocate (RECOMMENDED → ALLOCATED). Transactional + concurrency-safe:
 * the availability decrement is a guarded updateMany; exactly one of two
 * racing allocations of the last unit can succeed.
 */
export async function allocateRequest(
  user: User,
  id: string,
  input: { resourceId: string; labId?: string; notes?: string },
) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.resourceRequest.findUnique({
      where: { id },
      include: { applicant: { select: { id: true, name: true } }, allocation: true },
    });
    if (!req) throw new ServiceError("not_found", "Request not found", 404);
    if (req.allocation) throw new ServiceError("already_allocated", "This request already has an allocation", 409);
    assertTransition("resourceRequest", req.status, "ALLOCATED");

    const resource = await tx.resource.findUnique({ where: { id: input.resourceId } });
    if (!resource) throw new ServiceError("not_found", "Resource not found", 404);

    // Guarded decrement — atomic under row lock; count=0 ⇒ no capacity left.
    const dec = await tx.resource.updateMany({
      where: { id: resource.id, available: { gt: 0 } },
      data: { available: { decrement: 1 } },
    });
    if (dec.count === 0) {
      throw new ServiceError("no_capacity", `No units of ${resource.name} are available`, 409);
    }

    const allocation = await tx.allocation.create({
      data: {
        requestId: req.id,
        resourceId: resource.id,
        labId: input.labId || null,
        startDate: req.startDate,
        endDate: req.endDate,
        timeSlot: req.timeSlot,
        status: "ACTIVE",
        allocatedById: user.id,
        notes: input.notes?.slice(0, 500) || null,
      },
    });
    await tx.resourceRequest.update({
      where: { id: req.id },
      data: { status: "ALLOCATED", decidedById: user.id, decidedAt: new Date() },
    });
    await notifyUser(
      req.applicant.id,
      {
        type: "RESOURCE",
        title: "Resource allocated 🎉",
        body: `${resource.name} allocated for "${req.projectName}" (${req.timeSlot}).`,
        link: "/resources/my",
      },
      tx,
    );
    return allocation;
  });
}

/** Owner cancels (PENDING/RECOMMENDED only). */
export async function cancelRequest(user: User, id: string) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.resourceRequest.findFirst({ where: { id, applicantId: user.id } });
    if (!req) throw new ServiceError("not_found", "Request not found", 404);
    assertTransition("resourceRequest", req.status, "CANCELLED");
    return tx.resourceRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  });
}

/** Close an allocation: ACTIVE → COMPLETED | REVOKED (revoke returns the unit). */
export async function closeAllocation(
  user: User,
  allocationId: string,
  action: "COMPLETED" | "REVOKED",
  notes?: string,
) {
  return prisma.$transaction(async (tx) => {
    const allocation = await tx.allocation.findUnique({
      where: { id: allocationId },
      include: {
        resource: true,
        request: { include: { applicant: { select: { id: true } } } },
      },
    });
    if (!allocation) throw new ServiceError("not_found", "Allocation not found", 404);
    assertTransition("allocation", allocation.status, action);

    if (action === "REVOKED") {
      await tx.resource.update({
        where: { id: allocation.resourceId },
        data: { available: { increment: 1 } },
      });
    }
    const updated = await tx.allocation.update({
      where: { id: allocationId },
      data: { status: action, notes: notes?.slice(0, 500) || allocation.notes },
    });
    await notifyUser(
      allocation.request.applicant.id,
      {
        type: "RESOURCE",
        title: action === "COMPLETED" ? "Allocation completed" : "Allocation revoked",
        body: `${allocation.resource.name} for "${allocation.request.projectName}" is now ${action.toLowerCase()}.`,
        link: "/resources/my",
      },
      tx,
    );
    return updated;
  });
}

/** My allocations (student view) with resource + request info. */
export async function listMyAllocations(user: User) {
  return prisma.allocation.findMany({
    where: { request: { applicantId: user.id } },
    orderBy: { startDate: "desc" },
    include: { resource: true, lab: true, request: { select: { projectName: true } } },
  });
}

export async function listAllAllocations() {
  return prisma.allocation.findMany({
    orderBy: [{ status: "asc" }, { endDate: "asc" }],
    include: {
      resource: true,
      lab: true,
      request: { select: { projectName: true, applicant: { select: { name: true } } } },
    },
  });
}

export async function listResources() {
  return prisma.resource.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
}

export async function listLabs() {
  return prisma.lab.findMany({ orderBy: { number: "asc" } });
}

/* ---------- inventory management (FYP_HEAD) ---------- */

export async function createLab(input: { name: string; number: string; capacity: number; type?: string }) {
  if (!input.name.trim() || !input.number.trim()) throw new ServiceError("validation_error", "Name and number are required", 422);
  if (!Number.isFinite(input.capacity) || input.capacity < 1) {
    throw new ServiceError("validation_error", "Capacity must be a positive number", 422);
  }
  return prisma.lab.create({
    data: {
      name: input.name.trim().slice(0, 100),
      number: input.number.trim().slice(0, 20),
      capacity: Math.floor(input.capacity),
      type: input.type?.trim().slice(0, 50) || null,
    },
  });
}

export async function updateLab(id: string, input: { capacity?: number; type?: string }) {
  const data: { capacity?: number; type?: string | null } = {};
  if (input.capacity !== undefined && Number.isFinite(input.capacity) && input.capacity >= 1) {
    data.capacity = Math.floor(input.capacity);
  }
  if (input.type !== undefined) data.type = input.type.trim().slice(0, 50) || null;
  if (Object.keys(data).length === 0) throw new ServiceError("validation_error", "Nothing to update", 422);
  return prisma.lab.update({ where: { id }, data });
}

export async function createResource(input: {
  name: string;
  model: string;
  type: ResourceType;
  specs: string;
  quantity: number;
}) {
  if (!input.name.trim() || !input.model.trim()) throw new ServiceError("validation_error", "Name and model are required", 422);
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new ServiceError("validation_error", "Quantity must be a positive integer", 422);
  }
  return prisma.resource.create({
    data: {
      name: input.name.trim().slice(0, 100),
      model: input.model.trim().slice(0, 100),
      type: RESOURCE_TYPES.includes(input.type) ? input.type : "GPU",
      specs: input.specs.trim().slice(0, 300),
      quantity: input.quantity,
      available: input.quantity,
    },
  });
}

/** Adjust quantity/available; available is clamped to [0, quantity]. */
export async function updateResource(id: string, input: { quantity?: number; available?: number; specs?: string }) {
  const current = await prisma.resource.findUnique({ where: { id } });
  if (!current) throw new ServiceError("not_found", "Resource not found", 404);

  const quantity =
    input.quantity !== undefined && Number.isInteger(input.quantity) && input.quantity >= 1
      ? input.quantity
      : current.quantity;
  const available =
    input.available !== undefined && Number.isInteger(input.available)
      ? Math.min(Math.max(input.available, 0), quantity)
      : Math.min(current.available, quantity);

  return prisma.resource.update({
    where: { id },
    data: {
      quantity,
      available,
      ...(input.specs !== undefined ? { specs: input.specs.trim().slice(0, 300) } : {}),
    },
  });
}
