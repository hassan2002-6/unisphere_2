"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { formFieldsSchema, type FormFieldSpec } from "@/lib/validation";
import { ServiceError, decideSubmission, resubmitForm, submitForm, withdrawSubmission, type SubmissionAttachment } from "@/server/services/forms";
import type { FormActionState } from "@/components/dynamic-form";
import type { FormStatus } from "@unisphere/db";

/** Read the optional supporting document from a form submission. */
async function readDoc(fd: FormData): Promise<SubmissionAttachment | null> {
  const file = fd.get("attachment");
  if (!(file instanceof File) || file.size === 0) return null;
  return { name: file.name, mime: file.type, data: Buffer.from(await file.arrayBuffer()) };
}

/** Build the payload object from FormData using the template's field spec. */
function payloadFromFormData(fields: FormFieldSpec[], fd: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = fd.get(f.name);
    if (f.type === "checkbox") {
      payload[f.name] = raw === "on" || raw === "true";
    } else if (raw === null || String(raw).trim() === "") {
      // leave out; required-ness is decided by the schema
    } else {
      payload[f.name] = String(raw);
    }
  }
  return payload;
}

export async function submitFormAction(
  templateKey: string,
  fieldsRaw: unknown,
  _prev: FormActionState | undefined,
  fd: FormData,
): Promise<FormActionState> {
  const user = await requireUser();

  const fieldsParsed = formFieldsSchema.safeParse(fieldsRaw);
  if (!fieldsParsed.success) return { error: "Template misconfigured — contact the administrator." };

  try {
    const sub = await submitForm(user, templateKey, payloadFromFormData(fieldsParsed.data, fd), await readDoc(fd));
    revalidatePath("/submissions");
    revalidatePath("/reviews");
    revalidatePath("/faculty/reviews");
    void sub;
  } catch (e) {
    if (e instanceof ServiceError) {
      return { error: e.status === 422 ? "Please fix the highlighted fields and try again." : e.message };
    }
    return { error: "Something went wrong while submitting — please try again." };
  }
  redirect("/submissions?submitted=1");
}

/**
 * Resubmit after a corrections request — same validation as the first submit;
 * the service checks ownership + that the status is CORRECTIONS_REQUESTED.
 */
export async function resubmitFormAction(
  id: string,
  fieldsRaw: unknown,
  _prev: FormActionState | undefined,
  fd: FormData,
): Promise<FormActionState> {
  const user = await requireUser();

  const fieldsParsed = formFieldsSchema.safeParse(fieldsRaw);
  if (!fieldsParsed.success) return { error: "Template misconfigured — contact the administrator." };

  try {
    await resubmitForm(user, id, payloadFromFormData(fieldsParsed.data, fd), await readDoc(fd));
    revalidatePath("/submissions");
    revalidatePath(`/submissions/${id}`);
    revalidatePath("/reviews");
    revalidatePath("/faculty/reviews");
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    return { error: "Something went wrong while resubmitting — please try again." };
  }
  redirect(`/submissions/${id}?resubmitted=1`);
}

export async function withdrawAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await withdrawSubmission(user, id);
  } catch {
    // invalid transition or not found → stay put; the page shows current state
  }
  revalidatePath("/submissions");
  revalidatePath(`/submissions/${id}`);
  revalidatePath("/reviews");
}

export async function decideAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "") as Extract<
    FormStatus,
    "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CORRECTIONS_REQUESTED"
  >;
  const comment = String(formData.get("comment") ?? "");
  if (!id || !["UNDER_REVIEW", "APPROVED", "REJECTED", "CORRECTIONS_REQUESTED"].includes(decision)) return;
  // A corrections request must explain itself — otherwise the student can't act on it.
  if (decision === "CORRECTIONS_REQUESTED" && !comment.trim()) return;

  try {
    await decideSubmission(user, id, decision, comment);
  } catch {
    // unauthorized or illegal transition → ignore; the queue re-renders truthfully
  }
  revalidatePath("/reviews");
  revalidatePath("/faculty/reviews");
  revalidatePath("/submissions");
}
