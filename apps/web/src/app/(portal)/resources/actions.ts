"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability, requireUser } from "@/lib/auth";
import {
  allocateRequest,
  cancelRequest,
  closeAllocation,
  createResourceRequest,
  recommendOrReject,
} from "@/server/services/resources";
import { ServiceError } from "@/server/services/forms";
import type { ResourceType } from "@unisphere/db";

const PATHS = ["/resources/request", "/resources/my", "/admin/requests", "/admin/allocations", "/admin/reports"];

export async function createResourceRequestAction(formData: FormData) {
  const user = await requireUser();
  try {
    await createResourceRequest(user, {
      projectName: String(formData.get("projectName") ?? ""),
      groupName: String(formData.get("groupName") ?? ""),
      members: String(formData.get("members") ?? ""),
      supervisor: String(formData.get("supervisor") ?? "") || undefined,
      resourceType: String(formData.get("resourceType") ?? "GPU") as ResourceType,
      config: String(formData.get("config") ?? ""),
      purpose: String(formData.get("purpose") ?? ""),
      startDate: String(formData.get("startDate") ?? ""),
      endDate: String(formData.get("endDate") ?? ""),
      timeSlot: String(formData.get("timeSlot") ?? ""),
    });
  } catch (e) {
    if (e instanceof ServiceError) {
      redirect(`/resources/request?error=${encodeURIComponent(e.message)}`);
    }
    redirect("/resources/request?error=Something+went+wrong");
  }
  for (const p of PATHS) revalidatePath(p);
  redirect("/resources/my?created=1");
}

export async function cancelRequestAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await cancelRequest(user, id);
  } catch {
    // illegal transition → ignore
  }
  for (const p of PATHS) revalidatePath(p);
}

export async function recommendAction(formData: FormData) {
  const user = await requireCapability("resources.manage");
  const id = String(formData.get("id") ?? "");
  const remarks = String(formData.get("remarks") ?? "");
  if (!id) return;
  try {
    await recommendOrReject(user, id, "RECOMMENDED", remarks);
  } catch {
    // ignore
  }
  for (const p of PATHS) revalidatePath(p);
}

export async function rejectRequestAction(formData: FormData) {
  const user = await requireCapability("resources.manage");
  const id = String(formData.get("id") ?? "");
  const remarks = String(formData.get("remarks") ?? "");
  if (!id) return;
  try {
    await recommendOrReject(user, id, "REJECTED", remarks);
  } catch {
    // ignore
  }
  for (const p of PATHS) revalidatePath(p);
}

export async function allocateAction(formData: FormData) {
  const user = await requireCapability("resources.manage");
  const id = String(formData.get("id") ?? "");
  const resourceId = String(formData.get("resourceId") ?? "");
  const labId = String(formData.get("labId") ?? "");
  const notes = String(formData.get("notes") ?? "");
  if (!id || !resourceId) return;
  try {
    await allocateRequest(user, id, { resourceId, labId: labId || undefined, notes });
  } catch {
    // no capacity / illegal → the queue re-renders truthfully
  }
  for (const p of PATHS) revalidatePath(p);
}

export async function closeAllocationAction(formData: FormData) {
  const user = await requireCapability("resources.manage");
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "") as "COMPLETED" | "REVOKED";
  const notes = String(formData.get("notes") ?? "");
  if (!id || !["COMPLETED", "REVOKED"].includes(action)) return;
  try {
    await closeAllocation(user, id, action, notes);
  } catch {
    // ignore
  }
  for (const p of PATHS) revalidatePath(p);
}
