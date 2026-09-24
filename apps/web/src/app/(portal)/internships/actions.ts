"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability, requireUser } from "@/lib/auth";
import {
  applyToInternship,
  createInternship,
  setInternshipStatus,
  updateApplicationStatus,
} from "@/server/services/internships";
import { ServiceError } from "@/server/services/forms";
import type { InternshipApplicationStatus } from "@unisphere/db";

const PATHS = ["/internships", "/admin/internships", "/notifications"];

export async function applyAction(formData: FormData) {
  const user = await requireUser();
  const internshipId = String(formData.get("internshipId") ?? "");
  const note = String(formData.get("note") ?? "");
  if (!internshipId) return;
  try {
    await applyToInternship(user, internshipId, note);
  } catch (e) {
    const msg = e instanceof ServiceError ? e.message : "Could not apply — try again";
    redirect(`/internships/${internshipId}?error=${encodeURIComponent(msg)}`);
  }
  for (const p of PATHS) revalidatePath(p);
  redirect(`/internships/${internshipId}?applied=1`);
}

export async function createInternshipAction(formData: FormData) {
  const user = await requireCapability("internships.post");
  try {
    await createInternship(user, {
      title: String(formData.get("title") ?? ""),
      company: String(formData.get("company") ?? ""),
      description: String(formData.get("description") ?? ""),
      location: String(formData.get("location") ?? "") || undefined,
      mode: String(formData.get("mode") ?? "") || undefined,
      stipend: String(formData.get("stipend") ?? "") || undefined,
      deadline: String(formData.get("deadline") ?? "") || undefined,
      applyUrl: String(formData.get("applyUrl") ?? "") || undefined,
      tags: String(formData.get("tags") ?? "") || undefined,
    });
  } catch (e) {
    const msg = e instanceof ServiceError ? e.message : "Could not post — try again";
    redirect(`/admin/internships?error=${encodeURIComponent(msg)}`);
  }
  for (const p of PATHS) revalidatePath(p);
  redirect("/admin/internships?created=1");
}

export async function setInternshipStatusAction(formData: FormData) {
  await requireCapability("internships.post");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as "OPEN" | "CLOSED";
  if (!id || !["OPEN", "CLOSED"].includes(status)) return;
  try {
    await setInternshipStatus(id, status);
  } catch {
    // ignore
  }
  for (const p of PATHS) revalidatePath(p);
}

export async function updateApplicationAction(formData: FormData) {
  const user = await requireCapability("internships.post");
  const applicationId = String(formData.get("applicationId") ?? "");
  const status = String(formData.get("status") ?? "") as InternshipApplicationStatus;
  if (!applicationId || !["SHORTLISTED", "ACCEPTED", "REJECTED"].includes(status)) return;
  try {
    await updateApplicationStatus(user, applicationId, status);
  } catch {
    // ignore
  }
  for (const p of PATHS) revalidatePath(p);
}
