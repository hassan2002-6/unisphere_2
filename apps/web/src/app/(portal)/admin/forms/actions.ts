"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth";
import { setFormTemplateActive, upsertFormTemplate } from "@/server/services/forms-admin";
import { ServiceError } from "@/server/services/forms";

/** Activate / deactivate a form template (spec §11: admin configures forms). */
export async function toggleTemplateAction(formData: FormData) {
  const me = await requireCapability("users.manage");
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "") === "true";
  if (!id) redirect("/admin/forms");
  try {
    await setFormTemplateActive(me, id, next);
  } catch (e) {
    const msg = e instanceof ServiceError ? e.message : "Could not update the form.";
    redirect(`/admin/forms?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/forms");
  revalidatePath("/forms");
  redirect(`/admin/forms?saved=${encodeURIComponent(next ? "Form activated." : "Form deactivated — students no longer see it.")}`);
}

/** Create (or update) a form template with the compact field description. */
export async function saveTemplateAction(formData: FormData) {
  const me = await requireCapability("users.manage");
  const id = String(formData.get("id") ?? "") || undefined;
  try {
    await upsertFormTemplate(me, {
      id,
      key: String(formData.get("key") ?? ""),
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      audienceRole: String(formData.get("audienceRole") ?? "STUDENT"),
      reviewerRole: String(formData.get("reviewerRole") ?? "COORDINATOR"),
      recipientLabel: String(formData.get("recipientLabel") ?? "Coordination Office"),
      slaDays: String(formData.get("slaDays") ?? "") || null,
      fieldsText: String(formData.get("fieldsText") ?? ""),
      attachmentLabel: String(formData.get("attachmentLabel") ?? ""),
      requiresAttachment: String(formData.get("requiresAttachment") ?? "") === "on",
    });
  } catch (e) {
    const msg = e instanceof ServiceError ? e.message : "Could not save the form.";
    redirect(`/admin/forms?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/forms");
  revalidatePath("/forms");
  redirect(`/admin/forms?saved=${encodeURIComponent("Form template saved.")}`);
}
