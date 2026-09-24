"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Coordinator marks a computed clash as handled (records a note). */
export async function resolveClash(formData: FormData) {
  const user = await requireCapability("clashes.view");

  const key = String(formData.get("key") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (!key || key.length > 300) return;

  await prisma.clashResolution.upsert({
    where: { key },
    update: { note: note || null, resolvedById: user.id, resolvedAt: new Date() },
    create: { key, note: note || null, resolvedById: user.id },
  });

  revalidatePath("/coordinator/clashes");
}
