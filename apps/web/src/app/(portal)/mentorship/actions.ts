"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability, requireUser } from "@/lib/auth";
import {
  cancelMentorshipRequest,
  completeSession,
  proposeSession,
  requestMentorship,
  respondToMentorship,
  respondToSession,
  setMentorApproval,
  upsertMentorProfile,
} from "@/server/services/mentorship";
import { ServiceError } from "@/server/services/forms";

const PATHS = ["/mentorship", "/mentor", "/admin/mentors", "/notifications"];

function revalidateAll() {
  for (const p of PATHS) revalidatePath(p);
}

export async function requestMentorshipAction(formData: FormData) {
  const user = await requireUser();
  const mentorUserId = String(formData.get("mentorUserId") ?? "");
  const message = String(formData.get("message") ?? "");
  if (!mentorUserId) return;
  try {
    await requestMentorship(user, mentorUserId, message);
  } catch (e) {
    const msg = e instanceof ServiceError ? e.message : "Could not send — try again";
    redirect(`/mentorship?error=${encodeURIComponent(msg)}`);
  }
  revalidateAll();
  redirect("/mentorship?sent=1");
}

export async function respondToMentorshipAction(formData: FormData) {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "") as "ACCEPTED" | "DECLINED";
  if (!requestId || !["ACCEPTED", "DECLINED"].includes(decision)) return;
  try {
    await respondToMentorship(user, requestId, decision);
  } catch {
    // ignore
  }
  revalidateAll();
}

export async function cancelMentorshipAction(formData: FormData) {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) return;
  try {
    await cancelMentorshipRequest(user, requestId);
  } catch {
    // ignore
  }
  revalidateAll();
}

export async function proposeSessionAction(formData: FormData) {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const back = String(formData.get("back") ?? "/mentorship");
  if (!requestId) return;
  try {
    await proposeSession(user, requestId, {
      scheduledAt: String(formData.get("scheduledAt") ?? ""),
      mode: String(formData.get("mode") ?? ""),
      location: String(formData.get("location") ?? "") || undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
    });
  } catch (e) {
    const msg = e instanceof ServiceError ? e.message : "Could not propose — try again";
    redirect(`${back}?error=${encodeURIComponent(msg)}`);
  }
  revalidateAll();
  redirect(back);
}

export async function respondToSessionAction(formData: FormData) {
  const user = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const decision = String(formData.get("decision") ?? "") as "CONFIRMED" | "CANCELLED";
  if (!sessionId || !["CONFIRMED", "CANCELLED"].includes(decision)) return;
  try {
    await respondToSession(user, sessionId, decision);
  } catch {
    // ignore
  }
  revalidateAll();
}

export async function completeSessionAction(formData: FormData) {
  const user = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) return;
  try {
    await completeSession(user, sessionId);
  } catch {
    // ignore
  }
  revalidateAll();
}

export async function upsertMentorProfileAction(formData: FormData) {
  const user = await requireUser();
  try {
    await upsertMentorProfile(user, {
      headline: String(formData.get("headline") ?? ""),
      company: String(formData.get("company") ?? "") || undefined,
      expertise: String(formData.get("expertise") ?? "") || undefined,
      bio: String(formData.get("bio") ?? "") || undefined,
      linkedinUrl: String(formData.get("linkedinUrl") ?? "") || undefined,
    });
  } catch (e) {
    const msg = e instanceof ServiceError ? e.message : "Could not save — try again";
    redirect(`/mentor?error=${encodeURIComponent(msg)}`);
  }
  revalidateAll();
  redirect("/mentor?saved=1");
}

export async function setMentorApprovalAction(formData: FormData) {
  await requireCapability("mentors.approve");
  const userId = String(formData.get("userId") ?? "");
  const approved = String(formData.get("approved") ?? "") === "true";
  if (!userId) return;
  try {
    await setMentorApproval(userId, approved);
  } catch {
    // ignore
  }
  revalidateAll();
}
