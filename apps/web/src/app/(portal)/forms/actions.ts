"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { formFieldsSchema, type FormFieldSpec } from "@/lib/validation";
import { ServiceError, decideSubmission, submitForm, withdrawSubmission } from "@/server/services/forms";
import type { FormActionState } from "@/components/dynamic-form";
import type { FormStatus } from "@unisphere/db";

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
    const sub = await submitForm(user, templateKey, payloadFromFormData(fieldsParsed.data, fd));
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
    "UNDER_REVIEW" | "APPROVED" | "REJECTED"
  >;
  const comment = String(formData.get("comment") ?? "");
  if (!id || !["UNDER_REVIEW", "APPROVED", "REJECTED"].includes(decision)) return;

  try {
    await decideSubmission(user, id, decision, comment);
  } catch {
    // unauthorized or illegal transition → ignore; the queue re-renders truthfully
  }
  revalidatePath("/reviews");
  revalidatePath("/faculty/reviews");
  revalidatePath("/submissions");
}
