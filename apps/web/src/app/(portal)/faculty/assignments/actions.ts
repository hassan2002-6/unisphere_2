"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  MAX_FILE_BYTES,
  ServiceError,
  UPLOAD_TYPES,
  createAssignment,
  extensionOf,
  gradeSubmission,
  updateAssignment,
} from "@/server/services/assignments";

/** Optional faculty attachment — returns null when no file was chosen. */
async function readAttachment(formData: FormData) {
  const file = formData.get("attachment");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_FILE_BYTES) {
    throw new ServiceError(
      "validation_error",
      `Attachments must be ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB or smaller`,
      422,
    );
  }
  const ext = extensionOf(file.name);
  if (!(ext in UPLOAD_TYPES)) {
    throw new ServiceError("validation_error", "Unsupported file type", 422);
  }
  return {
    name: file.name.slice(0, 200),
    mime: file.type || UPLOAD_TYPES[ext][0],
    data: Buffer.from(await file.arrayBuffer()),
  };
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof ServiceError ? e.message : fallback;
}

/** Faculty: post a new assignment to a class (with an optional attachment). */
export async function createAssignmentAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "assignments.manage")) redirect("/dashboard?denied=1");

  const base = "/faculty/assignments";
  let createdId: string;
  try {
    const classId = String(formData.get("classId") ?? "");
    if (!classId) throw new ServiceError("validation_error", "Pick a class for the assignment", 422);
    const attachment = await readAttachment(formData);
    const created = await createAssignment(user, {
      classId,
      title: String(formData.get("title") ?? ""),
      instructions: String(formData.get("instructions") ?? ""),
      deadline: new Date(String(formData.get("deadline") ?? "")),
      maxMarks: Number(formData.get("maxMarks") ?? ""),
      allowedTypes: String(formData.get("allowedTypes") ?? ""),
      attachment,
    });
    createdId = created.id;
  } catch (e) {
    redirect(`${base}?error=${encodeURIComponent(errorMessage(e, "Could not post the assignment — try again."))}`);
  }

  revalidatePath(base);
  revalidatePath("/assignments");
  redirect(`${base}/${createdId}?ok=1`);
}

/** Faculty: edit an assignment's title, instructions, deadline, marks or allowed types. */
export async function updateAssignmentAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "assignments.manage")) redirect("/dashboard?denied=1");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/faculty/assignments");
  const base = `/faculty/assignments/${id}`;

  try {
    await updateAssignment(user, id, {
      title: String(formData.get("title") ?? ""),
      instructions: String(formData.get("instructions") ?? ""),
      deadline: new Date(String(formData.get("deadline") ?? "")),
      maxMarks: Number(formData.get("maxMarks") ?? ""),
      allowedTypes: String(formData.get("allowedTypes") ?? ""),
    });
  } catch (e) {
    redirect(`${base}?error=${encodeURIComponent(errorMessage(e, "Could not update the assignment — try again."))}`);
  }

  revalidatePath("/faculty/assignments");
  revalidatePath(base);
  revalidatePath("/assignments");
  revalidatePath(`/assignments/${id}`);
  redirect(`${base}?ok=1`);
}

/** Faculty: close (or reopen) an assignment — closing stops new submissions. */
export async function closeAssignmentAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "assignments.manage")) redirect("/dashboard?denied=1");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/faculty/assignments");
  const base = `/faculty/assignments/${id}`;
  const closed = String(formData.get("closed") ?? "1") !== "0";

  try {
    await updateAssignment(user, id, { closed });
  } catch (e) {
    redirect(`${base}?error=${encodeURIComponent(errorMessage(e, "Could not update the assignment — try again."))}`);
  }

  revalidatePath("/faculty/assignments");
  revalidatePath(base);
  revalidatePath("/assignments");
  revalidatePath(`/assignments/${id}`);
  redirect(`${base}?ok=1`);
}

/** Faculty: grade (or re-grade) one submission — marks validated against 0..maxMarks. */
export async function gradeSubmissionAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "assignments.manage")) redirect("/dashboard?denied=1");

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const base = assignmentId ? `/faculty/assignments/${assignmentId}` : "/faculty/assignments";

  try {
    const submissionId = String(formData.get("submissionId") ?? "");
    if (!submissionId) throw new ServiceError("validation_error", "That submission is missing — reload the page.", 422);
    const rawMarks = String(formData.get("marks") ?? "").trim();
    const marks = rawMarks === "" ? NaN : Number(rawMarks);
    const rawMax = String(formData.get("maxMarks") ?? "").trim();
    const maxMarks = rawMax === "" ? NaN : Number(rawMax);
    if (!Number.isFinite(marks) || marks < 0 || (Number.isFinite(maxMarks) && marks > maxMarks)) {
      throw new ServiceError(
        "validation_error",
        `Marks must be between 0 and ${Number.isFinite(maxMarks) ? maxMarks : "the maximum"}`,
        422,
      );
    }
    await gradeSubmission(user, submissionId, { marks, feedback: String(formData.get("feedback") ?? "") });
  } catch (e) {
    redirect(`${base}?error=${encodeURIComponent(errorMessage(e, "Could not save the grade — try again."))}`);
  }

  revalidatePath("/faculty/assignments");
  revalidatePath(base);
  revalidatePath("/assignments");
  if (assignmentId) revalidatePath(`/assignments/${assignmentId}`);
  redirect(`${base}?ok=1`);
}
