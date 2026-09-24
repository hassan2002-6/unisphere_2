"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ServiceError, createComplaint, updateComplaint } from "@/server/services/complaints";
import type { ComplaintStatus } from "@unisphere/db";

export async function createComplaintAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "complaints.submit")) redirect("/dashboard?denied=1");

  const subject = String(formData.get("subject") ?? "");
  const category = String(formData.get("category") ?? "Other");
  const description = String(formData.get("description") ?? "");
  let id: string;
  try {
    const created = await createComplaint(user, { subject, category, description });
    id = created.id;
  } catch (e) {
    if (e instanceof ServiceError) redirect(`/complaints/new?error=${encodeURIComponent(e.message)}`);
    redirect(`/complaints/new?error=Something+went+wrong`);
  }
  revalidatePath("/complaints");
  revalidatePath("/coordinator/complaints");
  revalidatePath("/faculty/complaints");
  redirect(`/complaints/${id}?created=1`);
}

export async function complaintTransitionAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "complaints.manage")) redirect("/dashboard?denied=1");

  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("status") ?? "") as Extract<ComplaintStatus, "IN_REVIEW" | "RESOLVED" | "CLOSED">;
  const comment = String(formData.get("comment") ?? "");
  const assignToMe = formData.get("assignToMe") === "on";
  if (!id || !["IN_REVIEW", "RESOLVED", "CLOSED"].includes(to)) return;

  try {
    await updateComplaint(user, id, to, { comment, assignToMe });
  } catch {
    // illegal transition / not allowed → re-render truthful state
  }
  revalidatePath("/coordinator/complaints");
  revalidatePath("/faculty/complaints");
  revalidatePath(`/complaints/${id}`);
}
