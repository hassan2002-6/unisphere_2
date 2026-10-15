"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/server/services/forms";
import { ask, getOrCreateSession } from "@/server/ai/assistant";

export async function sendMessageAction(formData: FormData) {
  const user = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const question = String(formData.get("question") ?? "").trim();
  if (!sessionId || question.length < 2) return;

  // Cheap abuse guard: 12 questions per rolling minute per user (spec §9).
  const recent = await prisma.chatMessage.count({
    where: { role: "user", createdAt: { gte: new Date(Date.now() - 60_000) }, session: { userId: user.id } },
  });
  if (recent >= 12) {
    redirect(
      `/chat?s=${sessionId}&error=${encodeURIComponent("You're asking faster than the assistant can answer — wait a minute and try again.")}`,
    );
  }

  try {
    await ask(user, sessionId, question);
  } catch (e) {
    // Only deliberate, user-facing service errors are echoed; driver/DB noise
    // (connection strings, stack text) must never reach the UI.
    const msg = e instanceof ServiceError ? e.message : "The assistant hit an unexpected error — please try again.";
    redirect(`/chat?s=${sessionId}&error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/chat");
  redirect(`/chat?s=${sessionId}`);
}

export async function newSessionAction() {
  const user = await requireUser();
  const session = await prisma.chatSession.create({ data: { userId: user.id, title: "New chat" } });
  revalidatePath("/chat");
  redirect(`/chat?s=${session.id}`);
}

export async function ensureSessionAction() {
  const user = await requireUser();
  const session = await getOrCreateSession(user);
  redirect(`/chat?s=${session.id}`);
}
