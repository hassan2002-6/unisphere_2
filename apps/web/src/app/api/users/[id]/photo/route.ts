import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAvatarImage } from "@/server/services/profiles";
import { fromBytes } from "@/server/bytes";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/[id]/photo — any signed-in portal member can render avatars
 * (they're visible throughout the university UI); bytes are cached privately.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const avatar = await getAvatarImage(id);
  if (!avatar) return NextResponse.json({ error: "no_photo" }, { status: 404 });
  const body = fromBytes(avatar.data);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "content-type": avatar.mime,
      "cache-control": "private, max-age=300",
      ...(avatar.updatedAt ? { "last-modified": avatar.updatedAt.toUTCString() } : {}),
    },
  });
}
