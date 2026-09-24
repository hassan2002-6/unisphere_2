"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth";
import { createLab, createResource, updateLab, updateResource } from "@/server/services/resources";
import type { ResourceType } from "@unisphere/db";

const PATHS = ["/admin/labs", "/admin/inventory", "/resources/request", "/admin/reports"];

function revalidateAll() {
  for (const p of PATHS) revalidatePath(p);
}

export async function createLabAction(formData: FormData) {
  await requireCapability("resources.manage");
  const name = String(formData.get("name") ?? "");
  const number = String(formData.get("number") ?? "");
  const capacity = Number(formData.get("capacity") ?? 0);
  const type = String(formData.get("type") ?? "");
  if (!name || !number) return;
  try {
    await createLab({ name, number, capacity, type });
  } catch {
    // validation → ignore; form re-renders
  }
  revalidateAll();
}

export async function updateLabAction(formData: FormData) {
  await requireCapability("resources.manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await updateLab(id, {
      capacity: formData.get("capacity") ? Number(formData.get("capacity")) : undefined,
      type: formData.get("type") !== null ? String(formData.get("type")) : undefined,
    });
  } catch {
    // ignore
  }
  revalidateAll();
}

export async function createResourceAction(formData: FormData) {
  await requireCapability("resources.manage");
  const name = String(formData.get("name") ?? "");
  const model = String(formData.get("model") ?? "");
  const type = String(formData.get("type") ?? "GPU") as ResourceType;
  const specs = String(formData.get("specs") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  if (!name || !model) return;
  try {
    await createResource({ name, model, type, specs, quantity });
  } catch {
    // ignore
  }
  revalidateAll();
}

export async function updateResourceAction(formData: FormData) {
  await requireCapability("resources.manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await updateResource(id, {
      quantity: formData.get("quantity") !== null ? Number(formData.get("quantity")) : undefined,
      available: formData.get("available") !== null ? Number(formData.get("available")) : undefined,
      specs: formData.get("specs") !== null ? String(formData.get("specs")) : undefined,
    });
  } catch {
    // ignore
  }
  revalidateAll();
}
