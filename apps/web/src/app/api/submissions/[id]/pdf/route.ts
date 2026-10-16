import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSubmissionPdfData, ServiceError } from "@/server/services/forms";
import { renderSubmissionPdf } from "@/server/pdf";

export const dynamic = "force-dynamic";

/**
 * GET /api/submissions/[id]/pdf — the finalized-form PDF (spec §9).
 * Auth-gated like the other submission routes: the service enforces that only
 * the submitter, the submission's approver roles or an admin may read it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const data = await getSubmissionPdfData(user, id);
    const bytes = await renderSubmissionPdf(data);
    const fileName = `${data.refNo}.pdf`.replace(/[^A-Za-z0-9._-]/g, "_");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    const status = e instanceof ServiceError ? e.status : 500;
    return NextResponse.json({ error: "not_available" }, { status });
  }
}
