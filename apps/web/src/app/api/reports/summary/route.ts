import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import { getSummary, summaryToCsv } from "@/server/services/reports";

export const dynamic = "force-dynamic";

/** GET /api/reports/summary?format=csv|json — RBAC-guarded (plan §6.3). */
export async function GET(request: Request) {
  await requireCapability("reports.view");

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "json";

  try {
    const summary = await getSummary();

    if (format === "csv") {
      return new NextResponse(summaryToCsv(summary), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="unisphere-report-${new Date().toISOString().slice(0, 10)}.csv"`,
          "cache-control": "no-store",
        },
      });
    }

    return NextResponse.json(summary, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "reports_unavailable" }, { status: 503 });
  }
}
