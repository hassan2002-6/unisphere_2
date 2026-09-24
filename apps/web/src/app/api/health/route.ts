import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + DB ping (public — used by uptime checks and the offline kit). */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", latencyMs: Date.now() - started });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
