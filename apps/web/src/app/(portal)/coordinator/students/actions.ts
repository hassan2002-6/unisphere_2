"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth";
import { correctStudentRecord } from "@/server/services/students";
import { ServiceError } from "@/server/services/forms";

/**
 * Authorized record corrections (spec §8). Coordinators (and admins) may fix a
 * student's academic placement with a recorded reason — everything is audited
 * and the student is notified.
 */
export async function correctStudentRecordAction(formData: FormData) {
  const me = await requireCapability("students.search");
  const studentId = String(formData.get("studentId") ?? "");
  const semesterRaw = String(formData.get("semester") ?? "").trim();
  const destination = `/coordinator/students/${studentId}`;

  if (!studentId) redirect("/coordinator/students");

  let note = "Record updated.";
  try {
    const { changed } = await correctStudentRecord(me, studentId, {
      section: String(formData.get("section") ?? ""),
      semester: semesterRaw ? Number.parseInt(semesterRaw, 10) : null,
      batch: String(formData.get("batch") ?? ""),
      program: String(formData.get("program") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });
    note = `Saved: ${changed.join("; ")}.`;
  } catch (e) {
    const message = e instanceof ServiceError ? e.message : "Could not update the record.";
    redirect(`${destination}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(destination);
  revalidatePath("/coordinator/students");
  redirect(`${destination}?saved=${encodeURIComponent(note)}`);
}
