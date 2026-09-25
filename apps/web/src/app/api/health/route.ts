import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiStatus } from "@/server/ai/provider";

export const dynamic = "force-dynamic";

/** Liveness + DB ping + AI provider status (public — used by uptime checks and the offline kit). */
export async function GET() {
  const started = Date.now();
  const ai = aiStatus();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      latencyMs: Date.now() - started,
      ai,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    });
  } catch {
    return NextResponse.json({ ok: false, db: "down", ai }, { status: 503 });
  }
}
