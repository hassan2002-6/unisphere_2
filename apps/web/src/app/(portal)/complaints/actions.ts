"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  ServiceError,
  actOnComplaint,
  addInternalNote,
  createComplaint,
  replyToComplaint,
  type ComplaintAction,
} from "@/server/services/complaints";
import { MAX_FILE_BYTES, UPLOAD_TYPES, extensionOf } from "@/server/services/assignments";

const MANAGE_ACTIONS = ["acknowledge", "respond", "request_info", "resolve", "close", "forward", "escalate"] as const;

/** Shared attachment reader — size + extension validated server-side (spec §6, §12). */
async function readUpload(formData: FormData, field: string) {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_FILE_BYTES) {
    throw new ServiceError("validation_error", `Attachments must be ${MAX_FILE_BYTES / 1024 / 1024} MB or smaller`, 422);
  }
  const ext = extensionOf(file.name);
  if (!(ext in UPLOAD_TYPES)) throw new ServiceError("validation_error", "Unsupported file type", 422);
  return { name: file.name.slice(0, 200), mime: file.type || UPLOAD_TYPES[ext][0], data: Buffer.from(await file.arrayBuffer()) };
}

export async function createComplaintAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "complaints.submit")) redirect("/dashboard?denied=1");

  let id: string;
  try {
    const attachment = await readUpload(formData, "attachment");
    const created = await createComplaint(user, {
      subject: String(formData.get("subject") ?? ""),
      category: String(formData.get("category") ?? "Other"),
      description: String(formData.get("description") ?? ""),
      classId: String(formData.get("classId") ?? "") || null,
      attachment,
      // Multi-recipient picker (goal §8) — empty lists fall back to routing.
      toIds: formData.getAll("toIds").map(String).filter(Boolean),
      ccIds: formData.getAll("ccIds").map(String).filter(Boolean),
    });
    id = created.id;
  } catch (e) {
    const message = e instanceof ServiceError ? e.message : "Something went wrong";
    redirect(`/complaints/new?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/complaints");
  revalidatePath("/coordinator/complaints");
  revalidatePath("/faculty/complaints");
  redirect(`/complaints/${id}?created=1`);
}

/** Recipient actions on a complaint (acknowledge → resolve/forward/escalate…). */
export async function complaintActionAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "complaints.manage")) redirect("/dashboard?denied=1");

  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  const comment = String(formData.get("comment") ?? "");
  const toUserId = String(formData.get("toUserId") ?? "");
  if (!id || !(MANAGE_ACTIONS as readonly string[]).includes(action)) return;

  let error: string | null = null;
  try {
    await actOnComplaint(user, id, action as ComplaintAction, { comment, toUserId: toUserId || undefined });
  } catch (e) {
    error = e instanceof ServiceError ? e.message : "Action failed";
  }
  revalidatePath("/coordinator/complaints");
  revalidatePath("/faculty/complaints");
  revalidatePath(`/complaints/${id}`);
  redirect(`/complaints/${id}${error ? `?error=${encodeURIComponent(error)}` : "?ok=1"}`);
}

export async function complaintNoteAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "complaints.manage")) redirect("/dashboard?denied=1");

  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "");
  let error: string | null = null;
  try {
    await addInternalNote(user, id, note);
  } catch (e) {
    error = e instanceof ServiceError ? e.message : "Note failed";
  }
  revalidatePath(`/complaints/${id}`);
  redirect(`/complaints/${id}${error ? `?error=${encodeURIComponent(error)}` : "?ok=1"}`);
}

/** Submitter reply (used when the office requests more information). */
export async function complaintReplyAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const comment = String(formData.get("comment") ?? "");
  let error: string | null = null;
  try {
    await replyToComplaint(user, id, comment);
  } catch (e) {
    error = e instanceof ServiceError ? e.message : "Reply failed";
  }
  revalidatePath(`/complaints/${id}`);
  redirect(`/complaints/${id}${error ? `?error=${encodeURIComponent(error)}` : "?ok=1"}`);
}
