import { headers } from "next/headers";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Clerk → DB user sync (plan §6.3). Signature-verified via Svix.
 * Roles are NEVER taken from the webhook payload — the DB stays authoritative;
 * a new row gets the STUDENT default (adjust roles via the DB/admin tooling).
 * Requires CLERK_WEBHOOK_SECRET from the Clerk dashboard.
 */
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json(
      { error: { code: "not_configured", message: "CLERK_WEBHOOK_SECRET is not set" } },
      { status: 503 },
    );
  }

  const h = await headers();
  const svixId = h.get("svix-id");
  const svixTimestamp = h.get("svix-timestamp");
  const svixSignature = h.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: { code: "bad_request", message: "Missing Svix headers" } }, { status: 400 });
  }

  const payload = await req.text();
  let evt: WebhookEvent;
  try {
    evt = new Webhook(secret).verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as unknown as WebhookEvent;
  } catch {
    return Response.json({ error: { code: "invalid_signature", message: "Signature verification failed" } }, { status: 400 });
  }

  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        const { id: clerkId, email_addresses, first_name, last_name } = evt.data;
        const email = email_addresses?.[0]?.email_address;
        if (!email) break;
        const name = [first_name, last_name].filter(Boolean).join(" ") || email.split("@")[0];

        const existing = await prisma.user.findUnique({ where: { clerkId } });
        if (existing) {
          await prisma.user.update({ where: { id: existing.id }, data: { email, name } });
          break;
        }
        const byEmail = await prisma.user.findUnique({ where: { email } });
        if (byEmail) {
          await prisma.user.update({ where: { id: byEmail.id }, data: { clerkId, name } });
          break;
        }
        await prisma.user.create({ data: { clerkId, email, name, role: "STUDENT" } });
        break;
      }
      case "user.deleted": {
        const clerkId = evt.data.id;
        if (!clerkId) break;
        try {
          await prisma.user.delete({ where: { clerkId } });
        } catch {
          // Records with FK references (forms, complaints…) keep the row.
          console.warn(`[webhook] user.deleted ${clerkId}: row kept (has references)`);
        }
        break;
      }
      default:
        // Other events (session.*, organization.*) are intentionally ignored.
        break;
    }
  } catch (e) {
    console.error("[webhook] handler failed", e);
    return Response.json({ error: { code: "internal", message: "Handler failed" } }, { status: 500 });
  }

  return Response.json({ ok: true });
}
