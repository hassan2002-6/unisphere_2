"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth";
import { createAssessment, enterScores, publishResults } from "@/server/services/marks";
import type { AssessmentKind } from "@unisphere/db";

const ASSESSMENT_KINDS = ["QUIZ", "ASSIGNMENT", "MIDTERM", "FINAL", "PROJECT"] as const;

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** Save the marks form of one assessment (blank box = clear the mark). */
export async function enterScoresAction(formData: FormData) {
  const user = await requireCapability("marks.manage");

  const classId = String(formData.get("classId") ?? "");
  if (!classId) redirect("/faculty/marks");
  const base = `/faculty/marks/${classId}`;

  const assessmentId = String(formData.get("assessmentId") ?? "");
  if (!assessmentId) {
    redirect(`${base}?error=${encodeURIComponent("That assessment is missing — reload the page.")}`);
  }

  const entries: { studentId: string; marks: number | null }[] = [];
  for (const [key, value] of formData.entries()) {
    const match = /^score\[(.+)\]$/.exec(key);
    if (!match) continue;
    const raw = String(value).trim();
    if (raw === "") {
      entries.push({ studentId: match[1], marks: null });
      continue;
    }
    const marks = Number(raw);
    if (!Number.isFinite(marks)) continue;
    entries.push({ studentId: match[1], marks });
  }
  if (entries.length === 0) {
    redirect(`${base}?error=${encodeURIComponent("Nothing to save — enter at least one mark.")}`);
  }

  try {
    await enterScores(user, assessmentId, entries);
  } catch (e) {
    redirect(`${base}?error=${encodeURIComponent(errorMessage(e, "Could not save marks — try again."))}`);
  }

  revalidatePath(base);
  revalidatePath("/faculty/marks");
  redirect(`${base}?saved=1`);
}

/** Create an assessment on a class (kind, title, maxMarks, optional date). */
export async function createAssessmentAction(formData: FormData) {
  const user = await requireCapability("marks.manage");

  const classId = String(formData.get("classId") ?? "");
  if (!classId) redirect("/faculty/marks");
  const base = `/faculty/marks/${classId}`;

  const kindRaw = String(formData.get("kind") ?? "");
  if (!(ASSESSMENT_KINDS as readonly string[]).includes(kindRaw)) {
    redirect(`${base}?error=${encodeURIComponent("Pick an assessment kind.")}`);
  }
  const kind = kindRaw as AssessmentKind;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    redirect(`${base}?error=${encodeURIComponent("Give the assessment a title.")}`);
  }

  const maxMarks = Number(formData.get("maxMarks") ?? "");
  if (!Number.isFinite(maxMarks) || maxMarks <= 0) {
    redirect(`${base}?error=${encodeURIComponent("Max marks must be a positive number.")}`);
  }

  const rawDate = String(formData.get("date") ?? "").trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;

  try {
    await createAssessment(user, classId, { kind, title, maxMarks, date });
  } catch (e) {
    redirect(`${base}?error=${encodeURIComponent(errorMessage(e, "Could not add the assessment — try again."))}`);
  }

  revalidatePath(base);
  redirect(`${base}?saved=assessment`);
}

/** Publish (or re-publish) results; the service computes grades and notifies students. */
export async function publishResultsAction(formData: FormData) {
  const user = await requireCapability("marks.manage");

  const classId = String(formData.get("classId") ?? "");
  if (!classId) redirect("/faculty/marks");
  const base = `/faculty/marks/${classId}`;

  try {
    await publishResults(user, classId);
  } catch (e) {
    redirect(`${base}?error=${encodeURIComponent(errorMessage(e, "Could not publish results — try again."))}`);
  }

  revalidatePath(base);
  revalidatePath("/faculty/marks");
  redirect(`${base}?saved=published`);
}
