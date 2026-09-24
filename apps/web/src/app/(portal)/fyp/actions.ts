"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability, requireUser } from "@/lib/auth";
import { createFypApplication, decideFyp } from "@/server/services/fyp";
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
  if (!id || !["APPROVED", "REJECTED"].includes(decision)) return;
  try {
    await decideFyp(user, id, decision, remarks);
  } catch {
    // ignore
  }
  revalidatePath("/admin/fyp");
  revalidatePath("/fyp");
  revalidatePath("/admin/reports");
}
