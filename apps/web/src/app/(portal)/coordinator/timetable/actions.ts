"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth";
import { deleteSlot, saveClass, saveSlot } from "@/server/services/timetable-manage";
import { ServiceError } from "@/server/services/forms";

/** Accept "HH:MM" (native time input) → minutes since midnight. */
function toMinutes(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const MANAGER = "/coordinator/timetable";

export async function saveSlotAction(formData: FormData) {
  const user = await requireCapability("timetable.manage");
  const classId = String(formData.get("classId") ?? "");
  const id = String(formData.get("id") ?? "") || undefined;
  const day = String(formData.get("day") ?? "");
  const startMin = toMinutes(formData.get("start"));
  const endMin = toMinutes(formData.get("end"));
  const room = String(formData.get("room") ?? "").trim();

  if (!classId || startMin === null || endMin === null) {
    redirect(`${MANAGER}?error=${encodeURIComponent("Pick a day and valid start/end times (HH:MM).")}`);
  }

  let note = "Timetable session saved.";
  try {
    const { warnings } = await saveSlot(user, { id, classId, day, startMin, endMin, room: room || null });
    if (warnings.length > 0) note = `Saved with a note — ${warnings[0].detail}`;
  } catch (e) {
    const message = e instanceof ServiceError ? e.message : "Could not save the session.";
    redirect(`${MANAGER}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(MANAGER);
  revalidatePath("/timetable");
  revalidatePath("/coordinator/clashes");
  revalidatePath("/dashboard");
  redirect(`${MANAGER}?saved=${encodeURIComponent(note)}`);
}

export async function deleteSlotAction(formData: FormData) {
  const user = await requireCapability("timetable.manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await deleteSlot(user, id);
  } catch (e) {
    const message = e instanceof ServiceError ? e.message : "Could not remove that session.";
    redirect(`${MANAGER}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(MANAGER);
  revalidatePath("/timetable");
  revalidatePath("/coordinator/clashes");
  redirect(`${MANAGER}?saved=${encodeURIComponent("Session removed — faculty and students were notified.")}`);
}

/** Course & section management: create a section or reassign its faculty (§8). */
export async function saveClassAction(formData: FormData) {
  const user = await requireCapability("timetable.manage");
  const id = String(formData.get("id") ?? "") || undefined;
  const creditsRaw = String(formData.get("credits") ?? "").trim();
  const facultyId = String(formData.get("facultyId") ?? "").trim() || null;

  let note = id ? "Course updated." : "Course section created.";
  try {
    const saved = await saveClass(user, {
      id,
      courseCode: String(formData.get("courseCode") ?? ""),
      title: String(formData.get("title") ?? ""),
      section: String(formData.get("section") ?? ""),
      department: String(formData.get("department") ?? ""),
      semester: String(formData.get("semester") ?? ""),
      credits: creditsRaw ? Number.parseInt(creditsRaw, 10) : null,
      facultyId,
    });
    note = `${saved.courseCode} · Section ${saved.section} saved${saved.facultyId ? " — the faculty member was notified." : "."}`;
  } catch (e) {
    const message = e instanceof ServiceError ? e.message : "Could not save the course.";
    redirect(`${MANAGER}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(MANAGER);
  revalidatePath("/timetable");
  revalidatePath("/coordinator/clashes");
  redirect(`${MANAGER}?saved=${encodeURIComponent(note)}`);
}
