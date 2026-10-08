"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { markMessageRead, sendMessage } from "@/server/services/messages";

/**
 * Messaging server actions — available to every signed-in role (no capability
 * gate). Identity always comes from the session; the client can never send
 * as, or read for, someone else — the service scopes sender/recipient.
 */

export async function sendMessageAction(formData: FormData) {
  const user = await requireUser();

  const recipientId = String(formData.get("recipientId") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!recipientId) {
    redirect(
      `/messages?view=compose&error=${encodeURIComponent("Choose a recipient for your message.")}`,
    );
  }

  try {
    await sendMessage(user, {
      recipientId,
      ...(subject ? { subject } : {}),
      body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    redirect(`/messages?view=compose&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/messages");
  redirect("/messages?view=sent&sent=1");
}

export async function markReadAction(formData: FormData) {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  // Ownership is enforced inside markMessageRead (recipientId must match).
  await markMessageRead(user, id);
  revalidatePath("/messages");
}
