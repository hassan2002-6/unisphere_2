import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import { IMPORT_COLUMNS, templateCsv, type ImportEntity } from "@/server/services/import-admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/import-template?entity=students|faculty|courses — CSV template. */
export async function GET(request: Request) {
  await requireCapability("users.manage");
  const entity = (new URL(request.url).searchParams.get("entity") ?? "students") as ImportEntity;
  if (!Object.hasOwn(IMPORT_COLUMNS, entity)) {
    return NextResponse.json({ error: "unknown_entity" }, { status: 400 });
  }
  return new NextResponse(templateCsv(entity), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="unisphere-import-${entity}.csv"`,
      "cache-control": "no-store",
    },
  });
}
