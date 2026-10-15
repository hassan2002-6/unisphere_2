import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getComplaintAttachment, ServiceError } from "@/server/services/complaints";
import { fromBytes } from "@/server/bytes";

export const dynamic = "force-dynamic";

/** GET /api/complaints/[id]/attachment — submitter or handling staff only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const file = await getComplaintAttachment(user, id);
    const body = fromBytes(file.data);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "content-type": file.mime,
        "content-disposition": `attachment; filename="${file.fileName.replace(/[^\w.\-() ]/g, "_")}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    const status = e instanceof ServiceError ? e.status : 500;
    return NextResponse.json({ error: "not_available" }, { status });
  }
}
