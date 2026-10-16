"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/auth";
import { decideCorrection } from "@/server/services/corrections";
import { ServiceError } from "@/server/services/forms";

/**
 * Admin review of data-correction requests (goal §6). Approve applies the
 * requested value to the real record; reject requires a note (the requester's
 * rejection message). Both decisions notify the requester and are audited.
 */

export async function decideCorrectionAction(formData: FormData) {
  const me = await requireCapability("corrections.manage");

  const id = String(formData.get("id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  const back = (key: "correctionDone" | "correctionError", message: string) =>
    `/admin/data?${key}=${encodeURIComponent(message)}`;

  if (!id || (decision !== "approve" && decision !== "reject")) {
    redirect(back("correctionError", "Pick a valid decision."));
  }

  try {
    await decideCorrection(me, id, { approve: decision === "approve", note: note || undefined });
  } catch (error) {
    redirect(back("correctionError", error instanceof ServiceError ? error.message : "Could not record the decision."));
  }

  revalidatePath("/admin/data");
  redirect(
    back(
      "correctionDone",
      decision === "approve"
        ? "Correction approved — the value was applied to the record and the requester was notified."
        : "Correction rejected — the requester was notified with your note.",
    ),
  );
}
