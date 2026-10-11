"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth";
import { deleteExam, saveExam } from "@/server/services/exam-manage";
import { ServiceError } from "@/server/services/forms";

/** Exam scheduling actions (spec §9) — coordinator/admin only. */

function toMinutes(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const MANAGER = "/coordinator/exams";

export async function saveExamAction(formData: FormData) {
  const user = await requireCapability("timetable.manage");
  const id = String(formData.get("id") ?? "") || undefined;
  const classId = String(formData.get("classId") ?? "");
  const date = String(formData.get("date") ?? "");
  const startMin = toMinutes(formData.get("start"));
  const endMin = toMinutes(formData.get("end"));
  const hall = String(formData.get("hall") ?? "").trim();

  if (!classId || !date || startMin === null || endMin === null) {
    redirect(`${MANAGER}?error=${encodeURIComponent("Pick a course, a date and valid start/end times (HH:MM).")}`);
  }

  let note = id ? "Exam updated — students and faculty were notified." : "Exam scheduled — students and faculty were notified.";
  try {
    const { warnings } = await saveExam(user, { id, classId, date, startMin, endMin, hall: hall || null });
    if (warnings.length > 0) {
      note += ` ⚠ ${warnings.length} advisory: ${warnings[0].detail}`;
    }
  } catch (e) {
    const message = e instanceof ServiceError ? e.message : "Could not save the exam.";
    redirect(`${MANAGER}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(MANAGER);
  revalidatePath("/exams");
  revalidatePath("/coordinator/clashes");
  revalidatePath("/dashboard");
  redirect(`${MANAGER}?saved=${encodeURIComponent(note)}`);
}

export async function deleteExamAction(formData: FormData) {
  const user = await requireCapability("timetable.manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await deleteExam(user, id);
  } catch (e) {
    const message = e instanceof ServiceError ? e.message : "Could not remove that exam.";
    redirect(`${MANAGER}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(MANAGER);
  revalidatePath("/exams");
  revalidatePath("/coordinator/clashes");
  redirect(`${MANAGER}?saved=${encodeURIComponent("Exam removed — students and faculty were notified.")}`);
}
