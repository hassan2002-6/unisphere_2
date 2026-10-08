"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth";
import { deleteSlot, saveSlot } from "@/server/services/timetable-manage";
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
