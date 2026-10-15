"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ServiceError } from "@/server/services/forms";
import {
  createKnowledgeDoc,
  markUnansweredReviewed,
  setKnowledgeDocArchived,
  updateKnowledgeDoc,
} from "@/server/services/knowledge-admin";

function back(params: string): never {
  revalidatePath("/admin/knowledge");
  redirect(`/admin/knowledge${params}`);
}

function fail(e: unknown): never {
  back(`?error=${encodeURIComponent(e instanceof ServiceError ? e.message : "Action failed — try again.")}`);
}

function docInput(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    source: String(formData.get("source") ?? ""),
    content: String(formData.get("content") ?? ""),
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

export async function createDocAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "knowledge.manage")) redirect("/dashboard?denied=1");
  try {
    await createKnowledgeDoc(user, docInput(formData));
  } catch (e) {
    fail(e);
  }
  back("?ok=doc_created");
}

export async function updateDocAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "knowledge.manage")) redirect("/dashboard?denied=1");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await updateKnowledgeDoc(user, id, docInput(formData));
  } catch (e) {
    fail(e);
  }
  back("?ok=doc_updated");
}

export async function setDocArchivedAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "knowledge.manage")) redirect("/dashboard?denied=1");
  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "1";
  if (!id) return;
  try {
    await setKnowledgeDocArchived(user, id, archived);
  } catch (e) {
    fail(e);
  }
  back(`?ok=${archived ? "doc_archived" : "doc_restored"}`);
}

export async function reviewUnansweredAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "knowledge.manage")) redirect("/dashboard?denied=1");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await markUnansweredReviewed(user, id, String(formData.get("note") ?? ""));
  } catch (e) {
    fail(e);
  }
  back("?ok=question_reviewed");
}
