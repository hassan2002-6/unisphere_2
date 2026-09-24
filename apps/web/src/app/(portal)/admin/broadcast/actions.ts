"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth";
import { broadcast } from "@/server/services/notifications";
import type { Role } from "@unisphere/db";

const AUDIENCES: Role[] = ["STUDENT", "FACULTY", "COORDINATOR", "FYP_HEAD", "MENTOR"];

export async function sendBroadcast(formData: FormData) {
  const user = await requireCapability("broadcast");

  const audience = String(formData.get("audience") ?? "") as Role;
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 1000);
  const link = String(formData.get("link") ?? "").trim().slice(0, 300);
  if (!AUDIENCES.includes(audience) || title.length < 3 || body.length < 5) return;

  await broadcast(audience, {
    title,
    body,
    ...(link.startsWith("/") ? { link } : {}),
  });

  revalidatePath("/admin/broadcast");
}
