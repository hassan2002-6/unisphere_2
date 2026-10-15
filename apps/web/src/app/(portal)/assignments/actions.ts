"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  MAX_FILE_BYTES,
  ServiceError,
  UPLOAD_TYPES,
  extensionOf,
  submitAssignment,
} from "@/server/services/assignments";

/**
 * Shared submission-file reader — emptiness, size and extension validated
 * server-side before the service sees the bytes (the service re-checks the
 * assignment's own allowed list on top of this).
 */
async function readSubmissionFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new ServiceError("validation_error", "Attach your submission file", 422);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ServiceError(
      "validation_error",
      `Files must be ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB or smaller`,
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

/** Submit (or resubmit — one row per student, the latest file wins) an assignment file. */
export async function submitAssignmentAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "assignments.submit")) redirect("/dashboard?denied=1");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/assignments");
  const base = `/assignments/${id}`;

  try {
    const file = await readSubmissionFile(formData);
    await submitAssignment(user, id, {
      fileName: file.name,
      fileMime: file.mime,
      fileData: file.data,
      note: String(formData.get("note") ?? ""),
    });
  } catch (e) {
    const message = e instanceof ServiceError ? e.message : "Could not submit the file — try again.";
    redirect(`${base}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/assignments");
  revalidatePath(base);
  revalidatePath("/faculty/assignments");
  revalidatePath(`/faculty/assignments/${id}`);
  redirect(`${base}?submitted=1`);
}
