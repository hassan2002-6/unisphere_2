"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth";
import { addFypProgressUpdate } from "@/server/services/fyp";
import { ServiceError } from "@/server/services/forms";

/** Supervisor progress notes (spec §12) — faculty with supervised groups. */
export async function addProgressNoteAction(formData: FormData) {
  const me = await requireCapability("students.search");
  const applicationId = String(formData.get("applicationId") ?? "");
  const note = String(formData.get("note") ?? "");
  if (!applicationId) redirect("/faculty/fyp");

  let message = "Progress note saved — the group was notified.";
  try {
    await addFypProgressUpdate(me, applicationId, note);
  } catch (e) {
    message = e instanceof ServiceError ? e.message : "Could not save the note.";
    redirect(`/faculty/fyp?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/faculty/fyp");
  revalidatePath("/fyp");
  redirect(`/faculty/fyp?saved=${encodeURIComponent(message)}`);
}
