"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth";
import { createCorrectionRequest } from "@/server/services/corrections";
import { ServiceError } from "@/server/services/forms";

/**
 * Faculty data-correction requests (goal §6). Faculty cannot edit a student
 * record directly — they submit a whitelisted field change with a reason and
 * administrators review it from Admin → Data → Corrections.
 */

export type CorrectionActionState = { ok: boolean; message: string };

export async function requestCorrectionAction(formData: FormData): Promise<CorrectionActionState> {
  const me = await requireCapability("corrections.request");

  // The form posts `target` as "<entityType>:<field>" so one select covers the
  // whole whitelist; both halves are re-validated server-side in the service.
  const target = String(formData.get("target") ?? "");
  const separator = target.indexOf(":");
  const recordId = String(formData.get("recordId") ?? "").trim();

  try {
    await createCorrectionRequest(me, {
      entityType: separator > 0 ? target.slice(0, separator) : "",
      field: separator > 0 ? target.slice(separator + 1) : "",
      recordId,
      newValue: String(formData.get("newValue") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ServiceError ? error.message : "Could not submit the request — try again.",
    };
  }

  revalidatePath(`/faculty/students/${recordId}`);
  return {
    ok: true,
    message: "Request submitted — the administration office will review it and you will be notified of the decision.",
  };
}
