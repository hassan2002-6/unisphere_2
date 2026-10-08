"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth";
import { ATTENDANCE_STATUSES, markAttendance, parseDateOnly, toDateOnly } from "@/server/services/attendance";
import type { AttendanceStatus } from "@unisphere/db";

/** Mark (or re-mark) one class session from the faculty register form. */
export async function markAttendanceAction(formData: FormData) {
  const user = await requireCapability("attendance.manage");

  const classId = String(formData.get("classId") ?? "");
  if (!classId) redirect("/faculty/attendance");
  const base = `/faculty/attendance/${classId}`;

  const rawDate = String(formData.get("date") ?? "");
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && toDateOnly(parseDateOnly(rawDate)) === rawDate;
  if (!validDate) {
    redirect(`${base}?error=${encodeURIComponent("Pick a valid session date (YYYY-MM-DD).")}`);
  }

  const entries: { studentId: string; status: AttendanceStatus }[] = [];
  for (const [key, value] of formData.entries()) {
    const match = /^status\[(.+)\]$/.exec(key);
    if (!match) continue;
    const status = String(value) as AttendanceStatus;
    if (!ATTENDANCE_STATUSES.includes(status)) continue;
    entries.push({ studentId: match[1], status });
  }
  if (entries.length === 0) {
    redirect(
      `${base}?date=${encodeURIComponent(rawDate)}&error=${encodeURIComponent("Select a status for at least one student.")}`,
    );
  }

  try {
    await markAttendance(user, classId, rawDate, entries);
  } catch (e) {
    const message = e instanceof Error && e.message ? e.message : "Could not save the register — try again.";
    redirect(`${base}?date=${encodeURIComponent(rawDate)}&error=${encodeURIComponent(message)}`);
  }

  revalidatePath(base);
  revalidatePath("/faculty/attendance");
  redirect(`${base}?date=${encodeURIComponent(rawDate)}&saved=1`);
}
