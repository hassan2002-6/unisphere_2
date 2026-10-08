"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveClashReport } from "@/server/services/clash-reports";

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

/** Coordinator resolves or dismisses a student-reported clash. */
export async function resolveClashReportAction(formData: FormData) {
  const user = await requireCapability("clashes.manage");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const status = String(formData.get("status") ?? "");
  if (status !== "RESOLVED" && status !== "DISMISSED") return;
  const note = String(formData.get("note") ?? "").trim();

  try {
    await resolveClashReport(user, id, { status, note });
  } catch {
    // Short notes and already-closed reports re-render the page's truthful state.
  }

  revalidatePath("/coordinator/clashes");
}
