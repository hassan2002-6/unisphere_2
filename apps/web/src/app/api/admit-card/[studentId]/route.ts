import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getEligibility, missingPrerequisites } from "@/server/services/admit-cards";
import { ServiceError } from "@/server/services/forms";
import { renderAdmitCardPdf } from "@/server/pdf";

export const dynamic = "force-dynamic";

/**
 * GET /api/admit-card/[studentId] — the admit-card INTERNAL PREVIEW PDF (§10)
 * for an eligible student, or 409 JSON listing the missing prerequisites.
 * Students can only fetch their own; holders of admitcards.manage (admin) may
 * fetch any (the service enforces both rules).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const user = await requireUser();
  const { studentId } = await params;
  try {
    const report = await getEligibility(user, studentId);
    if (!report.eligible) {
      const missing = missingPrerequisites(report.checks).map((c) => ({ key: c.key, label: c.label, detail: c.detail }));
      return NextResponse.json(
        {
          error: "not_eligible",
          examLabel: report.rule.examLabel,
          student: report.student.name,
          missing,
        },
        { status: 409 },
      );
    }
    const bytes = await renderAdmitCardPdf({
      examLabel: report.rule.examLabel,
      student: report.student,
      rule: {
        requiredFormKey: report.rule.requiredFormKey,
        requireEnrollment: report.rule.requireEnrollment,
        feeClearanceEnabled: report.rule.feeClearanceEnabled,
      },
      checks: report.checks,
    });
    const regNo = report.student.registrationNo ?? report.student.id.slice(-6);
    const fileName = `admit-card-preview-${regNo}.pdf`.replace(/[^A-Za-z0-9._-]/g, "_");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${fileName}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    const status = e instanceof ServiceError ? e.status : 500;
    return NextResponse.json({ error: "not_available" }, { status });
  }
}
