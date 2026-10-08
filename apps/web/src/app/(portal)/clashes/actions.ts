"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { reportClash } from "@/server/services/clash-reports";
import type { ClashReportKind } from "@unisphere/db";

/** Student files a timetable / exam clash report (spec §12, §13). */
export async function reportClashAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "STUDENT") redirect("/dashboard?denied=1");

  const kind: ClashReportKind = formData.get("kind") === "EXAM" ? "EXAM" : "TIMETABLE";
  const description = String(formData.get("description") ?? "");
  const classId = String(formData.get("classId") ?? "").trim() || null;
  const otherClassId = String(formData.get("otherClassId") ?? "").trim() || null;
  const examId = String(formData.get("examId") ?? "").trim() || null;

  try {
    await reportClash(user, { kind, description, classId, otherClassId, examId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong";
    redirect(`/clashes?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/clashes");
  redirect("/clashes?reported=1");
}
