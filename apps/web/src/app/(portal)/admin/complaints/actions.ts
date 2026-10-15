"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ServiceError } from "@/server/services/forms";
import {
  createComplaintCategory,
  deleteComplaintRoute,
  setComplaintCategoryActive,
  upsertComplaintRoute,
  type RouteInput,
} from "@/server/services/complaints-admin";
import type { ComplaintPriority, Role } from "@unisphere/db";

function back(params: string): never {
  revalidatePath("/admin/complaints");
  redirect(`/admin/complaints${params}`);
}

function fail(e: unknown): never {
  back(`?error=${encodeURIComponent(e instanceof ServiceError ? e.message : "Action failed — try again.")}`);
}

export async function createCategoryAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "complaints.route")) redirect("/dashboard?denied=1");
  try {
    await createComplaintCategory(user, {
      key: String(formData.get("key") ?? ""),
      label: String(formData.get("label") ?? ""),
    });
  } catch (e) {
    fail(e);
  }
  back("?ok=category");
}

export async function setCategoryActiveAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "complaints.route")) redirect("/dashboard?denied=1");
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "1";
  if (!id) return;
  try {
    await setComplaintCategoryActive(user, id, active);
  } catch (e) {
    fail(e);
  }
  back(`?ok=${active ? "category_on" : "category_off"}`);
}

export async function saveRouteAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "complaints.route")) redirect("/dashboard?denied=1");

  const id = String(formData.get("id") ?? "") || null;
  const targetRoleRaw = String(formData.get("targetRole") ?? "");
  const escalateToRaw = String(formData.get("escalateToRole") ?? "");
  const hoursRaw = String(formData.get("escalateAfterHours") ?? "");
  const priorityRaw = String(formData.get("defaultPriority") ?? "MEDIUM");

  const input: RouteInput = {
    categoryKey: String(formData.get("categoryKey") ?? ""),
    targetRole: (targetRoleRaw || null) as Role | null,
    targetUserId: String(formData.get("targetUserId") ?? "") || null,
    defaultPriority: (["LOW", "MEDIUM", "HIGH"].includes(priorityRaw) ? priorityRaw : "MEDIUM") as ComplaintPriority,
    escalateAfterHours: hoursRaw ? Number(hoursRaw) : null,
    escalateToRole: (escalateToRaw || null) as Role | null,
    sortOrder: Number(String(formData.get("sortOrder") ?? "0")) || 0,
    active: String(formData.get("active") ?? "1") === "1",
  };

  try {
    await upsertComplaintRoute(user, id, input);
  } catch (e) {
    fail(e);
  }
  back(`?ok=${id ? "route_updated" : "route_created"}`);
}

export async function deleteRouteAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "complaints.route")) redirect("/dashboard?denied=1");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await deleteComplaintRoute(user, id);
  } catch (e) {
    fail(e);
  }
  back("?ok=route_deleted");
}
