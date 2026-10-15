import { prisma } from "@/lib/db";
import type { ComplaintPriority, Role, User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { recordAudit } from "./audit";
import { ServiceError } from "./forms";

/**
 * Admin management of the complaint pipeline (spec §6/§C): the categories the
 * filing form offers and the routing rules that decide who receives a
 * complaint, at what priority, and when it escalates.
 */

function assertRouter(user: User) {
  if (!can(user.role, "complaints.route")) {
    throw new ServiceError("forbidden", "Only administrators manage complaint routing", 403);
  }
}

export async function listComplaintCategories(user: User) {
  assertRouter(user);
  return prisma.complaintCategory.findMany({ orderBy: { key: "asc" } });
}

function sanitizeCategory(input: { key: string; label: string }) {
  const key = input.key.trim().slice(0, 60);
  const label = input.label.trim().slice(0, 80);
  if (key.length < 2) throw new ServiceError("validation_error", "Category key is too short", 422);
  if (!/^[\w &()-]+$/.test(key)) throw new ServiceError("validation_error", "Category key may only contain letters, numbers, spaces and - & ( )", 422);
  if (!label) throw new ServiceError("validation_error", "Category label is required", 422);
  return { key, label };
}

export async function createComplaintCategory(user: User, input: { key: string; label: string }) {
  assertRouter(user);
  const data = sanitizeCategory(input);
  const existing = await prisma.complaintCategory.findUnique({ where: { key: data.key } });
  if (existing) throw new ServiceError("conflict", "That category key already exists", 409);
  const cat = await prisma.complaintCategory.create({ data });
  await recordAudit({
    actorId: user.id,
    action: "complaints.category_create",
    entity: "ComplaintCategory",
    entityId: cat.id,
    summary: `Added complaint category “${cat.label}”`,
  });
  return cat;
}

export async function setComplaintCategoryActive(user: User, id: string, active: boolean) {
  assertRouter(user);
  const cat = await prisma.complaintCategory.findUnique({ where: { id } });
  if (!cat) throw new ServiceError("not_found", "Category not found", 404);
  await prisma.complaintCategory.update({ where: { id }, data: { active } });
  await recordAudit({
    actorId: user.id,
    action: active ? "complaints.category_enable" : "complaints.category_disable",
    entity: "ComplaintCategory",
    entityId: id,
    summary: `${active ? "Re-enabled" : "Disabled"} complaint category “${cat.label}”`,
  });
}

const PRIORITIES: ComplaintPriority[] = ["LOW", "MEDIUM", "HIGH"];
const ROUTE_ROLES: Role[] = ["FACULTY", "COORDINATOR", "FYP_HEAD", "ADMIN"];

export async function listComplaintRoutes(user: User) {
  assertRouter(user);
  const routes = await prisma.complaintRoute.findMany({ orderBy: [{ sortOrder: "asc" }, { categoryKey: "asc" }] });
  const userIds = routes.map((r) => r.targetUserId).filter((v): v is string => Boolean(v));
  const handlers = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: true } })
    : [];
  const nameById = new Map(handlers.map((h) => [h.id, h.name]));
  return routes.map((r) => ({ ...r, targetUserName: r.targetUserId ? (nameById.get(r.targetUserId) ?? null) : null }));
}

export type RouteInput = {
  categoryKey: string;
  targetRole: Role | null;
  targetUserId: string | null;
  defaultPriority: ComplaintPriority;
  escalateAfterHours: number | null;
  escalateToRole: Role | null;
  sortOrder: number;
  active: boolean;
};

function sanitizeRoute(input: RouteInput): RouteInput {
  if (!input.categoryKey) throw new ServiceError("validation_error", "Pick a category for this rule", 422);
  if (!input.targetRole && !input.targetUserId) throw new ServiceError("validation_error", "Pick a target role or a specific person", 422);
  if (input.targetRole && !ROUTE_ROLES.includes(input.targetRole)) {
    throw new ServiceError("validation_error", "That role can’t handle complaints", 422);
  }
  if (!PRIORITIES.includes(input.defaultPriority)) throw new ServiceError("validation_error", "Unknown priority", 422);
  const hours = input.escalateAfterHours === null ? null : Math.max(1, Math.min(24 * 30, Math.trunc(input.escalateAfterHours)));
  return { ...input, escalateAfterHours: hours, sortOrder: Math.max(0, Math.min(999, Math.trunc(input.sortOrder))) };
}

export async function upsertComplaintRoute(user: User, id: string | null, input: RouteInput) {
  assertRouter(user);
  const data = sanitizeRoute(input);
  const category = await prisma.complaintCategory.findUnique({ where: { key: data.categoryKey } });
  if (!category) throw new ServiceError("validation_error", "Unknown category — create it first", 422);
  // A specific assignee must be an active staff member who could legally
  // receive complaints — never a student account.
  if (data.targetUserId) {
    const target = await prisma.user.findFirst({
      where: { id: data.targetUserId, isActive: true, role: { in: ROUTE_ROLES } },
      select: { id: true },
    });
    if (!target) throw new ServiceError("validation_error", "That person can’t receive complaints", 422);
  }

  if (id) {
    const existing = await prisma.complaintRoute.findUnique({ where: { id } });
    if (!existing) throw new ServiceError("not_found", "Routing rule not found", 404);
    const updated = await prisma.complaintRoute.update({ where: { id }, data });
    await recordAudit({
      actorId: user.id,
      action: "complaints.route_update",
      entity: "ComplaintRoute",
      entityId: id,
      summary: `Updated routing for “${data.categoryKey}” → ${data.targetRole ?? "specific person"}`,
    });
    return updated;
  }

  const created = await prisma.complaintRoute.create({ data });
  await recordAudit({
    actorId: user.id,
    action: "complaints.route_create",
    entity: "ComplaintRoute",
    entityId: created.id,
    summary: `Routed “${data.categoryKey}” → ${data.targetRole ?? "specific person"} (${data.defaultPriority})`,
  });
  return created;
}

export async function deleteComplaintRoute(user: User, id: string) {
  assertRouter(user);
  const route = await prisma.complaintRoute.findUnique({ where: { id } });
  if (!route) throw new ServiceError("not_found", "Routing rule not found", 404);
  await prisma.complaintRoute.delete({ where: { id } });
  await recordAudit({
    actorId: user.id,
    action: "complaints.route_delete",
    entity: "ComplaintRoute",
    entityId: id,
    summary: `Removed routing rule for “${route.categoryKey}”`,
  });
}

/** People an admin can point a rule or a forward at. */
export async function listRouteTargets(user: User) {
  assertRouter(user);
  return prisma.user.findMany({
    where: { isActive: true, role: { in: ROUTE_ROLES } },
    select: { id: true, name: true, role: true, email: true },
    orderBy: { name: "asc" },
    take: 200,
  });
}
