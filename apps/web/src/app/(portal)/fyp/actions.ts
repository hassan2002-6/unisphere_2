"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability, requireUser } from "@/lib/auth";
import { createFypApplication, decideFyp, requestFypChanges, resubmitFypApplication } from "@/server/services/fyp";
import { ServiceError } from "@/server/services/forms";

export async function createFypAction(formData: FormData) {
  const user = await requireUser();
  try {
    await createFypApplication(user, {
      title: String(formData.get("title") ?? ""),
      domain: String(formData.get("domain") ?? ""),
      description: String(formData.get("description") ?? ""),
      technologies: String(formData.get("technologies") ?? ""),
      groupName: String(formData.get("groupName") ?? ""),
      members: String(formData.get("members") ?? ""),
      registrationNos: String(formData.get("registrationNos") ?? ""),
      supervisorPref: String(formData.get("supervisorPref") ?? "") || undefined,
      department: String(formData.get("department") ?? ""),
      semester: String(formData.get("semester") ?? ""),
    });
  } catch (e) {
    if (e instanceof ServiceError) redirect(`/fyp?error=${encodeURIComponent(e.message)}`);
    redirect("/fyp?error=Something+went+wrong");
  }
  revalidatePath("/fyp");
  revalidatePath("/admin/fyp");
  redirect("/fyp?created=1");
}

export async function decideFypAction(formData: FormData) {
  const user = await requireCapability("fyp.decide");
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "") as "APPROVED" | "REJECTED";
  const remarks = String(formData.get("remarks") ?? "");
  const supervisorId = String(formData.get("supervisorId") ?? "") || undefined;
  if (!id || !["APPROVED", "REJECTED"].includes(decision)) return;
  try {
    await decideFyp(user, id, decision, remarks, supervisorId);
  } catch {
    // ignore
  }
  revalidatePath("/fyphead");
  revalidatePath("/admin/fyp");
  revalidatePath("/fyp");
  revalidatePath("/admin/reports");
  revalidatePath("/notifications");
}

/** Student revises and resubmits after corrections were requested (spec §12). */
export async function resubmitFypAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const input = {
    title: String(formData.get("title") ?? ""),
    domain: String(formData.get("domain") ?? ""),
    description: String(formData.get("description") ?? ""),
    technologies: String(formData.get("technologies") ?? ""),
    groupName: String(formData.get("groupName") ?? ""),
    members: String(formData.get("members") ?? ""),
    registrationNos: String(formData.get("registrationNos") ?? ""),
    supervisorPref: String(formData.get("supervisorPref") ?? "") || undefined,
    department: String(formData.get("department") ?? "Computer Science"),
    semester: String(formData.get("semester") ?? "Fall 2026"),
  };
  let message = "Revision submitted — the FYP committee will review it again.";
  try {
    await resubmitFypApplication(user, id, input);
  } catch (e) {
    message = e instanceof ServiceError ? e.message : "Could not resubmit.";
    redirect(`/fyp?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/fyp");
  revalidatePath("/fyphead");
  revalidatePath("/notifications");
  redirect(`/fyp?saved=${encodeURIComponent(message)}`);
}

/** Ask the group to fix something before a decision is made (spec §12). */
export async function requestChangesFypAction(formData: FormData) {
  const user = await requireCapability("fyp.decide");
  const id = String(formData.get("id") ?? "");
  const remarks = String(formData.get("remarks") ?? "");
  if (!id) return;
  try {
    await requestFypChanges(user, id, remarks);
  } catch {
    // ignore — the queue simply stays unchanged
  }
  revalidatePath("/fyphead");
  revalidatePath("/fyp");
  revalidatePath("/notifications");
}
